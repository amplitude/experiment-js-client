import { BehavioralTargetingEvaluator } from 'src/behavioral-targeting/evaluator';
import { EventStorageManager } from 'src/behavioral-targeting/event-storage';
import { SessionManager } from 'src/behavioral-targeting/session-manager';
import {
  BehavioralTargeting,
  BehavioralCondition,
} from 'src/behavioral-targeting/types';

describe('BehavioralTargetingEvaluator', () => {
  let evaluator: BehavioralTargetingEvaluator;
  let eventStorage: EventStorageManager;
  let sessionManager: SessionManager;
  const testApiKey = 'test-api-key';

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

  describe('count operators', () => {
    beforeEach(() => {
      // Add 3 click events
      eventStorage.addEvent('click');
      eventStorage.addEvent('click');
      eventStorage.addEvent('click');
    });

    test('should evaluate >= operator', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: '>=',
              operator_value: 3,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      rules[0][0].condition.operator_value = 4;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should evaluate > operator', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: '>',
              operator_value: 2,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      rules[0][0].condition.operator_value = 3;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should evaluate = operator', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: '=',
              operator_value: 3,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      rules[0][0].condition.operator_value = 2;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should evaluate < operator', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: '<',
              operator_value: 4,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      rules[0][0].condition.operator_value = 3;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should evaluate <= operator', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: '<=',
              operator_value: 3,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      rules[0][0].condition.operator_value = 2;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should evaluate != operator', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: '!=',
              operator_value: 5,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      rules[0][0].condition.operator_value = 3;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should evaluate "is set" operator', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: 'is set',
              operator_value: 0,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      rules[0][0].condition.type_value = 'nonexistent';
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should evaluate "is not set" operator', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'nonexistent',
              operator: 'is not set',
              operator_value: 0,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      rules[0][0].condition.type_value = 'click';
      expect(evaluator.evaluate(rules)).toBe(false);
    });
  });

  describe('time windows', () => {
    describe('current_session', () => {
      test('should only count events from current session', () => {
        const sessionId1 = sessionManager.getOrCreateSessionId();
        eventStorage.addEvent('click');
        eventStorage.addEvent('click');

        // Clear and create new session
        sessionManager.clearSession();
        sessionManager.getOrCreateSessionId();
        eventStorage.addEvent('click');

        const rules: BehavioralTargeting = [
          [
            {
              condition: {
                type: 'event',
                type_value: 'click',
                operator: '>=',
                operator_value: 1,
                time_type: 'current_session',
                time_value: 0,
              },
            },
          ],
        ];

        expect(evaluator.evaluate(rules)).toBe(true);

        // Should only count 1 event from current session
        rules[0][0].condition.operator_value = 2;
        expect(evaluator.evaluate(rules)).toBe(false);
      });
    });

    describe('rolling window', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      test('should filter by rolling hour window', () => {
        const now = Date.now();
        jest.setSystemTime(now);

        eventStorage.addEvent('click');
        eventStorage.addEvent('click');

        // Move forward 2 hours
        jest.setSystemTime(now + 2 * 60 * 60 * 1000);
        eventStorage.addEvent('click');

        const rules: BehavioralTargeting = [
          [
            {
              condition: {
                type: 'event',
                type_value: 'click',
                operator: '>=',
                operator_value: 1,
                time_type: 'rolling',
                time_value: 1,
                interval: 'hour',
              },
            },
          ],
        ];

        expect(evaluator.evaluate(rules)).toBe(true);

        // Only 1 event in last hour
        rules[0][0].condition.operator_value = 2;
        expect(evaluator.evaluate(rules)).toBe(false);
      });

      test('should filter by rolling day window', () => {
        const now = Date.now();
        jest.setSystemTime(now);

        eventStorage.addEvent('click');

        // Move forward 2 days
        jest.setSystemTime(now + 2 * 24 * 60 * 60 * 1000);
        eventStorage.addEvent('click');

        const rules: BehavioralTargeting = [
          [
            {
              condition: {
                type: 'event',
                type_value: 'click',
                operator: '>=',
                operator_value: 1,
                time_type: 'rolling',
                time_value: 1,
                interval: 'day',
              },
            },
          ],
        ];

        expect(evaluator.evaluate(rules)).toBe(true);

        // Only 1 event in last day
        rules[0][0].condition.operator_value = 2;
        expect(evaluator.evaluate(rules)).toBe(false);
      });
    });
  });

  describe('property filtering', () => {
    beforeEach(() => {
      eventStorage.addEvent('purchase', {
        amount: 100,
        category: 'electronics',
      });
      eventStorage.addEvent('purchase', { amount: 50, category: 'books' });
      eventStorage.addEvent('purchase', {
        amount: 200,
        category: 'electronics',
      });
    });

    test('should filter events by property conditions', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'purchase',
              operator: '>=',
              operator_value: 2,
              time_type: 'current_session',
              time_value: 0,
              event_props: [
                {
                  selector: ['context', 'category'],
                  op: 'is',
                  values: ['electronics'],
                },
              ],
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      // Only 2 electronics purchases
      rules[0][0].condition.operator_value = 3;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should handle multiple property conditions (AND)', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'purchase',
              operator: '>=',
              operator_value: 1,
              time_type: 'current_session',
              time_value: 0,
              event_props: [
                {
                  selector: ['context', 'category'],
                  op: 'is',
                  values: ['electronics'],
                },
                {
                  selector: ['context', 'amount'],
                  op: 'greater or equal',
                  values: ['200'],
                },
              ],
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);

      // Only 1 electronics purchase >= 200
      rules[0][0].condition.operator_value = 2;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should handle no property filters', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'purchase',
              operator: '>=',
              operator_value: 3,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);
    });
  });

  describe('DNF logic (OR of ANDs)', () => {
    beforeEach(() => {
      eventStorage.addEvent('click');
      eventStorage.addEvent('view');
      eventStorage.addEvent('purchase');
    });

    test('should evaluate OR logic (multiple AND groups)', () => {
      const rules: BehavioralTargeting = [
        // First AND group: 5 clicks (will be false)
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: '>=',
              operator_value: 5,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
        // Second AND group: 1 purchase (will be true)
        [
          {
            condition: {
              type: 'event',
              type_value: 'purchase',
              operator: '>=',
              operator_value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      // OR: one group matching is enough
      expect(evaluator.evaluate(rules)).toBe(true);
    });

    test('should evaluate AND logic within group', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: '>=',
              operator_value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
          {
            condition: {
              type: 'event',
              type_value: 'purchase',
              operator: '>=',
              operator_value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      // AND: both conditions must match
      expect(evaluator.evaluate(rules)).toBe(true);

      // Change second condition to require 2 purchases
      rules[0][1].condition.operator_value = 2;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should return false when no groups match', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: '>=',
              operator_value: 10,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
        [
          {
            condition: {
              type: 'event',
              type_value: 'purchase',
              operator: '>=',
              operator_value: 10,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(false);
    });
  });

  describe('negation', () => {
    beforeEach(() => {
      eventStorage.addEvent('click');
      eventStorage.addEvent('click');
    });

    test('should apply negation to condition', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: '>=',
              operator_value: 3,
              time_type: 'current_session',
              time_value: 0,
            },
            negated: true,
          },
        ],
      ];

      // Condition is false (2 < 3), negated makes it true
      expect(evaluator.evaluate(rules)).toBe(true);

      // Condition is true (2 >= 2), negated makes it false
      rules[0][0].condition.operator_value = 2;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should handle negation in AND groups', () => {
      eventStorage.addEvent('view');

      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: '>=',
              operator_value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
          {
            condition: {
              type: 'event',
              type_value: 'purchase',
              operator: '>=',
              operator_value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
            negated: true,
          },
        ],
      ];

      // Has clicks AND no purchases
      expect(evaluator.evaluate(rules)).toBe(true);

      // Add a purchase
      eventStorage.addEvent('purchase');
      expect(evaluator.evaluate(rules)).toBe(false);
    });
  });

  describe('complex scenarios', () => {
    test('should handle complex DNF with multiple conditions', () => {
      eventStorage.addEvent('view', { page: 'home' });
      eventStorage.addEvent('view', { page: 'product' });
      eventStorage.addEvent('click', { button: 'add-to-cart' });
      eventStorage.addEvent('purchase', { amount: 100 });

      const rules: BehavioralTargeting = [
        // Group 1: High-intent user (viewed product AND clicked add-to-cart AND purchased)
        [
          {
            condition: {
              type: 'event',
              type_value: 'view',
              operator: '>=',
              operator_value: 1,
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
              type_value: 'click',
              operator: '>=',
              operator_value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
          {
            condition: {
              type: 'event',
              type_value: 'purchase',
              operator: '>=',
              operator_value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);
    });

    test('should handle empty rules array', () => {
      const rules: BehavioralTargeting = [];
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should handle empty AND group', () => {
      const rules: BehavioralTargeting = [[]];
      expect(evaluator.evaluate(rules)).toBe(true); // Empty AND group returns true
    });
  });

  describe('edge cases', () => {
    test('should handle events with no properties', () => {
      eventStorage.addEvent('click');

      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: '>=',
              operator_value: 1,
              time_type: 'current_session',
              time_value: 0,
              event_props: [],
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(true);
    });

    test('should handle unknown operator gracefully', () => {
      eventStorage.addEvent('click');

      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'click',
              operator: 'unknown' as any,
              operator_value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should handle non-existent event type', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              type_value: 'nonexistent',
              operator: '>=',
              operator_value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      expect(evaluator.evaluate(rules)).toBe(false);
    });
  });
});
