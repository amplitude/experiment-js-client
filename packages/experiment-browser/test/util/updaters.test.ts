import {
  SdkEvaluationApi,
  SdkStreamEvaluationApi,
} from '@amplitude/experiment-core';
import { FetchError } from '@amplitude/experiment-core';

import {
  RetryAndFallbackWrapperUpdater,
  Updater,
  VariantsFetchUpdater,
  VariantsStreamUpdater,
} from '../..//src/util/updaters';

import { sleep } from './misc';

describe('VariantsStreamUpdater tests', () => {
  test('connect success and receive data', async () => {
    const mockStreamApi = {
      streamVariants: jest.fn(),
      close: jest.fn(),
    };
    const updater = new VariantsStreamUpdater(mockStreamApi);
    const onUpdate = jest.fn();
    await updater.start(onUpdate, jest.fn(), {
      user: {},
      config: {},
      options: {},
    });

    expect(onUpdate).toHaveBeenCalledTimes(0);
    await mockStreamApi.streamVariants.mock.lastCall[2]({
      'test-flag': {},
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    await mockStreamApi.streamVariants.mock.lastCall[2]({
      'test-flag': {},
    });
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  test('connect error throws', async () => {
    const mockStreamApi = {
      streamVariants: jest
        .fn()
        .mockRejectedValue(new FetchError(413, 'Payload too large')),
      close: jest.fn(),
    } as unknown as SdkStreamEvaluationApi;
    const updater = new VariantsStreamUpdater(mockStreamApi);
    const onUpdate = jest.fn();
    await expect(
      updater.start(onUpdate, jest.fn(), {
        user: {},
        config: {},
        options: {},
      }),
    ).rejects.toThrow('Payload too large');
    expect(onUpdate).toHaveBeenCalledTimes(0);
    expect(updater['hasNonretriableError']).toBe(true);
  });

  test('connect success then stream error', async () => {
    let registeredOnUpdate;
    let registeredOnError;
    const mockStreamApi = {
      streamVariants: jest.fn(
        async (
          _: unknown,
          __: unknown,
          onUpdate: (data) => void,
          onError: (error) => void,
        ) => {
          registeredOnUpdate = onUpdate;
          registeredOnError = onError;
        },
      ),
      close: jest.fn(),
    };
    const updater = new VariantsStreamUpdater(mockStreamApi);
    const onUpdate = jest.fn();
    const onError = jest.fn();
    await updater.start(onUpdate, onError, {
      user: {},
      config: {},
      options: {},
    });

    mockStreamApi.streamVariants.mock.lastCall[2]({ 'test-flag': {} });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(mockStreamApi.close).toHaveBeenCalledTimes(1); // Close called once on start.
    await mockStreamApi.streamVariants.mock.lastCall[3](
      new Error('Stream error'),
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(mockStreamApi.close).toHaveBeenCalledTimes(2); // Close called again on error.
    expect(updater['hasNonretriableError']).toBe(false);
  });

  test('connect success then re-start with same params, should not reconnect', async () => {
    const mockStreamApi = {
      streamVariants: jest.fn(),
      close: jest.fn(),
    };
    const updater = new VariantsStreamUpdater(mockStreamApi);
    const onUpdate = jest.fn();
    await updater.start(onUpdate, jest.fn(), {
      user: {},
      config: {},
      options: {},
    });
    expect(mockStreamApi.streamVariants).toHaveBeenCalledTimes(1);
    mockStreamApi.streamVariants.mock.lastCall[2]({ 'test-flag': {} });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(mockStreamApi.close).toHaveBeenCalledTimes(1);

    const onUpdate2 = jest.fn();
    await updater.start(onUpdate2, jest.fn(), {
      user: {},
      config: {},
      options: {},
    });
    expect(mockStreamApi.streamVariants).toHaveBeenCalledTimes(1);
    mockStreamApi.streamVariants.mock.lastCall[2]({ 'test-flag': {} });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate2).toHaveBeenCalledTimes(1);
    expect(mockStreamApi.close).toHaveBeenCalledTimes(1);
  });

  test('connect success then params change, should reconnect', async () => {
    const mockStreamApi = {
      streamVariants: jest.fn(),
      close: jest.fn(),
    };
    const updater = new VariantsStreamUpdater(mockStreamApi);
    const onUpdate = jest.fn();
    await updater.start(onUpdate, jest.fn(), {
      user: {},
      config: {},
      options: {},
    });
    expect(mockStreamApi.streamVariants).toHaveBeenCalledTimes(1);
    mockStreamApi.streamVariants.mock.lastCall[2]({ 'test-flag': {} });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(mockStreamApi.close).toHaveBeenCalledTimes(1);

    const onUpdate2 = jest.fn();
    await updater.start(onUpdate2, jest.fn(), {
      user: {user_id: '123'},
      config: {},
      options: {},
    });
    expect(mockStreamApi.streamVariants).toHaveBeenCalledTimes(2);
    mockStreamApi.streamVariants.mock.lastCall[2]({ 'test-flag': {} });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate2).toHaveBeenCalledTimes(1);
    expect(mockStreamApi.close).toHaveBeenCalledTimes(2);
  });
});

describe('VariantsFetchUpdater tests', () => {
  test('fetches variant', async () => {
    const mockEvalApi = {
      getVariants: jest.fn(async () => {
        return {
          'test-flag': {},
        };
      }),
    };
    const updater = new VariantsFetchUpdater(mockEvalApi);
    const onUpdate = jest.fn();
    const onError = jest.fn();
    await updater.start(onUpdate, onError, {
      user: {},
      config: {},
      options: {},
    });
    expect(mockEvalApi.getVariants).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      'test-flag': {},
    });
    await updater.start(onUpdate, onError, {
      user: {},
      config: {},
      options: {},
    });
    expect(mockEvalApi.getVariants).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledWith({
      'test-flag': {},
    });
    expect(onError).toHaveBeenCalledTimes(0);
  });

  test('first fetch failed retriable would retry but does not throw', async () => {
    const mockEvalApi = {
      getVariants: jest
        .fn()
        .mockRejectedValueOnce(new FetchError(500, 'Internal Server Error'))
        .mockResolvedValueOnce({
          'test-flag': {},
        }),
    };
    const updater = new VariantsFetchUpdater(mockEvalApi);
    const onUpdate = jest.fn();
    const onError = jest.fn();
    await updater.start(onUpdate, onError, {
      user: {},
      config: { retryFetchOnFailure: true },
      options: {},
    });
    expect(mockEvalApi.getVariants).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(0);
    await sleep(750);
    expect(mockEvalApi.getVariants).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      'test-flag': {},
    });
    expect(onError).toHaveBeenCalledTimes(0);
  });

  test('first fetch failed nonretriable would not retry and does not throw', async () => {
    const mockEvalApi = {
      getVariants: jest
        .fn()
        .mockRejectedValue(new FetchError(413, 'Payload too large')),
    };
    const updater = new VariantsFetchUpdater(mockEvalApi);
    const onUpdate = jest.fn();
    const onError = jest.fn();
    await updater.start(onUpdate, onError, {
      user: {},
      config: { retryFetchOnFailure: true },
      options: {},
    });
    expect(mockEvalApi.getVariants).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(0);
    await sleep(2000);
    expect(mockEvalApi.getVariants).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(0);
    expect(onError).toHaveBeenCalledTimes(0);
  });

  test('all fetches fails does nothing', async () => {
    const mockEvalApi = {
      getVariants: jest
        .fn()
        .mockRejectedValue(new FetchError(500, 'Internal Server Error')),
    };
    const updater = new VariantsFetchUpdater(mockEvalApi);
    const onUpdate = jest.fn();
    const onError = jest.fn();
    await updater.start(onUpdate, onError, {
      user: {},
      config: { retryFetchOnFailure: true },
      options: {},
    });
    expect(mockEvalApi.getVariants).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(0);
    await sleep(20000);
    expect(mockEvalApi.getVariants).toHaveBeenCalledTimes(8);
    expect(onUpdate).toHaveBeenCalledTimes(0);
    expect(onError).toHaveBeenCalledTimes(0);
  }, 30000);
});

