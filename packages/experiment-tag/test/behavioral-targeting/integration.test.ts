import { EvaluationOperator } from '@amplitude/experiment-core';
import { BehavioralTargetingEvaluator } from 'src/behavioral-targeting/evaluator';
import { EventStorageManager } from 'src/behavioral-targeting/event-storage';
import { SessionManager } from 'src/behavioral-targeting/session-manager';
import type { BehavioralTargeting } from 'src/behavioral-targeting/types';

describe('Behavioral Targeting Integration', () => {
  let sessionManager: SessionManager;
  let eventStorage: EventStorageManager;
  let evaluator: BehavioralTargetingEvaluator;
  const testApiKey = 'test-api-key';
  const storageKey = `EXP_${testApiKey.slice(0, 10)}_rtbt_events`;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionManager = new SessionManager(testApiKey);
    eventStorage = new EventStorageManager(testApiKey, sessionManager);
    evaluator = new BehavioralTargetingEvaluator(eventStorage);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('end-to-end user journey', () => {
    test('should track and evaluate complete user journey', () => {
      // User lands on homepage
      eventStorage.addEvent('page_view', { page: 'home' });

      // User views product
      eventStorage.addEvent('page_view', {
        page: 'product',
        product_id: 'abc123',
      });

      // User adds to cart
      eventStorage.addEvent('add_to_cart', {
        product_id: 'abc123',
        price: 99.99,
      });

      // User views cart
      eventStorage.addEvent('page_view', { page: 'cart' });

      // Targeting: Show checkout reminder to users who added to cart but didn't purchase
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'add_to_cart',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
          {
            condition: {
              type: 'event',
              event_type: 'purchase',
              op: EvaluationOperator.IS,
              value: 0,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      // User completes purchase
      eventStorage.addEvent('purchase', {
        product_id: 'abc123',
        amount: 99.99,
      });

      // Should no longer match targeting (has purchase now)
      expect(evaluator.evaluate(rules)).toBe(false);
    });
  });

  describe('cross-session scenarios', () => {
    test('should differentiate between current and previous sessions', () => {
      // Session 1: User browses but doesn't purchase
      const session1Id = sessionManager.getOrCreateSessionId();
      eventStorage.addEvent('page_view', { page: 'product' });
      eventStorage.addEvent('add_to_cart', { product_id: 'xyz' });

      // User closes tab, comes back later (new session)
      sessionManager.clearSession();
      const session2Id = sessionManager.getOrCreateSessionId();
      eventStorage.addEvent('page_view', { page: 'home' });

      expect(session1Id).not.toBe(session2Id);

      // Targeting: Cart abandoners in current session
      const currentSessionRules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'add_to_cart',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      // Should not match (add_to_cart was in previous session)
      expect(evaluator.evaluate(currentSessionRules)).toBe(false);

      // Targeting: Users who abandoned cart in past 7 days
      const rollingWindowRules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'add_to_cart',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
              time_type: 'rolling',
              time_value: 7,
              interval: 'day',
            },
          },
        ],
      ];

      // Should match (add_to_cart was within 7 days)
      expect(evaluator.evaluate(rollingWindowRules)).toBe(true);
    });
  });

  describe('persistence across page loads', () => {
    test('should maintain session and events across page reloads', () => {
      // Page 1: User views product
      eventStorage.addEvent('page_view', { page: 'product' });
      const sessionId1 = sessionManager.getOrCreateSessionId();
      eventStorage.flush(); // Flush to localStorage before "page reload"

      // Simulate page reload (new manager instances)
      const sessionManager2 = new SessionManager(testApiKey);
      const eventStorage2 = new EventStorageManager(
        testApiKey,
        sessionManager2,
      );
      const evaluator2 = new BehavioralTargetingEvaluator(eventStorage2);

      // Page 2: User adds to cart
      eventStorage2.addEvent('add_to_cart', { product_id: 'abc' });
      const sessionId2 = sessionManager2.getOrCreateSessionId();

      // Should be same session
      expect(sessionId1).toBe(sessionId2);

      // Should have both events
      expect(eventStorage2.getAllEvents()).toHaveLength(2);

      // Targeting should work across reloads
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'page_view',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
          {
            condition: {
              type: 'event',
              event_type: 'add_to_cart',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator2.evaluate(rules)).toBe(true);
    });
  });

  describe('real-world targeting scenarios', () => {
    test('abandoned cart reminder', () => {
      eventStorage.addEvent('add_to_cart', { product_id: 'abc' });
      eventStorage.addEvent('page_view', { page: 'cart' });
      // User leaves without purchasing

      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'add_to_cart',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
          {
            condition: {
              type: 'event',
              event_type: 'purchase',
              op: EvaluationOperator.IS,
              value: 0,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);
    });

    test('repeat visitor identification', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      // First visit (7 days ago)
      eventStorage.addEvent('page_view', { page: 'home' });

      // Move forward 7 days
      jest.setSystemTime(now + 7 * 24 * 60 * 60 * 1000);

      // Second visit
      eventStorage.addEvent('page_view', { page: 'home' });

      // Targeting: Users who visited in last 30 days
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'page_view',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 2,
              time_type: 'rolling',
              time_value: 30,
              interval: 'day',
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      jest.useRealTimers();
    });

    test('high-value customer identification', () => {
      // User makes multiple high-value purchases
      eventStorage.addEvent('purchase', { amount: 500 });
      eventStorage.addEvent('purchase', { amount: 750 });
      eventStorage.addEvent('purchase', { amount: 300 });

      // Targeting: Users with 2+ purchases over $500
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'purchase',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 2,
              time_type: 'current_session',
              time_value: 0,
              event_props: [
                {
                  selector: ['context', 'amount'],
                  op: 'greater or equal',
                  values: ['500'],
                },
              ],
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);
    });

    test('feature discovery targeting', () => {
      // User has viewed product page but never used search
      eventStorage.addEvent('page_view', { page: 'product' });
      eventStorage.addEvent('page_view', { page: 'product' });
      eventStorage.addEvent('page_view', { page: 'product' });

      // Targeting: Users who viewed products but never searched
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'page_view',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 3,
              time_type: 'current_session',
              time_value: 0,
              event_props: [
                {
                  selector: ['context', 'page'],
                  op: 'is',
                  values: ['product'],
                },
              ],
            },
          },
          {
            condition: {
              type: 'event',
              event_type: 'search',
              op: EvaluationOperator.IS,
              value: 0,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      // User performs search
      eventStorage.addEvent('search', { query: 'shoes' });

      // Should no longer match
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('engagement-based targeting', () => {
      // Active user with high engagement
      eventStorage.addEvent('page_view', { page: 'home' });
      eventStorage.addEvent('click', { element: 'nav' });
      eventStorage.addEvent('page_view', { page: 'product' });
      eventStorage.addEvent('click', { element: 'product-image' });
      eventStorage.addEvent('page_view', { page: 'reviews' });

      // Targeting: Engaged users (5+ actions) OR high-value customers
      const rules: BehavioralTargeting = [
        // Group 1: 5+ page views or clicks
        [
          {
            condition: {
              type: 'event',
              event_type: 'page_view',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 3,
              time_type: 'current_session',
              time_value: 0,
            },
          },
          {
            condition: {
              type: 'event',
              event_type: 'click',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 2,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
        // Group 2: Any purchase (fallback)
        [
          {
            condition: {
              type: 'event',
              event_type: 'purchase',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      // Should match via engagement (Group 1)
      expect(evaluator.evaluate(rules)).toBe(true);
    });
  });

  describe('complex DNF scenarios', () => {
    test('should handle multi-segment targeting', () => {
      eventStorage.addEvent('page_view', { page: 'pricing' });
      eventStorage.addEvent('page_view', { page: 'pricing' });
      eventStorage.addEvent('page_view', { page: 'features' });

      // Targeting: Interested users (viewed pricing 2+ times OR clicked demo)
      // AND not already a customer
      const rules: BehavioralTargeting = [
        // Segment 1: Viewed pricing 2+ times, no signup
        [
          {
            condition: {
              type: 'event',
              event_type: 'page_view',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 2,
              time_type: 'current_session',
              time_value: 0,
              event_props: [
                {
                  selector: ['context', 'page'],
                  op: 'is',
                  values: ['pricing'],
                },
              ],
            },
          },
          {
            condition: {
              type: 'event',
              event_type: 'signup',
              op: EvaluationOperator.IS,
              value: 0,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
        // Segment 2: Clicked demo, no signup
        [
          {
            condition: {
              type: 'event',
              event_type: 'click',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
              time_type: 'current_session',
              time_value: 0,
              event_props: [
                {
                  selector: ['context', 'element'],
                  op: 'is',
                  values: ['demo-button'],
                },
              ],
            },
          },
          {
            condition: {
              type: 'event',
              event_type: 'signup',
              op: EvaluationOperator.IS,
              value: 0,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      // Should match via Segment 1
      expect(evaluator.evaluate(rules)).toBe(true);

      // User signs up
      eventStorage.addEvent('signup', { plan: 'free' });

      // Should no longer match (has signup)
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should handle time-based re-engagement', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      // User was active 3 days ago
      eventStorage.addEvent('page_view', { page: 'home' });
      eventStorage.addEvent('purchase', { amount: 100 });

      // Move forward 3 days
      jest.setSystemTime(now + 3 * 24 * 60 * 60 * 1000);

      // Targeting: Users who purchased 1-7 days ago but haven't visited in last 24 hours
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'purchase',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
              time_type: 'rolling',
              time_value: 7,
              interval: 'day',
            },
          },
          {
            condition: {
              type: 'event',
              event_type: 'page_view',
              op: EvaluationOperator.IS,
              value: 0,
              time_type: 'rolling',
              time_value: 24,
              interval: 'hour',
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      // User visits again
      eventStorage.addEvent('page_view', { page: 'home' });

      // Should no longer match (visited in last 24 hours)
      expect(evaluator.evaluate(rules)).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('FIFO event limit integration', () => {
    test('should maintain targeting accuracy with FIFO limit', () => {
      // Add 501 events to trigger FIFO
      for (let i = 0; i < 501; i++) {
        eventStorage.addEvent('click', { index: i });
      }

      // First event (index: 0) should be removed
      const events = eventStorage.getAllEvents();
      expect(events).toHaveLength(500);
      expect(events[0].properties.index).toBe(1);

      // Targeting should still work correctly
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'click',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 500,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);
    });
  });

  describe('error recovery', () => {
    test('should recover from corrupted storage', () => {
      // Add some events
      eventStorage.addEvent('click');

      // Corrupt localStorage
      localStorage.setItem(storageKey, 'invalid json');

      // Create new instances (simulates page reload)
      const newSessionManager = new SessionManager(testApiKey);
      const newEventStorage = new EventStorageManager(
        testApiKey,
        newSessionManager,
      );
      const newEvaluator = new BehavioralTargetingEvaluator(newEventStorage);

      // Should start fresh without errors
      newEventStorage.addEvent('view');

      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'view',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(newEvaluator.evaluate(rules)).toBe(true);
    });
  });
});
