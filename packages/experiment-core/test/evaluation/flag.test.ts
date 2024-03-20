import { EvaluationEngine, EvaluationFlag } from '../../src';

test('session replay flag example', async () => {
  const context = {
    session_id: '0T7fd80lM2xK36nv3VG',
    user: {
      user_id: 'user@example.com',
      device_id: '67f316d7-1682-4911-bf7c-ce6aed79b242',
      cohort_ids: ['yOViFP4O'],
    },
    event: {
      event_type: 'Sign In',
      event_properties: {
        source: 'home page',
      },
    },
  };
  const flag: EvaluationFlag = {
    key: 'session-replay-targeting',
    variants: {
      on: { key: 'on' },
      off: { key: 'off' },
    },
    segments: [
      {
        metadata: { segmentName: 'sign in trigger' },
        bucket: {
          selector: ['context', 'session_id'],
          salt: 'Rpr5h4vy',
          allocations: [
            {
              range: [0, 19],
              distributions: [
                {
                  variant: 'on',
                  range: [0, 42949673],
                },
              ],
            },
          ],
        },
        conditions: [
          [
            {
              selector: ['context', 'event', 'event_type'],
              op: 'is',
              values: ['Sign In'],
            },
          ],
        ],
      },
      {
        metadata: { segmentName: 'cohort inclusion' },
        bucket: {
          selector: ['context', 'session_id'],
          salt: 'Rpr5h4vy',
          allocations: [
            {
              range: [0, 14],
              distributions: [
                {
                  variant: 'on',
                  range: [0, 42949673],
                },
              ],
            },
          ],
        },
        conditions: [
          [
            {
              selector: ['context', 'user', 'cohort_ids'],
              op: 'set contains any',
              values: ['yOViFP4O'],
            },
          ],
        ],
      },
      {
        variant: 'off',
      },
    ],
  };
  const engine = new EvaluationEngine();
  const result = engine.evaluate(context, [flag])['session-replay-targeting'];
  // eslint-disable-next-line no-console
  console.log('result', result);
});