describe('RetryAndFallbackWrapperUpdater tests', () => {
  test('main start success, no fallback start, wrapper start success', async () => {
    const mainUpdater = {
      start: jest.fn(),
      stop: jest.fn(),
    };
    const fallbackUpdater = {
      start: jest.fn(),
      stop: jest.fn(),
    };
    const wrapperUpdater = new RetryAndFallbackWrapperUpdater(
      mainUpdater as Updater,
      fallbackUpdater as Updater,
      2000,
    );
    const onUpdate = jest.fn();
    await wrapperUpdater.start(onUpdate, jest.fn(), {});
    expect(mainUpdater.start).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(0);
    // Verify data flows.
    mainUpdater.start.mock.lastCall[0]('asdf');
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('asdf');
    // Reset stop function mocks to reset called times.
    mainUpdater.stop = jest.fn();
    fallbackUpdater.stop = jest.fn();
    await wrapperUpdater.stop();
    expect(mainUpdater.stop).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.stop).toHaveBeenCalledTimes(1);
  });

  test('main start failed, fallback start success, wrapper start success', async () => {
    const mainUpdater = {
      start: jest.fn().mockRejectedValue(new Error('Main updater error')),
      stop: jest.fn(),
    };
    const fallbackUpdater = {
      start: jest.fn(),
      stop: jest.fn(),
    };
    const wrapperUpdater = new RetryAndFallbackWrapperUpdater(
      mainUpdater as Updater,
      fallbackUpdater as Updater,
      2000,
    );
    const onUpdate = jest.fn();
    await wrapperUpdater.start(onUpdate, jest.fn(), {});
    expect(mainUpdater.start).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(1);
    // Verify data flows.
    fallbackUpdater.start.mock.lastCall[0]('asdf');
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('asdf');
    // Reset stop function mocks to reset called times.
    mainUpdater.stop = jest.fn();
    fallbackUpdater.stop = jest.fn();
    await wrapperUpdater.stop();
    expect(mainUpdater.stop).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.stop).toHaveBeenCalledTimes(1);
  });

  test('main start failed, fallback start failed, wrapper start fail', async () => {
    const mainUpdater = {
      start: jest.fn().mockRejectedValue(new Error('Main updater error')),
      stop: jest.fn(),
    };
    const fallbackUpdater = {
      start: jest.fn().mockRejectedValue(new Error('Fallback updater error')),
      stop: jest.fn(),
    };
    const wrapperUpdater = new RetryAndFallbackWrapperUpdater(
      mainUpdater,
      fallbackUpdater,
      2000,
    );
    await expect(
      wrapperUpdater.start(jest.fn(), jest.fn(), {}),
    ).rejects.toThrow('Fallback updater error');
  });

  test('main start success, then failed, fallback starts, main retry success, fallback stopped', async () => {
    const mainUpdater = {
      start: jest.fn(),
      stop: jest.fn(),
    };
    const fallbackUpdater = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
    };
    const wrapperUpdater = new RetryAndFallbackWrapperUpdater(
      mainUpdater,
      fallbackUpdater,
      4000,
    );
    const onUpdate = jest.fn();
    await wrapperUpdater.start(onUpdate, jest.fn(), {});
    expect(mainUpdater.start).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(0);
    // Verify data flows.
    mainUpdater.start.mock.lastCall[0]('asdf');
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('asdf');
    // Signal main updater to fail.
    mainUpdater.start.mock.lastCall[1](new Error('Main updater error'));
    expect(mainUpdater.start).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(1);
    // Verify data flows.
    fallbackUpdater.start.mock.lastCall[0]('fallback data');
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledWith('fallback data');
    // Wait for retry.
    await sleep(5000);
    expect(mainUpdater.start).toHaveBeenCalledTimes(2);
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(1);
    // Verify data flows.
    mainUpdater.start.mock.lastCall[0]('main data');
    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(onUpdate).toHaveBeenCalledWith('main data');
    // Reset stop function mocks to reset called times.
    mainUpdater.stop = jest.fn();
    fallbackUpdater.stop = jest.fn();
    await wrapperUpdater.stop();
    expect(mainUpdater.stop).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.stop).toHaveBeenCalledTimes(1);
  });

  test('main start success, then failed, fallback start failed, fallback retry success, main retry success, fallback stopped', async () => {
    const mainUpdater = {
      start: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(undefined)
        .mockResolvedValueOnce(undefined),
      stop: jest.fn(),
    };
    const fallbackUpdater = {
      start: jest
        .fn()
        .mockRejectedValueOnce(new Error('Fallback start error'))
        .mockResolvedValueOnce(undefined),
      stop: jest.fn(),
    };
    const wrapperUpdater = new RetryAndFallbackWrapperUpdater(
      mainUpdater,
      fallbackUpdater,
      4000,
    );
    const onUpdate = jest.fn();
    await wrapperUpdater.start(onUpdate, jest.fn(), {});
    expect(mainUpdater.start).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(0);
    // Verify data flows.
    mainUpdater.start.mock.lastCall[0]('asdf');
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('asdf');
    // Signal main updater to fail.
    mainUpdater.start.mock.lastCall[1](new Error('Main updater error'));
    expect(mainUpdater.start).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(1);
    // Wait for main and fallback retry.
    await sleep(5000);
    expect(mainUpdater.start).toHaveBeenCalledTimes(2); // Main still failed to start.
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(2); // Fallback would start success.
    // Verify data flows through fallback.
    fallbackUpdater.start.mock.lastCall[0]('fallback data');
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledWith('fallback data');
    // Wait for main retry.
    fallbackUpdater.stop = jest.fn(); // Reset fallback stop counter.
    await sleep(5000);
    expect(mainUpdater.start).toHaveBeenCalledTimes(3); // Main success.
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(2); // No more fallback retry.
    expect(fallbackUpdater.stop).toHaveBeenCalledTimes(1); // Verify fallback stopped.
    // Verify data flows.
    mainUpdater.start.mock.lastCall[0]('main data');
    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(onUpdate).toHaveBeenCalledWith('main data');
    // Reset stop function mocks to reset called times.
    mainUpdater.stop = jest.fn();
    fallbackUpdater.stop = jest.fn();
    await wrapperUpdater.stop();
    expect(mainUpdater.stop).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.stop).toHaveBeenCalledTimes(1);
  }, 15000);

  test('main start success, then failed, fallback start failed, main retry success, fallback stopped retrying', async () => {
    const mainUpdater = {
      start: jest.fn(),
      stop: jest.fn(),
    };
    const fallbackUpdater = {
      start: jest.fn(async () => {
        await sleep(2500);
        throw new Error('Fallback start error');
      }),
      stop: jest.fn(),
    };
    const wrapperUpdater = new RetryAndFallbackWrapperUpdater(
      mainUpdater,
      fallbackUpdater,
      4000,
    );
    const onUpdate = jest.fn();
    await wrapperUpdater.start(onUpdate, jest.fn(), {});
    expect(mainUpdater.start).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(0);
    // Verify data flows.
    mainUpdater.start.mock.lastCall[0]('asdf');
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('asdf');
    // Signal main updater to fail.
    mainUpdater.start.mock.lastCall[1](new Error('Main updater error'));
    expect(mainUpdater.start).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(1);
    // Ensure fallback updater failed and enters retry.
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(1);
    // Wait for main retry.
    await sleep(5000);
    expect(mainUpdater.start).toHaveBeenCalledTimes(2);
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(1);
    // Verify data flows.
    mainUpdater.start.mock.lastCall[0]('main data');
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledWith('main data');
    // Make sure fallback stopped retrying.
    await sleep(5000);
    expect(fallbackUpdater.start).toHaveBeenCalledTimes(1);
    // Reset stop function mocks to reset called times.
    mainUpdater.stop = jest.fn();
    fallbackUpdater.stop = jest.fn();
    await wrapperUpdater.stop();
    expect(mainUpdater.stop).toHaveBeenCalledTimes(1);
    expect(fallbackUpdater.stop).toHaveBeenCalledTimes(1);
  }, 15000);
});
