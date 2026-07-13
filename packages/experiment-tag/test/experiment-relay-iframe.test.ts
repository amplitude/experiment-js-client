import * as experimentCore from '@amplitude/experiment-core';
import { EvaluationOperator } from '@amplitude/experiment-core';
import { ExperimentClient } from '@amplitude/experiment-js-client';
import { stringify } from 'ts-jest';

import { createPageObject } from './util/create-page-object';
import { createMockGlobal, setupGlobalObservers } from './util/mocks';

import { RelayClient } from 'src/behavioral-targeting/relay-client';
import { DefaultWebExperimentClient } from 'src/experiment';

const mockRelayInit = jest.fn().mockResolvedValue(undefined);
const mockRelayDestroy = jest.fn();
const mockRelayWaitForAvailable = jest.fn().mockResolvedValue(false);

jest.mock('src/behavioral-targeting/relay-client', () => {
  const actual = jest.requireActual('src/behavioral-targeting/relay-client');
  return {
    ...actual,
    RelayClient: jest.fn().mockImplementation(() => ({
      init: mockRelayInit,
      destroy: mockRelayDestroy,
      relayAvailable: false,
      waitForAvailable: mockRelayWaitForAvailable,
    })),
  };
});

setupGlobalObservers();

describe('DefaultWebExperimentClient relay iframe', () => {
  let apiKey = 0;
  const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
  let mockGlobal: ReturnType<typeof createMockGlobal>;

  beforeEach(() => {
    apiKey++;
    jest.clearAllMocks();
    jest.spyOn(experimentCore, 'isLocalStorageAvailable').mockReturnValue(true);
    mockGlobal = createMockGlobal();
    mockGetGlobalScope.mockReturnValue(
      mockGlobal as unknown as typeof globalThis,
    );
    jest.spyOn(ExperimentClient.prototype, 'setUser').mockImplementation();
    jest.spyOn(ExperimentClient.prototype, 'all').mockReturnValue({});
    jest
      .spyOn(ExperimentClient.prototype, 'fetch')
      .mockResolvedValue({} as never);
  });

  test('starts relay sync when behavioral targeting rules are present', async () => {
    const key = stringify(apiKey);
    const behavioralTargetingRules = {
      flag_a: {
        behavior_1: [
          [
            {
              condition: {
                type: 'behavior',
                event_type: 'click',
                op: EvaluationOperator.GREATER_THAN_EQUALS,
                value: 1,
                time_type: 'rolling',
                time_value: 7,
                interval: 'day',
              },
            },
          ],
        ],
      },
    };

    const client = DefaultWebExperimentClient.getInstance(key, {
      initialFlags: JSON.stringify([]),
      pageObjects: JSON.stringify({
        flag_a: createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
      }),
      behavioralTargetingRules: JSON.stringify(behavioralTargetingRules),
    });

    mockGlobal.localStorage.getItem.mockImplementation((storageKey: string) => {
      if (storageKey === `EXP_${key.slice(0, 10)}`) {
        return JSON.stringify({
          web_exp_id: 'oeu1383080393924r0-5047421827912331',
        });
      }
      return null;
    });

    await client.start();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(RelayClient).toHaveBeenCalledWith(
      key,
      'oeu1383080393924r0-5047421827912331',
      expect.stringContaining('.relay.html'),
    );
    expect(mockRelayInit).toHaveBeenCalled();
    expect(mockRelayWaitForAvailable).toHaveBeenCalled();
    expect(mockRelayDestroy).toHaveBeenCalled();
  });

  test('runs relay sync in preview mode (non-previewed behavioral flags still need it)', async () => {
    const key = stringify(apiKey);
    const behavioralTargetingRules = {
      flag_a: {
        behavior_1: [
          [
            {
              condition: {
                type: 'behavior',
                event_type: 'click',
                op: EvaluationOperator.GREATER_THAN_EQUALS,
                value: 1,
                time_type: 'rolling',
                time_value: 7,
                interval: 'day',
              },
            },
          ],
        ],
      },
    };

    // Preview a different flag (flag_b); flag_a evaluates normally and must
    // still get the cross-subdomain relay merge.
    mockGlobal = createMockGlobal({
      location: {
        href: 'http://test.com/?PREVIEW=true&flag_b=treatment',
        search: '?PREVIEW=true&flag_b=treatment',
      },
    });
    mockGetGlobalScope.mockReturnValue(
      mockGlobal as unknown as typeof globalThis,
    );
    mockGlobal.localStorage.getItem.mockImplementation((storageKey: string) => {
      if (storageKey === `EXP_${key.slice(0, 10)}`) {
        return JSON.stringify({
          web_exp_id: 'oeu1383080393924r0-5047421827912331',
        });
      }
      return null;
    });

    const client = DefaultWebExperimentClient.getInstance(key, {
      initialFlags: JSON.stringify([]),
      pageObjects: JSON.stringify({
        flag_a: createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
      }),
      behavioralTargetingRules: JSON.stringify(behavioralTargetingRules),
    });

    await client.start();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Preview mode must NOT disable relay sync wholesale.
    expect(RelayClient).toHaveBeenCalledWith(
      key,
      'oeu1383080393924r0-5047421827912331',
      expect.stringContaining('.relay.html'),
    );
    expect(mockRelayInit).toHaveBeenCalled();
  });

  test('skips relay sync when there are no behavioral targeting rules', async () => {
    const key = stringify(apiKey);
    const client = DefaultWebExperimentClient.getInstance(key, {
      initialFlags: JSON.stringify([]),
      pageObjects: JSON.stringify({}),
    });

    await client.start();

    expect(RelayClient).not.toHaveBeenCalled();
    expect(mockRelayInit).not.toHaveBeenCalled();
  });
});
