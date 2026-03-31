import {
  EvaluationEngine,
  type EvaluationFlag,
  type EvaluationSegment,
} from '../../src';

const engine = new EvaluationEngine();

const makeFlag = (
  key: string,
  segments: EvaluationSegment[],
  variants: EvaluationFlag['variants'] = {
    control: { key: 'control', value: 'control' },
    treatment: { key: 'treatment', value: 'treatment' },
    off: { key: 'off', metadata: { default: true } },
  },
  metadata?: Record<string, unknown>,
): EvaluationFlag => ({ key, segments, variants, metadata });

const userContext = (
  userId?: string,
  props?: Record<string, unknown>,
): Record<string, unknown> => ({
  user: {
    user_id: userId,
    user_properties: props,
  },
});

describe('evaluateWithTraces', () => {
  it('traces a single always-match segment with no conditions', () => {
    const flag = makeFlag('flag-1', [
      {
        metadata: { segmentName: 'All Users' },
        variant: 'treatment',
      },
    ]);

    const context = userContext('u1');
    const { traces } = engine.evaluateWithTraces(context, [flag]);
    const trace = traces['flag-1'];

    expect(trace.matched).toBe(true);
    expect(trace.matchedSegment).toEqual('All Users');
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0].matched).toBe(true);
    expect(trace.steps[0].segmentMetadata).toEqual({
      segmentName: 'All Users',
    });
    expect(trace.steps[0].conditionResult).toBeUndefined();
  });

  it('reports matched: false for a no-conditions segment when bucket returns undefined', () => {
    const flag = makeFlag('flag-unbucketed', [
      {
        metadata: { segmentName: 'Empty Segment' },
      },
    ]);

    const context = userContext('u1');
    const { results, traces } = engine.evaluateWithTraces(context, [flag]);
    const trace = traces['flag-unbucketed'];

    expect(results['flag-unbucketed']).toBeUndefined();
    expect(trace.matched).toBe(false);
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0].conditionsPassed).toBe(true);
    expect(trace.steps[0].bucketed).toBe(false);
    expect(trace.steps[0].matched).toBe(false);
  });

  it('records per-condition detail with propValue and matched', () => {
    const flag = makeFlag('flag-2', [
      {
        metadata: { segmentName: 'Beta Users' },
        conditions: [
          [
            {
              selector: ['context', 'user', 'user_properties', 'beta'],
              op: 'is',
              values: ['true'],
            },
          ],
        ],
        variant: 'treatment',
      },
    ]);

    const context = userContext('u1', { beta: 'true' });
    const { traces } = engine.evaluateWithTraces(context, [flag]);
    const step = traces['flag-2'].steps[0];

    expect(step.matched).toBe(true);
    expect(step.conditionResult).toHaveLength(1);
    const andGroup = step.conditionResult?.[0];
    expect(andGroup).toHaveLength(1);
    expect(andGroup?.[0].propValue).toEqual('true');
    expect(andGroup?.[0].condition.op).toEqual('is');
    expect(andGroup?.[0].condition.values).toEqual(['true']);
    expect(andGroup?.[0].matched).toBe(true);
  });

  it('records failed condition with actual propValue', () => {
    const flag = makeFlag('flag-3', [
      {
        metadata: { segmentName: 'UK Users' },
        conditions: [
          [
            {
              selector: ['context', 'user', 'user_properties', 'country'],
              op: 'is',
              values: ['UK'],
            },
          ],
        ],
        variant: 'treatment',
      },
      {
        metadata: { segmentName: 'All Other Users' },
        variant: 'control',
      },
    ]);

    const context = userContext('u1', { country: 'US' });
    const { traces } = engine.evaluateWithTraces(context, [flag]);
    const trace = traces['flag-3'];

    expect(trace.matched).toBe(true);
    expect(trace.matchedSegment).toEqual('All Other Users');
    expect(trace.steps).toHaveLength(2);
    expect(trace.steps[0].matched).toBe(false);
    expect(trace.steps[0].conditionResult?.[0]?.[0]?.propValue).toEqual('US');
    expect(trace.steps[0].conditionResult?.[0]?.[0]?.matched).toBe(false);
    expect(trace.steps[1].matched).toBe(true);
    expect(trace.steps[1].conditionResult).toBeUndefined();
  });

  it('traces multiple segments where none match', () => {
    const flag = makeFlag('flag-5', [
      {
        metadata: { segmentName: 'VIP' },
        conditions: [
          [
            {
              selector: ['context', 'user', 'user_properties', 'vip'],
              op: 'is',
              values: ['true'],
            },
          ],
        ],
        variant: 'treatment',
      },
      {
        metadata: { segmentName: 'Internal' },
        conditions: [
          [
            {
              selector: ['context', 'user', 'user_properties', 'internal'],
              op: 'is',
              values: ['true'],
            },
          ],
        ],
        variant: 'control',
      },
    ]);

    const context = userContext('u1', {});
    const { results, traces } = engine.evaluateWithTraces(context, [flag]);

    expect(results['flag-5']).toBeUndefined();
    expect(traces['flag-5'].matched).toBe(false);
    expect(traces['flag-5'].steps).toHaveLength(2);
    expect(traces['flag-5'].steps[0].matched).toBe(false);
    expect(traces['flag-5'].steps[1].matched).toBe(false);
  });

  it('merges metadata correctly on the winning variant', () => {
    const flag = makeFlag(
      'flag-6',
      [
        {
          metadata: { segmentName: 'All', segmentId: 's1' },
          variant: 'treatment',
        },
      ],
      {
        treatment: {
          key: 'treatment',
          value: 'treatment',
          metadata: { variantLevel: true },
        },
      },
      { flagLevel: true },
    );

    const context = userContext('u1');
    const { results } = engine.evaluateWithTraces(context, [flag]);

    expect(results['flag-6']?.metadata).toEqual({
      flagLevel: true,
      segmentName: 'All',
      segmentId: 's1',
      variantLevel: true,
    });
  });

  it('returns the same variants as evaluate()', () => {
    const flags: EvaluationFlag[] = [
      makeFlag('flag-a', [
        {
          metadata: { segmentName: 'Beta' },
          conditions: [
            [
              {
                selector: ['context', 'user', 'user_properties', 'beta'],
                op: 'is',
                values: ['true'],
              },
            ],
          ],
          variant: 'treatment',
        },
        { metadata: { segmentName: 'All' }, variant: 'control' },
      ]),
      makeFlag('flag-b', [
        { metadata: { segmentName: 'All' }, variant: 'treatment' },
      ]),
    ];

    const context = userContext('u1', { beta: 'true' });
    const standard = engine.evaluate(context, flags);
    const { results: traced } = engine.evaluateWithTraces(context, flags);

    expect(Object.keys(traced).sort()).toEqual(Object.keys(standard).sort());
    for (const key of Object.keys(standard)) {
      expect(traced[key]?.key).toEqual(standard[key]?.key);
      expect(traced[key]?.value).toEqual(standard[key]?.value);
      expect(traced[key]?.metadata).toEqual(standard[key]?.metadata);
    }
  });
});
