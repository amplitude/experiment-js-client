import { EvaluationOperator } from '@amplitude/experiment-core';
import { BehavioralTargetingEvaluator } from 'src/behavioral-targeting/evaluator';
import { EventStorageManager } from 'src/behavioral-targeting/event-storage';
import { SessionManager } from 'src/behavioral-targeting/session-manager';
import { BehavioralTargeting } from 'src/behavioral-targeting/types';

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

    describe.each([
      {
        operator: EvaluationOperator.GREATER_THAN_EQUALS,
        passingValue: 3,
        failingValue: 4,
        description: 'greater than or equal',
      },
      {
        operator: EvaluationOperator.GREATER_THAN,
        passingValue: 2,
        failingValue: 3,
        description: 'greater than',
      },
      {
        operator: EvaluationOperator.IS,
        passingValue: 3,
        failingValue: 2,
        description: 'equal to',
      },
      {
        operator: EvaluationOperator.LESS_THAN,
        passingValue: 4,
        failingValue: 3,
        description: 'less than',
      },
      {
        operator: EvaluationOperator.LESS_THAN_EQUALS,
        passingValue: 3,
        failingValue: 2,
        description: 'less than or equal',
      },
      {
        operator: EvaluationOperator.IS_NOT,
        passingValue: 5,
        failingValue: 3,
        description: 'not equal',
      },
    ])(
      '$operator operator ($description)',
      ({ operator, passingValue, failingValue }) => {
        test(`should evaluate ${operator} operator correctly`, () => {
          const rules: BehavioralTargeting = [
            [
              {
                condition: {
                  type: 'event',
                  event_type: 'click',
                  op: operator as any,
                  value: passingValue,
                  time_type: 'current_session',
                  time_value: 0,
                },
              },
            ],
          ];

          expect(evaluator.evaluate(rules)).toBe(true);

          rules[0][0].condition.value = failingValue;
          expect(evaluator.evaluate(rules)).toBe(false);
        });
      },
    );
  });

  describe('time windows', () => {
    describe('current_session', () => {
      test('should only count events from current session', () => {
        eventStorage.addEvent('click');
        eventStorage.addEvent('click');

        // Clear and create new session
        sessionManager.clearSession();
        eventStorage.addEvent('click');

        const rules: BehavioralTargeting = [
          [
            {
              condition: {
                type: 'event',
                event_type: 'click',
                op: EvaluationOperator.GREATER_THAN_EQUALS,
                value: 1,
                time_type: 'current_session',
                time_value: 0,
              },
            },
          ],
        ];

        expect(evaluator.evaluate(rules)).toBe(true);

        // Should only count 1 event from current session
        rules[0][0].condition.value = 2;
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
                event_type: 'click',
                op: EvaluationOperator.GREATER_THAN_EQUALS,
                value: 1,
                time_type: 'rolling',
                time_value: 1,
                interval: 'hour',
              },
            },
          ],
        ];

        expect(evaluator.evaluate(rules)).toBe(true);

        // Only 1 event in last hour
        rules[0][0].condition.value = 2;
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
                event_type: 'click',
                op: EvaluationOperator.GREATER_THAN_EQUALS,
                value: 1,
                time_type: 'rolling',
                time_value: 1,
                interval: 'day',
              },
            },
          ],
        ];

        expect(evaluator.evaluate(rules)).toBe(true);

        // Only 1 event in last day
        rules[0][0].condition.value = 2;
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
              event_type: 'purchase',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 2,
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
      rules[0][0].condition.value = 3;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should handle multiple property conditions (AND)', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'purchase',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
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
      rules[0][0].condition.value = 2;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should handle no property filters', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'purchase',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 3,
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
              event_type: 'click',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 5,
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
              event_type: 'purchase',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
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
              event_type: 'click',
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
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
      ];

      // AND: both conditions must match
      expect(evaluator.evaluate(rules)).toBe(true);

      // Change second condition to require 2 purchases
      rules[0][1].condition.value = 2;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should return false when no groups match', () => {
      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'click',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 10,
              time_type: 'current_session',
              time_value: 0,
            },
          },
        ],
        [
          {
            condition: {
              type: 'event',
              event_type: 'purchase',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 10,
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
              event_type: 'click',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 3,
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
      rules[0][0].condition.value = 2;
      expect(evaluator.evaluate(rules)).toBe(false);
    });

    test('should handle negation in AND groups', () => {
      eventStorage.addEvent('view');

      const rules: BehavioralTargeting = [
        [
          {
            condition: {
              type: 'event',
              event_type: 'click',
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
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
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
              event_type: 'view',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
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
              event_type: 'click',
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
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
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
              event_type: 'click',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
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
              event_type: 'click',
              op: 'unknown' as any,
              value: 1,
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
              event_type: 'nonexistent',
              op: EvaluationOperator.GREATER_THAN_EQUALS,
              value: 1,
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
