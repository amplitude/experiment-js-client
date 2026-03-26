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
  it('traces a single segment where conditions pass and bucketing succeeds', () => {
    const flag = makeFlag('flag-1', [
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
    const { results, traces } = engine.evaluateWithTraces(context, [flag]);

    expect(results['flag-1']?.key).toEqual('treatment');

    const trace = traces['flag-1'];
    expect(trace.flagKey).toEqual('flag-1');
    expect(trace.matched).toBe(true);
    expect(trace.matchedSegment).toEqual('Beta Users');
    expect(trace.segments).toHaveLength(1);
    expect(trace.segments[0]).toEqual({
      segmentName: 'Beta Users',
      conditionsPassed: true,
      bucketed: true,
      bucketVariant: 'treatment',
    });
  });

  it('traces a single segment where conditions fail', () => {
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

    const context = userContext('u1', { beta: 'false' });
    const { results, traces } = engine.evaluateWithTraces(context, [flag]);

    expect(results['flag-2']).toBeUndefined();

    const trace = traces['flag-2'];
    expect(trace.matched).toBe(false);
    expect(trace.matchedSegment).toBeUndefined();
    expect(trace.segments[0]).toEqual({
      segmentName: 'Beta Users',
      conditionsPassed: false,
      bucketed: false,
      bucketVariant: undefined,
    });
  });

  it('traces multiple segments and identifies the first match', () => {
    const flag = makeFlag('flag-3', [
      {
        metadata: { segmentName: 'VIP Users' },
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
        metadata: { segmentName: 'All Other Users' },
        variant: 'control',
      },
    ]);

    const context = userContext('u1', { vip: 'true' });
    const { results, traces } = engine.evaluateWithTraces(context, [flag]);

    expect(results['flag-3']?.key).toEqual('treatment');

    const trace = traces['flag-3'];
    expect(trace.matched).toBe(true);
    expect(trace.matchedSegment).toEqual('VIP Users');
    expect(trace.segments).toHaveLength(2);
    expect(trace.segments[0].conditionsPassed).toBe(true);
    expect(trace.segments[0].bucketed).toBe(true);
    expect(trace.segments[0].bucketVariant).toEqual('treatment');
    // Second segment is still evaluated for trace purposes
    expect(trace.segments[1].segmentName).toEqual('All Other Users');
    expect(trace.segments[1].conditionsPassed).toBe(true);
    expect(trace.segments[1].bucketed).toBe(true);
    expect(trace.segments[1].bucketVariant).toEqual('control');
  });

  it('falls through to second segment when first fails conditions', () => {
    const flag = makeFlag('flag-4', [
      {
        metadata: { segmentName: 'VIP Users' },
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
        metadata: { segmentName: 'All Other Users' },
        variant: 'control',
      },
    ]);

    const context = userContext('u1', { vip: 'false' });
    const { results, traces } = engine.evaluateWithTraces(context, [flag]);

    expect(results['flag-4']?.key).toEqual('control');

    const trace = traces['flag-4'];
    expect(trace.matched).toBe(true);
    expect(trace.matchedSegment).toEqual('All Other Users');
    expect(trace.segments[0].conditionsPassed).toBe(false);
    expect(trace.segments[0].bucketed).toBe(false);
    expect(trace.segments[1].conditionsPassed).toBe(true);
    expect(trace.segments[1].bucketed).toBe(true);
    expect(trace.segments[1].bucketVariant).toEqual('control');
  });

  it('traces multiple segments where none match', () => {
    const flag = makeFlag('flag-5', [
      {
        metadata: { segmentName: 'VIP Users' },
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
        metadata: { segmentName: 'Internal Users' },
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

    const trace = traces['flag-5'];
    expect(trace.matched).toBe(false);
    expect(trace.matchedSegment).toBeUndefined();
    expect(trace.segments).toHaveLength(2);
    expect(trace.segments[0].conditionsPassed).toBe(false);
    expect(trace.segments[0].bucketed).toBe(false);
    expect(trace.segments[1].conditionsPassed).toBe(false);
    expect(trace.segments[1].bucketed).toBe(false);
  });

  it('traces a segment with no conditions (always-match)', () => {
    const flag = makeFlag('flag-6', [
      {
        metadata: { segmentName: 'All Users' },
        variant: 'treatment',
      },
    ]);

    const context = userContext('u1');
    const { results, traces } = engine.evaluateWithTraces(context, [flag]);

    expect(results['flag-6']?.key).toEqual('treatment');

    const trace = traces['flag-6'];
    expect(trace.matched).toBe(true);
    expect(trace.matchedSegment).toEqual('All Users');
    expect(trace.segments[0]).toEqual({
      segmentName: 'All Users',
      conditionsPassed: true,
      bucketed: true,
      bucketVariant: 'treatment',
    });
  });

  it('traces a segment with bucketing miss (allocation out of range)', () => {
    const flag = makeFlag('flag-7', [
      {
        metadata: { segmentName: '0% Rollout' },
        bucket: {
          selector: ['context', 'user', 'user_id'],
          salt: 'test-salt',
          allocations: [
            {
              range: [0, 0],
              distributions: [{ variant: 'treatment', range: [0, 10000] }],
            },
          ],
        },
        variant: 'off',
      },
    ]);

    const context = userContext('u1');
    const { traces } = engine.evaluateWithTraces(context, [flag]);

    // With 0% allocation, bucketing returns the default variant 'off'
    const trace = traces['flag-7'];
    expect(trace.segments[0].conditionsPassed).toBe(true);
    expect(trace.segments[0].bucketed).toBe(true);
    expect(trace.segments[0].bucketVariant).toEqual('off');
  });

  it('traces segment with no segmentName in metadata', () => {
    const flag = makeFlag('flag-8', [
      {
        metadata: { someOtherField: 'value' },
        variant: 'treatment',
      },
    ]);

    const context = userContext('u1');
    const { traces } = engine.evaluateWithTraces(context, [flag]);

    expect(traces['flag-8'].segments[0].segmentName).toBeUndefined();
    expect(traces['flag-8'].matchedSegment).toBeUndefined();
    expect(traces['flag-8'].matched).toBe(true);
  });

  it('merges metadata correctly on the winning variant', () => {
    const flag = makeFlag(
      'flag-9',
      [
        {
          metadata: { segmentName: 'All Users', segmentId: 's1' },
          variant: 'treatment',
        },
      ],
      {
        control: { key: 'control', value: 'control' },
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

    expect(results['flag-9']?.metadata).toEqual({
      flagLevel: true,
      segmentName: 'All Users',
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
        {
          metadata: { segmentName: 'All' },
          variant: 'treatment',
        },
      ]),
      makeFlag('flag-c', [
        {
          metadata: { segmentName: 'Nobody' },
          conditions: [
            [
              {
                selector: ['context', 'user', 'user_properties', 'impossible'],
                op: 'is',
                values: ['yes'],
              },
            ],
          ],
          variant: 'treatment',
        },
      ]),
    ];

    const context = userContext('u1', { beta: 'true' });

    const standardResults = engine.evaluate(context, flags);
    const { results: tracedResults } = engine.evaluateWithTraces(
      context,
      flags,
    );

    expect(Object.keys(tracedResults).sort()).toEqual(
      Object.keys(standardResults).sort(),
    );
    for (const key of Object.keys(standardResults)) {
      expect(tracedResults[key]?.key).toEqual(standardResults[key]?.key);
      expect(tracedResults[key]?.value).toEqual(standardResults[key]?.value);
      expect(tracedResults[key]?.metadata).toEqual(
        standardResults[key]?.metadata,
      );
    }
  });
});
