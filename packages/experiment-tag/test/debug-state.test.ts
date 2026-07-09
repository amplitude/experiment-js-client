import * as experimentCore from '@amplitude/experiment-core';
import { ExperimentClient } from '@amplitude/experiment-js-client';
import { stringify } from 'ts-jest';

import { createMockGlobal, setupGlobalObservers } from './util/mocks';

import {
  buildFlagDependencyInfo,
  classifyDependency,
  computeInactiveReason,
  DefaultWebExperimentClient,
} from 'src/experiment';
import * as uuid from 'src/util/uuid';

let apiKey = 9000;

jest.mock('src/util/messenger', () => ({
  WindowMessenger: { setup: jest.fn() },
}));

setupGlobalObservers();

describe('buildFlagDebugInfo audienceEvaluation', () => {
  const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
  jest.spyOn(ExperimentClient.prototype, 'setUser');
  jest.spyOn(ExperimentClient.prototype, 'all');
  jest.spyOn(uuid, 'UUID').mockReturnValue('mock');
  let mockGlobal;

  beforeEach(() => {
    apiKey++;
    jest.clearAllMocks();
    jest.spyOn(experimentCore, 'isLocalStorageAvailable').mockReturnValue(true);
    mockGlobal = createMockGlobal({ __AMP_DEBUG: true });
    mockGetGlobalScope.mockReturnValue(mockGlobal);
  });

  it('populates audienceEvaluation with steps for a local flag', async () => {
    const flags = [
      {
        key: 'flag-single',
        metadata: {
          deployed: true,
          evaluationMode: 'local',
          flagType: 'experiment',
          deliveryMethod: 'web',
        },
        segments: [
          { metadata: { segmentName: 'All Users' }, variant: 'treatment' },
        ],
        variants: {
          off: { key: 'off', metadata: { default: true } },
          treatment: {
            key: 'treatment',
            value: 'treatment',
            payload: [{ action: 'mutate', data: { mutations: [] } }],
          },
        },
      },
    ];

    const client = DefaultWebExperimentClient.getInstance(stringify(apiKey), {
      initialFlags: JSON.stringify(flags),
      pageObjects: JSON.stringify({}),
    });
    await client.start();

    const state = client.getDebugState();
    const flagInfo = state.flags['flag-single'];

    expect(flagInfo).toBeDefined();
    const audienceEval = flagInfo.audienceEvaluation;
    if (!audienceEval) throw new Error('expected audienceEvaluation');
    expect(audienceEval.matched).toBe(true);
    expect(audienceEval.matchedSegment).toEqual('All Users');
    expect(audienceEval.steps).toHaveLength(1);
    expect(audienceEval.steps[0].matched).toBe(true);
    expect(audienceEval.steps[0].conditionsPassed).toBe(true);
    expect(audienceEval.steps[0].bucketed).toBe(true);
    expect(audienceEval.steps[0].bucketVariant).toEqual('treatment');
    expect(audienceEval.steps[0].segmentMetadata).toEqual({
      segmentName: 'All Users',
    });
  });

  it('populates audienceEvaluation with per-condition detail for multi-segment flag', async () => {
    const flags = [
      {
        key: 'flag-multi',
        metadata: {
          deployed: true,
          evaluationMode: 'local',
          flagType: 'experiment',
          deliveryMethod: 'web',
        },
        segments: [
          {
            metadata: { segmentName: 'VIP Only' },
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
        ],
        variants: {
          off: { key: 'off', metadata: { default: true } },
          control: {
            key: 'control',
            value: 'control',
            payload: [{ action: 'mutate', data: { mutations: [] } }],
          },
          treatment: {
            key: 'treatment',
            value: 'treatment',
            payload: [{ action: 'mutate', data: { mutations: [] } }],
          },
        },
      },
    ];

    const client = DefaultWebExperimentClient.getInstance(stringify(apiKey), {
      initialFlags: JSON.stringify(flags),
      pageObjects: JSON.stringify({}),
    });
    await client.start();

    const state = client.getDebugState();
    const flagInfo = state.flags['flag-multi'];

    const audienceEval = flagInfo.audienceEvaluation;
    if (!audienceEval) throw new Error('expected audienceEvaluation');
    expect(audienceEval.matched).toBe(true);
    expect(audienceEval.matchedSegment).toEqual('All Other Users');
    expect(audienceEval.steps).toHaveLength(2);
    expect(audienceEval.steps[0].matched).toBe(false);
    expect(audienceEval.steps[0].conditionsPassed).toBe(false);
    expect(audienceEval.steps[0].bucketed).toBe(false);
    expect(audienceEval.steps[0].bucketVariant).toBeUndefined();
    expect(audienceEval.steps[1].matched).toBe(true);
    expect(audienceEval.steps[1].conditionsPassed).toBe(true);
    expect(audienceEval.steps[1].bucketed).toBe(true);
    expect(audienceEval.steps[1].bucketVariant).toEqual('control');
  });

  it('populates audienceEvaluation from variant metadata for remote flags', async () => {
    const flags = [
      {
        key: 'flag-remote',
        metadata: {
          deployed: true,
          evaluationMode: 'remote',
          flagType: 'experiment',
          deliveryMethod: 'web',
        },
        segments: [{ metadata: { segmentName: 'All Users' }, variant: 'off' }],
        variants: {
          off: { key: 'off', metadata: { default: true } },
          treatment: { key: 'treatment', value: 'treatment' },
        },
      },
    ];

    const client = DefaultWebExperimentClient.getInstance(stringify(apiKey), {
      initialFlags: JSON.stringify(flags),
      pageObjects: JSON.stringify({}),
    });
    await client.start();

    const state = client.getDebugState();
    const flagInfo = state.flags['flag-remote'];

    expect(flagInfo).toBeDefined();
    const audienceEval = flagInfo.audienceEvaluation;
    if (!audienceEval) throw new Error('expected audienceEvaluation');
    expect(audienceEval.matched).toBe(true);
    expect(audienceEval.matchedSegment).toEqual('All Users');
    expect(audienceEval.steps).toEqual([]);
  });
});

describe('buildFlagDebugInfo dependencies', () => {
  const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
  jest.spyOn(uuid, 'UUID').mockReturnValue('mock');
  let mockGlobal;

  beforeEach(() => {
    apiKey++;
    jest.clearAllMocks();
    jest.spyOn(experimentCore, 'isLocalStorageAvailable').mockReturnValue(true);
    mockGlobal = createMockGlobal({ __AMP_DEBUG: true });
    mockGetGlobalScope.mockReturnValue(mockGlobal);
  });

  const localMeta = {
    deployed: true,
    evaluationMode: 'local',
    flagType: 'experiment',
    deliveryMethod: 'web',
  };
  const onOffVariants = {
    off: { key: 'off', metadata: { default: true } },
    treatment: {
      key: 'treatment',
      value: 'treatment',
      payload: [{ action: 'mutate', data: { mutations: [] } }],
    },
  };

  // A child flag that only resolves to `treatment` when parent `parentKey`
  // resolved to `treatment` (a `result` dependency condition).
  const childDependentOn = (childKey: string, parentKey: string) => ({
    key: childKey,
    metadata: localMeta,
    dependencies: [parentKey],
    segments: [
      {
        metadata: { segmentName: 'Prereq met' },
        conditions: [
          [
            {
              selector: ['result', parentKey, 'key'],
              op: 'is',
              values: ['treatment'],
            },
          ],
        ],
        variant: 'treatment',
      },
      // Fallthrough to the default variant when the prereq is not met, mirroring
      // how real flags always end with a catch-all segment.
      { metadata: { segmentName: 'default' }, variant: 'off' },
    ],
    variants: onOffVariants,
  });

  const startClient = async (flags: unknown[]) => {
    const client = DefaultWebExperimentClient.getInstance(stringify(apiKey), {
      initialFlags: JSON.stringify(flags),
      pageObjects: JSON.stringify({}),
    });
    await client.start();
    return client;
  };

  it('surfaces flagMetadata and a non-blocking dependency when the prereq is met', async () => {
    const flags = [
      {
        key: 'prereq-flag',
        metadata: localMeta,
        segments: [
          { metadata: { segmentName: 'All Users' }, variant: 'treatment' },
        ],
        variants: onOffVariants,
      },
      childDependentOn('child-flag', 'prereq-flag'),
    ];

    const client = await startClient(flags);
    const child = client.getDebugState().flags['child-flag'];

    expect(child.variant?.key).toEqual('treatment');
    expect(child.flagMetadata).toEqual(localMeta);
    expect(child.dependencies).toEqual([
      {
        flagKey: 'prereq-flag',
        type: 'prerequisite',
        resolvedVariant: 'treatment',
        blocking: false,
      },
    ]);
    expect(child.inactiveReason).toBeUndefined();
  });

  it('marks a prerequisite blocking and reports it as the inactive reason', async () => {
    const flags = [
      {
        key: 'prereq-flag',
        metadata: localMeta,
        // Parent resolves to `off`, so the child's prereq condition fails.
        segments: [{ metadata: { segmentName: 'All Users' }, variant: 'off' }],
        variants: onOffVariants,
      },
      childDependentOn('child-flag', 'prereq-flag'),
    ];

    const client = await startClient(flags);
    const child = client.getDebugState().flags['child-flag'];

    expect(child.variant?.key).not.toEqual('treatment');
    expect(child.dependencies).toEqual([
      {
        flagKey: 'prereq-flag',
        type: 'prerequisite',
        resolvedVariant: 'off',
        blocking: true,
      },
    ]);
    expect(child.inactiveReason).toEqual('Prerequisite "prereq-flag" = off');
  });

  it('classifies and attributes a holdout dependency', async () => {
    const flags = [
      {
        key: 'holdout-abc',
        metadata: localMeta,
        // Held out: parent is not `treatment`, so the child is excluded.
        segments: [{ metadata: { segmentName: 'Holdout' }, variant: 'off' }],
        variants: onOffVariants,
      },
      childDependentOn('held-flag', 'holdout-abc'),
    ];

    const client = await startClient(flags);
    const child = client.getDebugState().flags['held-flag'];

    expect(child.dependencies?.[0]).toEqual({
      flagKey: 'holdout-abc',
      type: 'holdout',
      resolvedVariant: 'off',
      blocking: true,
    });
    expect(child.inactiveReason).toEqual('Held out by "holdout-abc"');
  });

  it('omits dependency fields for flags without dependencies', async () => {
    const flags = [
      {
        key: 'standalone',
        metadata: localMeta,
        segments: [
          { metadata: { segmentName: 'All Users' }, variant: 'treatment' },
        ],
        variants: onOffVariants,
      },
    ];

    const client = await startClient(flags);
    const flag = client.getDebugState().flags['standalone'];

    expect(flag.dependencies).toBeUndefined();
    expect(flag.inactiveReason).toBeUndefined();
    expect(flag.flagMetadata).toEqual(localMeta);
  });
});

describe('dependency debug helpers', () => {
  it('classifyDependency keys off the flag-key convention', () => {
    expect(classifyDependency('holdout-123')).toEqual('holdout');
    expect(classifyDependency('mutex-abc')).toEqual('mutex');
    expect(classifyDependency('my-experiment')).toEqual('prerequisite');
  });

  it('buildFlagDependencyInfo returns undefined without dependencies', () => {
    expect(
      buildFlagDependencyInfo(
        { key: 'f', variants: {}, segments: [] },
        {},
        undefined,
        false,
      ),
    ).toBeUndefined();
    expect(
      buildFlagDependencyInfo(undefined, {}, undefined, false),
    ).toBeUndefined();
  });

  it('buildFlagDependencyInfo stays conservative without a trace (remote flags)', () => {
    const deps = buildFlagDependencyInfo(
      { key: 'child', variants: {}, segments: [], dependencies: ['mutex-x'] },
      { 'mutex-x': { key: 'other' } },
      undefined,
      false,
    );
    expect(deps).toEqual([
      {
        flagKey: 'mutex-x',
        type: 'mutex',
        resolvedVariant: 'other',
        blocking: false,
      },
    ]);
  });

  it('computeInactiveReason prioritizes a blocking mutex dependency', () => {
    expect(
      computeInactiveReason(false, 'off', undefined, [
        {
          flagKey: 'mutex-x',
          type: 'mutex',
          resolvedVariant: 'slot-2',
          blocking: true,
        },
      ]),
    ).toEqual('Mutually excluded by "mutex-x"');
  });

  it('computeInactiveReason falls back to audience and variant reasons', () => {
    expect(
      computeInactiveReason(
        false,
        'off',
        { matched: false, steps: [] },
        undefined,
      ),
    ).toEqual('Audience not matched');
    expect(
      computeInactiveReason(false, undefined, undefined, undefined),
    ).toEqual('No variant assigned');
    expect(
      computeInactiveReason(true, 'treatment', undefined, undefined),
    ).toBeUndefined();
  });
});
