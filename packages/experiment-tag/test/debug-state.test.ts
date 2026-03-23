import * as experimentCore from '@amplitude/experiment-core';
import { ExperimentClient } from '@amplitude/experiment-js-client';
import { stringify } from 'ts-jest';
import { DefaultWebExperimentClient } from 'src/experiment';
import * as uuid from 'src/util/uuid';

import { createMockGlobal, setupGlobalObservers } from './util/mocks';

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

  it('populates audienceEvaluation for a local flag with a single always-match segment', async () => {
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

    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(flags),
      JSON.stringify({}),
    );
    await client.start();

    const state = client.getDebugState();
    const flagInfo = state.flags['flag-single'];

    expect(flagInfo).toBeDefined();

    const audienceEval = flagInfo.audienceEvaluation;
    if (!audienceEval) throw new Error('expected audienceEvaluation');
    expect(audienceEval.matched).toBe(true);
    expect(audienceEval.matchedSegment).toEqual('All Users');
    expect(audienceEval.segments).toHaveLength(1);
    expect(audienceEval.segments[0]).toEqual({
      segmentName: 'All Users',
      conditionsPassed: true,
      bucketed: true,
      bucketVariant: 'treatment',
    });
  });

  it('populates audienceEvaluation with multiple segments showing pass/fail', async () => {
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

    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(flags),
      JSON.stringify({}),
    );
    await client.start();

    const state = client.getDebugState();
    const flagInfo = state.flags['flag-multi'];

    const audienceEval = flagInfo.audienceEvaluation;
    if (!audienceEval) throw new Error('expected audienceEvaluation');
    // User has no vip property, so first segment fails, second matches
    expect(audienceEval.matched).toBe(true);
    expect(audienceEval.matchedSegment).toEqual('All Other Users');
    expect(audienceEval.segments).toHaveLength(2);
    expect(audienceEval.segments[0].segmentName).toEqual('VIP Only');
    expect(audienceEval.segments[0].conditionsPassed).toBe(false);
    expect(audienceEval.segments[0].bucketed).toBe(false);
    expect(audienceEval.segments[1].segmentName).toEqual('All Other Users');
    expect(audienceEval.segments[1].conditionsPassed).toBe(true);
    expect(audienceEval.segments[1].bucketed).toBe(true);
    expect(audienceEval.segments[1].bucketVariant).toEqual('control');
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

    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(flags),
      JSON.stringify({}),
    );
    await client.start();

    const state = client.getDebugState();
    const flagInfo = state.flags['flag-remote'];

    expect(flagInfo).toBeDefined();
    // Remote flags use the metadata fallback path (no full segment traces)
    const audienceEval = flagInfo.audienceEvaluation;
    if (!audienceEval) throw new Error('expected audienceEvaluation');
    expect(audienceEval.matched).toBe(true);
    expect(audienceEval.matchedSegment).toEqual('All Users');
    expect(audienceEval.segments).toEqual([]);
  });
});
