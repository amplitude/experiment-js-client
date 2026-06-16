import * as experimentCore from '@amplitude/experiment-core';
import { EvaluationOperator } from '@amplitude/experiment-core';
import { ExperimentClient } from '@amplitude/experiment-js-client';
import { RelayClient } from 'src/behavioral-targeting/relay-client';
import { DefaultWebExperimentClient } from 'src/experiment';
import { stringify } from 'ts-jest';

import { createPageObject } from './util/create-page-object';
import { createMockGlobal, setupGlobalObservers } from './util/mocks';

const mockRelayInit = jest.fn().mockResolvedValue(undefined);
const mockRelayDestroy = jest.fn();

jest.mock('src/behavioral-targeting/relay-client', () => {
  const actual = jest.requireActual('src/behavioral-targeting/relay-client');
  return {
    ...actual,
    RelayClient: jest.fn().mockImplementation(() => ({
      init: mockRelayInit,
      destroy: mockRelayDestroy,
      relayAvailable: false,
    })),
  };
});

setupGlobalObservers();

describe('DefaultWebExperimentClient relay iframe (WEB-130)', () => {
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
