import { AnalyticsConnector } from '@amplitude/analytics-connector';
import {
  FetchError,
  safeGlobal,
  TimeoutError,
} from '@amplitude/experiment-core';
import { ExperimentEvent, IntegrationPlugin } from 'src/types/plugin';

import { version as PACKAGE_VERSION } from '../package.json';
import {
  ExperimentAnalyticsProvider,
  ExperimentClient,
  ExperimentUser,
  ExperimentUserProvider,
  Exposure,
  ExposureTrackingProvider,
  FetchOptions,
  Source,
  Variant,
  Variants,
} from '../src';
import { HttpClient, SimpleResponse } from '../src/types/transport';
import { randomString } from '../src/util/randomstring';

import { mockClientStorage } from './util/mock';

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

class TestUserProvider implements ExperimentUserProvider {
  getUser(): ExperimentUser {
    return { user_id: `${randomString(32)}` };
  }
}

const API_KEY = 'client-DvWljIjiiuqLbyjqdvBaLFfEBrAvGuA3';
const SERVER_API_KEY = 'server-qz35UwzJ5akieoAdIgzM4m9MIiOLXLoz';

const testUser: ExperimentUser = { user_id: 'test_user' };

const serverKey = 'sdk-ci-test';
const serverVariant: Variant = { key: 'on', value: 'on', payload: 'payload' };
const serverOffVariant: Variant = { key: 'off', value: 'off' };

const initialKey = 'initial-key';
const initialVariant: Variant = { key: 'initial', value: 'initial' };

const initialVariants: Variants = {
  'sdk-ci-test': serverOffVariant,
  'initial-key': initialVariant,
};

const fallbackVariant: Variant = { value: 'fallback', payload: 'payload' };
const explicitFallbackString = 'first';
const explicitFallbackVariant: Variant = {
  key: explicitFallbackString,
  value: explicitFallbackString,
};
const unknownKey = 'not-a-valid-key';

/**
 * Basic test that fetching variants for a user succeeds.
 */
test('ExperimentClient.fetch, success', async () => {
  const client = new ExperimentClient(API_KEY, {});
  mockClientStorage(client);
  await client.fetch(testUser);
  const variant = client.variant(serverKey);
  expect(variant).toEqual(serverVariant);
});

/**
 * Test that a timed out fetch request with retries disabled does not fetch any
 * variants.
 */
test('ExperimentClient.fetch, no retries, timeout failure', async () => {
  const client = new ExperimentClient(API_KEY, {
    retryFetchOnFailure: false,
    fetchTimeoutMillis: 1,
  });
  mockClientStorage(client);
  await client.fetch(testUser);
  const variants = client.all();
  expect(variants).toEqual({});
});

/**
 * Test that a timed out fetch request with (background) retries enabled will
 * complete successfully within a reasonable amount of time.
 */
test('ExperimentClient.fetch, with retries, retry success', async () => {
  const client = new ExperimentClient(API_KEY, {
    fallbackVariant: fallbackVariant,
    fetchTimeoutMillis: 1,
  });
  mockClientStorage(client);
  await client.fetch(testUser);
  let variant = client.variant(serverKey);
  expect(variant).toEqual(fallbackVariant);
  await delay(2000);
  variant = client.variant(serverKey);
  expect(variant).toEqual(serverVariant);
});

/**
 * Test that the client always prefers the explicit fallback over any
 * configured fallbacks when there are no stored variants--even if the
 * provided key is present in the initialVariants config.
 */
test('ExperimentClient.variant, no stored variants, explicit fallback returned', () => {
  let variant: Variant;
  const client = new ExperimentClient(API_KEY, {
    fallbackVariant: fallbackVariant,
    initialVariants: initialVariants,
  });
  mockClientStorage(client);

  variant = client.variant(unknownKey, explicitFallbackVariant);
  expect(variant).toEqual(explicitFallbackVariant);

  variant = client.variant(unknownKey, explicitFallbackString);
  expect(variant).toEqual(explicitFallbackVariant);

  variant = client.variant(initialKey, explicitFallbackVariant);
  expect(variant).toEqual(explicitFallbackVariant);

  variant = client.variant(initialKey, explicitFallbackString);
  expect(variant).toEqual(explicitFallbackVariant);
});

/**
 * Test that the client falls back to the configured `fallbackVariant` for an
 * unknown key when no explicit fallback is provided.
 */
test('ExperimentClient.variant, unknown key returns default fallback', () => {
  const client = new ExperimentClient(API_KEY, {
    fallbackVariant: fallbackVariant,
    initialVariants: initialVariants,
  });
  mockClientStorage(client);
  const variant: Variant = client.variant(unknownKey);
  expect(variant).toEqual(fallbackVariant);
});

/**
 * Test that the client falls back to the configured `initialVariants` for
 * flag keys included in the initial set. After a fetch, the client should
 * take flags from local storage instead.
 */
test('ExperimentClient.variant, initial variants fallback before fetch, no fallback after fetch', async () => {
  let variant: Variant;
  const client = new ExperimentClient(API_KEY, {
    fallbackVariant: fallbackVariant,
    initialVariants: initialVariants,
  });
  mockClientStorage(client);

  variant = client.variant(initialKey);
  expect(variant).toEqual(initialVariant);

  variant = client.variant(serverKey);
  expect(variant).toEqual(serverOffVariant);

  await client.fetch(testUser);

  variant = client.variant(initialKey);
  expect(variant).toEqual(initialVariant);

  variant = client.variant(serverKey);
  expect(variant).toEqual(serverVariant);
});

/**
 * Calling `all()` prior to fetch with an empty storage returns configured
 * initial variants.
 */
test('ExperimentClient.all, initial variants returned', async () => {
  const client = new ExperimentClient(API_KEY, {
    initialVariants: initialVariants,
  });
  mockClientStorage(client);

  const variants = client.all();
  expect(variants).toEqual(initialVariants);
});

/**
 * Call clear() to clear all variants in the cache and storage.
 */
test('ExperimentClient.clear, clear the variants in storage', async () => {
  const client = new ExperimentClient(API_KEY, {});
  mockClientStorage(client);
  await client.fetch(testUser);
  const variant = client.variant('sdk-ci-test');
  expect(variant).toEqual({ key: 'on', value: 'on', payload: 'payload' });
  client.clear();
  const clearedVariants = client.all();
  expect(clearedVariants).toEqual({});
});

/**
 * Setting source to initial variants will prioritize variants in initial
 * variants over those stored in local storage.
 */
test('ExperimentClient.fetch, initial variants source, prefer initial', async () => {
  const client = new ExperimentClient(API_KEY, {
    source: Source.InitialVariants,
    initialVariants: initialVariants,
  });
  mockClientStorage(client);
  let variant = client.variant(serverKey);
  expect(variant).toEqual(serverOffVariant);
  await client.fetch(testUser);
  variant = client.variant(serverKey);
  expect(variant).toEqual(serverOffVariant);
});

/**
 * Test that fetch with an explicit user argument will set the user within the
 * client, and calling setUser() after will overwrite the user.
 */
test('ExperimentClient.fetch, sets user, setUser overrides', async () => {
  const client = new ExperimentClient(API_KEY, {});
  mockClientStorage(client);
  await client.fetch(testUser);
  expect(client.getUser()).toEqual(testUser);
  const newUser = { user_id: 'new_test_user' };
  client.setUser(newUser);
  expect(client.getUser()).toEqual(newUser);
});

/**
 * Test that fetch with a user provided by a user provider rather than an
 * explicit user argument is successful.
 */
test('ExperimentClient.fetch, with user provider, success', async () => {
  const client = new ExperimentClient(API_KEY, {}).setUserProvider(
    new TestUserProvider(),
  );
  mockClientStorage(client);
  await client.fetch();
  const variant = client.variant('sdk-ci-test');
  expect(variant).toEqual({ key: 'on', value: 'on', payload: 'payload' });
});

/**
 * Test that fetch with a user provided by a config user provider rather than an
 * explicit user argument is successful.
 */
test('ExperimentClient.fetch, with config user provider, success', async () => {
  const client = new ExperimentClient(API_KEY, {
    userProvider: new TestUserProvider(),
  });
  mockClientStorage(client);
  await client.fetch();
  const variant = client.variant('sdk-ci-test');
  expect(variant).toEqual({ key: 'on', value: 'on', payload: 'payload' });
});

/**
 * Utility class for testing analytics provider & exposure tracking.
 */
class TestAnalyticsProvider
  implements ExposureTrackingProvider, ExperimentAnalyticsProvider
{
  track(): void {
    return;
  }

  setUserProperty(): void {
    return;
  }

  unsetUserProperty(): void {
    return;
  }
}

test('ExperimentClient.variant, with exposure tracking provider, track called once per key', async () => {
  const eventBridge = AnalyticsConnector.getInstance('1').eventBridge;
  const exposureTrackingProvider = new TestExposureTrackingProvider();
  const trackSpy = jest.spyOn(exposureTrackingProvider, 'track');
  const logEventSpy = jest.spyOn(eventBridge, 'logEvent');
  const client = new ExperimentClient(API_KEY, {
    exposureTrackingProvider: exposureTrackingProvider,
  });
  mockClientStorage(client);
  await client.fetch(testUser);
  for (let i = 0; i < 10; i++) {
    client.variant('key-that-does-not-exist');
  }

  expect(trackSpy).toBeCalledTimes(0);
  expect(logEventSpy).toBeCalledTimes(0);

  for (let i = 0; i < 10; i++) {
    client.variant(serverKey);
  }

  expect(trackSpy).toBeCalledTimes(1);
  expect(trackSpy).toHaveBeenCalledWith({
    flag_key: serverKey,
    variant: serverVariant.value,
  });
});

/**
 * Configure a client with an analytics provider which checks that a valid
 * exposure event is tracked when the client's variant function is called.
 */
test('ExperimentClient.variant, with analytics provider, exposure tracked, unset not sent', async () => {
  const analyticsProvider = new TestAnalyticsProvider();
  const spyTrack = jest.spyOn(analyticsProvider, 'track');
  const spySet = jest.spyOn(analyticsProvider, 'setUserProperty');
  const spyUnset = jest.spyOn(analyticsProvider, 'unsetUserProperty');
  const client = new ExperimentClient(API_KEY, {
    analyticsProvider: analyticsProvider,
  });
  mockClientStorage(client);
  await client.fetch(testUser);
  client.variant(serverKey);

  expect(spySet).toBeCalledTimes(1);
  expect(spyTrack).toBeCalledTimes(1);

  const expectedEvent = {
    name: '[Experiment] Exposure',
    properties: {
      key: serverKey,
      source: 'storage',
      variant: serverVariant.value,
    },
    user: expect.objectContaining({
      user_id: 'test_user',
    }),
    key: serverKey,
    variant: serverVariant,
    userProperties: {
      [`[Experiment] ${serverKey}`]: serverVariant.value,
    },
    userProperty: `[Experiment] ${serverKey}`,
  };
  expect(spySet).lastCalledWith(expectedEvent);
  expect(spyTrack).lastCalledWith(expectedEvent);

  // verify call order
  const spySetOrder = spySet.mock.invocationCallOrder[0];
  const spyTrackOrder = spyTrack.mock.invocationCallOrder[0];
  expect(spySetOrder).toBeLessThan(spyTrackOrder);

  expect(spyUnset).toBeCalledTimes(0);
});

/**
 * Configure a client with an analytics provider which fails the test if called.
 * Tests that the analytics provider is not called with an exposure event when
 * the client exposes the user to a fallback/initial variant.
 */
test('ExperimentClient.variant, with analytics provider, exposure not tracked on fallback, unset sent', async () => {
  const analyticsProvider = new TestAnalyticsProvider();
  const spyTrack = jest.spyOn(analyticsProvider, 'track');
  const spySet = jest.spyOn(analyticsProvider, 'setUserProperty');
  const spyUnset = jest.spyOn(analyticsProvider, 'unsetUserProperty');
  const client = new ExperimentClient(API_KEY, {
    analyticsProvider: analyticsProvider,
  });
  mockClientStorage(client);
  client.variant(initialKey);
  client.variant(unknownKey);

  expect(spyTrack).toHaveBeenCalledTimes(0);
  expect(spySet).toHaveBeenCalledTimes(0);
  expect(spyUnset).toHaveBeenCalledTimes(2);
});

class TestHttpClient implements HttpClient {
  public readonly status: number;
  public readonly body: string;

  constructor(status: number, body: string) {
    this.status = status;
    this.body = body;
  }

  async request(): Promise<SimpleResponse> {
    return { status: this.status, body: this.body } as SimpleResponse;
  }
}

test('configure httpClient, success', async () => {
  const client = new ExperimentClient(API_KEY, {
    httpClient: new TestHttpClient(
      200,
      JSON.stringify({ flag: { key: 'key', value: 'key' } }),
    ),
  });
  mockClientStorage(client);
  await client.fetch();
  const v = client.variant('flag');
  expect(v).toEqual({ key: 'key', value: 'key' });
});

test('existing storage variant removed when fetch without flag keys response stored', async () => {
  const client = new ExperimentClient(API_KEY, {});
  mockClientStorage(client);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  client.variants.put('not-fetched-variant', { value: 'on' });
  await client.fetch(testUser);
  const variant = client.variant('not-fetched-variant');
  expect(variant).toEqual({});
});

const flagKeysTestVariantPartial = {
  'sdk-ci-test': serverVariant,
};

test('ExperimentClient.fetch with partial flag keys in fetch options, should return the fetched variant', async () => {
  const client = new ExperimentClient(API_KEY, {});
  mockClientStorage(client);
  const option: FetchOptions = { flagKeys: ['sdk-ci-test'] };
  await client.fetch(testUser, option);
  const variant = client.all();
  expect(variant).toEqual(flagKeysTestVariantPartial);
});

test('ExperimentClient.fetch without fetch options, should return all variants', async () => {
  const client = new ExperimentClient(API_KEY, {});
  mockClientStorage(client);
  await client.fetch(testUser);
  const variants = client.all();
  expect(Object.keys(variants).length).toBeGreaterThanOrEqual(2);
});

test('ExperimentClient.fetch with not exist flagKeys in fetch options', async () => {
  const client = new ExperimentClient(API_KEY, {});
  const option: FetchOptions = { flagKeys: ['123'] };
  await client.fetch(testUser, option);
  const variant = client.all();
  expect(variant).toEqual({});
});

test('ExperimentClient.variant experiment key passed from variant to exposure', async () => {
  let didTrack = false;
  const client = new ExperimentClient(API_KEY, {
    exposureTrackingProvider: {
      track: (exposure: Exposure) => {
        expect(exposure.experiment_key).toEqual('expKey');
        didTrack = true;
      },
    },
    source: Source.InitialVariants,
    initialVariants: { flagKey: { value: 'value', expKey: 'expKey' } },
  });
  mockClientStorage(client);
  client.variant('flagKey');
  expect(didTrack).toEqual(true);
});

describe('local evaluation', () => {
  test('start loads flags into local storage', async () => {
    const client = new ExperimentClient(SERVER_API_KEY, {
      fetchOnStart: true,
    });
    mockClientStorage(client);
    await client.start({ device_id: 'test_device' });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.flags.get('sdk-ci-test-local').key).toEqual(
      'sdk-ci-test-local',
    );
    client.stop();
  });

  test('variant after start returns expected locally evaluated variant', async () => {
    const client = new ExperimentClient(SERVER_API_KEY, {
      fetchOnStart: true,
    });
    mockClientStorage(client);
    await client.start({ device_id: 'test_device' });
    let variant = client.variant('sdk-ci-test-local');
    expect(variant.key).toEqual('on');
    expect(variant.value).toEqual('on');
    client.setUser({});
    variant = client.variant('sdk-ci-test-local');
    expect(variant.key).toEqual('off');
    expect(variant.value).toBeUndefined();
    client.stop();
  });

  test('remote evaluation variant preferred over local evaluation variant', async () => {
    const client = new ExperimentClient(SERVER_API_KEY, {
      fetchOnStart: false,
    });
    mockClientStorage(client);
    const user = { user_id: 'test_user', device_id: 'test_device' };
    await client.start(user);
    let variant = client.variant('sdk-ci-test');
    expect(variant.key).toEqual('off');
    expect(variant.value).toBeUndefined();
    await client.fetch(user);
    variant = client.variant('sdk-ci-test');
    expect(variant).toEqual({
      key: 'on',
      value: 'on',
      payload: 'payload',
    });
    client.stop();
  });
});

describe('server zone', () => {
  test('no config uses defaults', () => {
    const client = new ExperimentClient(API_KEY, {});
    mockClientStorage(client);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.config.serverUrl).toEqual('https://api.lab.amplitude.com');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.config.flagsServerUrl).toEqual(
      'https://flag.lab.amplitude.com',
    );
  });
  test('us server zone config uses defaults', () => {
    const client = new ExperimentClient(API_KEY, { serverZone: 'US' });
    mockClientStorage(client);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.config.serverUrl).toEqual('https://api.lab.amplitude.com');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.config.flagsServerUrl).toEqual(
      'https://flag.lab.amplitude.com',
    );
  });
  test('us server zone with explicit config uses explicit config', () => {
    const client = new ExperimentClient(API_KEY, {
      serverZone: 'US',
      serverUrl: 'https://experiment.company.com',
      flagsServerUrl: 'https://flags.company.com',
    });
    mockClientStorage(client);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.config.serverUrl).toEqual('https://experiment.company.com');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.config.flagsServerUrl).toEqual('https://flags.company.com');
  });
  test('eu server zone uses eu defaults', () => {
    const client = new ExperimentClient(API_KEY, { serverZone: 'EU' });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.config.serverUrl).toEqual('https://api.lab.eu.amplitude.com');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.config.flagsServerUrl).toEqual(
      'https://flag.lab.eu.amplitude.com',
    );
  });
  test('eu server zone with explicit config uses explicit config', () => {
    const client = new ExperimentClient(API_KEY, {
      serverZone: 'EU',
      serverUrl: 'https://expeirment.company.com',
      flagsServerUrl: 'https://flags.company.com',
    });
    mockClientStorage(client);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.config.serverUrl).toEqual('https://expeirment.company.com');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.config.flagsServerUrl).toEqual('https://flags.company.com');
  });
});

class TestExposureTrackingProvider implements ExposureTrackingProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  track(exposure: Exposure): void {
    // Do nothing
  }
}

describe('variant fallbacks', () => {
  describe('local storage source', () => {
    test('variant accessed from local storage primary', async () => {
      const user = { user_id: 'test_user' };
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.LocalStorage,
        fetchOnStart: true,
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      // Variant is result of fetch
      const variant = client.variant('sdk-ci-test');
      expect(variant.key).toEqual('on');
      expect(variant.value).toEqual('on');
      expect(variant.payload).toEqual('payload');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test');
      expect(spy.mock.calls[0][0].variant).toEqual('on');
      client.stop();
    });

    test('variant accessed from inline fallback before initial variants secondary', async () => {
      const user = {};
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.LocalStorage,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test': { key: 'initial', value: 'initial' },
        },
        fallbackVariant: { key: 'fallback', value: 'fallback' },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      // Variant is result of inline fallback string
      const variantString = client.variant('sdk-ci-test', 'inline');
      expect(variantString).toEqual({ key: 'inline', value: 'inline' });
      // Variant is result of inline fallback object
      const variantObject = client.variant('sdk-ci-test', { value: 'inline' });
      expect(variantObject).toEqual({ value: 'inline' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test');
      expect(spy.mock.calls[0][0].variant).toBeUndefined();
      client.stop();
    });

    test('variant accessed from initial variants when no explicit fallback provided', async () => {
      const user = {};
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.LocalStorage,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test': { key: 'initial', value: 'initial' },
        },
        fallbackVariant: { key: 'fallback', value: 'fallback' },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      const variant = client.variant('sdk-ci-test');
      // Variant is result of initialVariants
      expect(variant).toEqual({ key: 'initial', value: 'initial' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test');
      expect(spy.mock.calls[0][0].variant).toBeUndefined();
      client.stop();
    });

    test('variant accessed from configured fallback when no initial variants or explicit fallback provided', async () => {
      const user = {};
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.LocalStorage,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test-not-selected': { key: 'initial', value: 'initial' },
        },
        fallbackVariant: { key: 'fallback', value: 'fallback' },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      const variant = client.variant('sdk-ci-test');
      // Variant is result of fallbackVariant
      expect(variant).toEqual({ key: 'fallback', value: 'fallback' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test');
      expect(spy.mock.calls[0][0].variant).toBeUndefined();
      client.stop();
    });

    test(
      'default variant returned when no other fallback is provided',
      async () => {
        const user = {};
        const exposureTrackingProvider = new TestExposureTrackingProvider();
        const spy = jest.spyOn(exposureTrackingProvider, 'track');
        const client = new ExperimentClient(API_KEY, {
          exposureTrackingProvider: exposureTrackingProvider,
          source: Source.LocalStorage,
          fetchOnStart: true,
        });
        mockClientStorage(client);
        // Start and fetch
        await client.start(user);
        const variant = client.variant('sdk-ci-test');
        expect(variant.key).toEqual('off');
        expect(variant.value).toBeUndefined();
        expect(variant.metadata?.default).toEqual(true);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test');
        expect(spy.mock.calls[0][0].variant).toBeUndefined();
        client.stop();
      },
      10 * 1000,
    );
  });

  describe('initial variants source', () => {
    test('variant accessed from initial variants primary', async () => {
      const user = { user_id: 'test_user' };
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.InitialVariants,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test': { key: 'initial', value: 'initial' },
        },
        fallbackVariant: { key: 'fallback', value: 'fallback' },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      // Variant is result of fetch
      const variant = client.variant('sdk-ci-test');
      expect(variant).toEqual({ key: 'initial', value: 'initial' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test');
      expect(spy.mock.calls[0][0].variant).toEqual('initial');
      client.stop();
    });

    test('variant accessed from local storage secondary', async () => {
      const user = { user_id: 'test_user' };
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.InitialVariants,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test-not-selected': { key: 'initial', value: 'initial' },
        },
        fallbackVariant: { key: 'fallback', value: 'fallback' },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      // Variant is result of inline fallback string
      const variantString = client.variant('sdk-ci-test', 'inline');
      expect(variantString).toEqual({
        key: 'on',
        value: 'on',
        payload: 'payload',
      });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test');
      expect(spy.mock.calls[0][0].variant).toEqual('on');
      client.stop();
    });

    test('variant accessed from inline fallback', async () => {
      const user = {};
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.InitialVariants,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test-not-selected': { key: 'initial', value: 'initial' },
        },
        fallbackVariant: { key: 'fallback', value: 'fallback' },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      // Variant is result of inline fallback string
      const variantString = client.variant('sdk-ci-test', 'inline');
      expect(variantString).toEqual({ key: 'inline', value: 'inline' });
      // Variant is result of inline fallback object
      const variantObject = client.variant('sdk-ci-test', { value: 'inline' });
      expect(variantObject).toEqual({ value: 'inline' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test');
      expect(spy.mock.calls[0][0].variant).toBeUndefined();
      client.stop();
    });

    test('variant accessed from configured fallback when no initial variants or explicit fallback provided', async () => {
      const user = {};
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.InitialVariants,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test-not-selected': { key: 'initial', value: 'initial' },
        },
        fallbackVariant: { key: 'fallback', value: 'fallback' },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      const variant = client.variant('sdk-ci-test');
      // Variant is result of fallbackVariant
      expect(variant).toEqual({ key: 'fallback', value: 'fallback' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test');
      expect(spy.mock.calls[0][0].variant).toBeUndefined();
      client.stop();
    });

    test('default variant returned when no other fallback is provided', async () => {
      const user = {};
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.InitialVariants,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test-not-selected': { key: 'initial', value: 'initial' },
        },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      const variant = client.variant('sdk-ci-test');
      expect(variant).toEqual({
        key: 'off',
        metadata: { default: true },
      });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test');
      expect(spy.mock.calls[0][0].variant).toBeUndefined();
      client.stop();
    });
  });

  describe('local evaluation flags', () => {
    test('returns locally evaluated variant over remote and all other fallbacks', async () => {
      const user = { device_id: '0123456789' };
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.LocalStorage,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test-local': { key: 'initial', value: 'initial' },
        },
        fallbackVariant: { key: 'fallback', value: 'fallback' },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      const variant = client.variant('sdk-ci-test-local', 'inline');
      expect(variant.key).toEqual('on');
      expect(variant.value).toEqual('on');
      expect(variant.metadata.evaluationMode).toEqual('local');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test-local');
      expect(spy.mock.calls[0][0].variant).toEqual('on');
      client.stop();
    });

    test('locally evaluated default variant with inline fallback', async () => {
      const user = {};
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.LocalStorage,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test-local': { key: 'initial', value: 'initial' },
        },
        fallbackVariant: { key: 'fallback', value: 'fallback' },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      const variant = client.variant('sdk-ci-test-local', 'inline');
      expect(variant.key).toEqual('inline');
      expect(variant.value).toEqual('inline');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test-local');
      expect(spy.mock.calls[0][0].variant).toBeUndefined();
      client.stop();
    });

    test('locally evaluated default variant with initial variants', async () => {
      const user = {};
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.LocalStorage,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test-local': { key: 'initial', value: 'initial' },
        },
        fallbackVariant: { key: 'fallback', value: 'fallback' },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      const variant = client.variant('sdk-ci-test-local');
      expect(variant.key).toEqual('initial');
      expect(variant.value).toEqual('initial');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test-local');
      expect(spy.mock.calls[0][0].variant).toBeUndefined();
      client.stop();
    });

    test('locally evaluated default variant with configured fallback', async () => {
      const user = {};
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.LocalStorage,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test-local-not-selected': {
            key: 'initial',
            value: 'initial',
          },
        },
        fallbackVariant: { key: 'fallback', value: 'fallback' },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      const variant = client.variant('sdk-ci-test-local');
      expect(variant.key).toEqual('fallback');
      expect(variant.value).toEqual('fallback');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test-local');
      expect(spy.mock.calls[0][0].variant).toBeUndefined();
      client.stop();
    });

    test('default variant returned when no other fallback is provided', async () => {
      const user = {};
      const exposureTrackingProvider = new TestExposureTrackingProvider();
      const spy = jest.spyOn(exposureTrackingProvider, 'track');
      const client = new ExperimentClient(API_KEY, {
        exposureTrackingProvider: exposureTrackingProvider,
        source: Source.LocalStorage,
        fetchOnStart: true,
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      const variant = client.variant('sdk-ci-test-local');
      expect(variant.key).toEqual('off');
      expect(variant.value).toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].flag_key).toEqual('sdk-ci-test-local');
      expect(spy.mock.calls[0][0].variant).toBeUndefined();
      client.stop();
    });

    test('all returns local evaluation variant over remote or initialVariants with local storage source', async () => {
      const user = { user_id: 'test_user', device_id: '0123456789' };
      const client = new ExperimentClient(API_KEY, {
        source: Source.LocalStorage,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test': { key: 'initial', value: 'initial' },
          'sdk-ci-test-local': { key: 'initial', value: 'initial' },
        },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      const allVariants = client.all();
      const localVariant = allVariants['sdk-ci-test-local'];
      expect(localVariant.key).toEqual('on');
      expect(localVariant.value).toEqual('on');
      expect(localVariant.metadata?.evaluationMode).toEqual('local');
      const remoteVariant = allVariants['sdk-ci-test'];
      expect(remoteVariant.key).toEqual('on');
      expect(remoteVariant.value).toEqual('on');
      client.stop();
    });

    test('all returns local evaluation variant over remote or initialVariants with initial variants source', async () => {
      const user = { user_id: 'test_user', device_id: '0123456789' };
      const client = new ExperimentClient(API_KEY, {
        source: Source.InitialVariants,
        fetchOnStart: true,
        initialVariants: {
          'sdk-ci-test': { key: 'initial', value: 'initial' },
          'sdk-ci-test-local': { key: 'initial', value: 'initial' },
        },
      });
      mockClientStorage(client);
      // Start and fetch
      await client.start(user);
      const allVariants = client.all();
      const localVariant = allVariants['sdk-ci-test-local'];
      expect(localVariant.key).toEqual('on');
      expect(localVariant.value).toEqual('on');
      expect(localVariant.metadata?.evaluationMode).toEqual('local');
      const remoteVariant = allVariants['sdk-ci-test'];
      expect(remoteVariant.key).toEqual('initial');
      expect(remoteVariant.value).toEqual('initial');
      client.stop();
    });
  });
});

describe('start', () => {
  test('with local and remote evaluation, calls fetch', async () => {
    const client = new ExperimentClient(API_KEY, {});
    mockClientStorage(client);
    const fetchSpy = jest.spyOn(client, 'fetch');
    await client.start();
    expect(fetchSpy).toBeCalledTimes(1);
    client.stop();
  }, 10000);

  test('with local evaluation only, calls fetch', async () => {
    const client = new ExperimentClient(API_KEY, {});
    mockClientStorage(client);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    client.flags.getAll = () => {
      return {};
    };
    const fetchSpy = jest.spyOn(client, 'fetch');
    await client.start();
    expect(fetchSpy).toBeCalledTimes(1);
    client.stop();
  });

  test('with local evaluation only, fetchOnStart enabled, calls fetch', async () => {
    const client = new ExperimentClient(API_KEY, {
      fetchOnStart: true,
    });
    mockClientStorage(client);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    client.flags.getAll = () => {
      return {};
    };
    const fetchSpy = jest.spyOn(client, 'fetch');
    await client.start();
    expect(fetchSpy).toBeCalledTimes(1);
    client.stop();
  });

  test('with local and remote evaluation, fetchOnStart disabled, does not call fetch', async () => {
    const client = new ExperimentClient(API_KEY, {
      fetchOnStart: false,
    });
    mockClientStorage(client);
    const fetchSpy = jest.spyOn(client, 'fetch');
    await client.start();
    expect(fetchSpy).toBeCalledTimes(0);
    client.stop();
  });

  test('initial flags', async () => {
    // Flag, sdk-ci-test-local is modified to always return off
    const client = new ExperimentClient(API_KEY, {
      fetchOnStart: false,
      initialFlags: `
      [
        {"key":"sdk-ci-test-local","metadata":{"deployed":true,"evaluationMode":"local","flagType":"release","flagVersion":1},"segments":[{"metadata":{"segmentName":"All Other Users"},"variant":"off"}],"variants":{"off":{"key":"off","metadata":{"default":true}},"on":{"key":"on","value":"on"}}},
    {"key":"sdk-ci-test-local-2","metadata":{"deployed":true,"evaluationMode":"local","flagType":"release","flagVersion":1},"segments":[{"metadata":{"segmentName":"All Other Users"},"variant":"on"}],"variants":{"off":{"key":"off","metadata":{"default":true}},"on":{"key":"on","value":"on"}}}
  ]
    `.trim(),
    });
    const user: ExperimentUser = { user_id: 'user_id', device_id: 'device_id' };
    client.setUser(user);
    let variant = client.variant('sdk-ci-test-local');
    let variant2 = client.variant('sdk-ci-test-local-2');
    expect(variant.key).toEqual('off');
    expect(variant2.key).toEqual('on');
    // Call start to update the flag, overwrites the initial flag to return on
    await client.start(user);
    variant = client.variant('sdk-ci-test-local');
    variant2 = client.variant('sdk-ci-test-local-2');
    expect(variant.key).toEqual('on');
    expect(variant2.key).toEqual('on');
    // Initialize a second client with the same storage to simulate an app restart
    const client2 = new ExperimentClient(API_KEY, {
      fetchOnStart: false,
    });
    client2.setUser(user);
    // Storage flag should take precedent over initial flag
    variant = client.variant('sdk-ci-test-local');
    variant2 = client.variant('sdk-ci-test-local-2');
    expect(variant.key).toEqual('on');
    expect(variant2.key).toEqual('on');
    client.stop();
  });
});

describe('fetch retry with different response codes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  test.each([
    [300, 'Fetch Exception 300', 1],
    [400, 'Fetch Exception 400', 0],
    [429, 'Fetch Exception 429', 1],
    [500, 'Fetch Exception 500', 1],
    [0, 'Other Exception', 1],
  ])(
    'responseCode=%p, errorMessage=%p, retryCalled=%p',
    async (responseCode, errorMessage, retryCalled) => {
      const client = new ExperimentClient(API_KEY, {
        retryFetchOnFailure: true,
      });
      mockClientStorage(client);

      jest
        .spyOn(ExperimentClient.prototype as any, 'doFetch')
        .mockImplementation(
          async (user?: ExperimentUser, options?: FetchOptions) => {
            return new Promise<ExperimentClient>((resolve, reject) => {
              if (responseCode === 0) {
                reject(new Error(errorMessage));
              } else {
                reject(new FetchError(responseCode, errorMessage));
              }
            });
          },
        );
      const retryMock = jest.spyOn(
        ExperimentClient.prototype as any,
        'startRetries',
      );
      try {
        await client.fetch({ user_id: 'test_user' });
      } catch (e) {
        // catch error
      }
      expect(retryMock).toHaveBeenCalledTimes(retryCalled);
    },
  );
});

describe('throwOnError option', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('throwOnError: true, should throw timeout error', async () => {
    const client = new ExperimentClient(API_KEY, {
      retryFetchOnFailure: false,
      fetchTimeoutMillis: 1,
      throwOnError: true,
    });
    mockClientStorage(client);

    await expect(client.fetch(testUser)).rejects.toThrow(TimeoutError);
  });

  test('throwOnError: true, should throw fetch error', async () => {
    const client = new ExperimentClient(API_KEY, {
      retryFetchOnFailure: false,
      throwOnError: true,
    });
    mockClientStorage(client);

    jest
      .spyOn(ExperimentClient.prototype as any, 'doFetch')
      .mockImplementation(async () => {
        throw new FetchError(500, 'Server Error');
      });

    await expect(client.fetch(testUser)).rejects.toThrow('Server Error');
  });

  test('throwOnError: true, should start retries in background but still throw error', async () => {
    const client = new ExperimentClient(API_KEY, {
      retryFetchOnFailure: true,
      throwOnError: true,
    });
    mockClientStorage(client);

    jest
      .spyOn(ExperimentClient.prototype as any, 'doFetch')
      .mockImplementation(async () => {
        throw new FetchError(500, 'Server Error');
      });

    const retryMock = jest.spyOn(
      ExperimentClient.prototype as any,
      'startRetries',
    );

    await expect(client.fetch(testUser)).rejects.toThrow('Server Error');

    // Retries should still be started in the background
    expect(retryMock).toHaveBeenCalledTimes(1);
  });

  test('throwOnError: false, should not throw error', async () => {
    const client = new ExperimentClient(API_KEY, {
      retryFetchOnFailure: false,
      fetchTimeoutMillis: 1,
      throwOnError: false,
    });
    mockClientStorage(client);

    // Should not throw
    await client.fetch(testUser);
    const variants = client.all();
    expect(variants).toEqual({});
  });

  test('throwOnError: undefined (default), should not throw error', async () => {
    const client = new ExperimentClient(API_KEY, {
      retryFetchOnFailure: false,
      fetchTimeoutMillis: 1,
    });
    mockClientStorage(client);

    // Should not throw (default behavior)
    await client.fetch(testUser);
    const variants = client.all();
    expect(variants).toEqual({});
  });

  test('throwOnError: undefined, should start retries when configured', async () => {
    const client = new ExperimentClient(API_KEY, {
      retryFetchOnFailure: true,
    });
    mockClientStorage(client);

    jest
      .spyOn(ExperimentClient.prototype as any, 'doFetch')
      .mockImplementation(async () => {
        throw new FetchError(500, 'Server Error');
      });

    const retryMock = jest.spyOn(
      ExperimentClient.prototype as any,
      'startRetries',
    );

    // Should not throw and should start retries
    await client.fetch(testUser);
    expect(retryMock).toHaveBeenCalledTimes(1);
  });

  test('throwOnError: true with retryFetchOnFailure: false, should not start retries', async () => {
    const client = new ExperimentClient(API_KEY, {
      retryFetchOnFailure: false,
      throwOnError: true,
    });
    mockClientStorage(client);

    jest
      .spyOn(ExperimentClient.prototype as any, 'doFetch')
      .mockImplementation(async () => {
        throw new FetchError(500, 'Server Error');
      });

    const retryMock = jest.spyOn(
      ExperimentClient.prototype as any,
      'startRetries',
    );

    await expect(client.fetch(testUser)).rejects.toThrow('Server Error');

    // Retries should not be started when retryFetchOnFailure is false
    expect(retryMock).toHaveBeenCalledTimes(0);
  });

  test('throwOnError: true in start(), should throw when flags API fails', async () => {
    const client = new ExperimentClient(API_KEY, {
      throwOnError: true,
      fetchOnStart: false, // Disable fetch to isolate flags API error
      pollOnStart: false, // Disable polling to avoid interference
    });
    mockClientStorage(client);

    jest
      .spyOn(ExperimentClient.prototype as any, 'doFlags')
      .mockImplementation(async () => {
        throw new FetchError(500, 'Flags API Error');
      });

    await expect(client.start(testUser)).rejects.toThrow('Flags API Error');
  });

  test('throwOnError: true in start(), should throw when initial fetch fails', async () => {
    const client = new ExperimentClient(API_KEY, {
      throwOnError: true,
      fetchOnStart: true,
      pollOnStart: false, // Disable polling to avoid interference
    });
    mockClientStorage(client);

    jest
      .spyOn(ExperimentClient.prototype as any, 'doFetch')
      .mockImplementation(async () => {
        throw new FetchError(500, 'Initial Fetch Error');
      });

    await expect(client.start(testUser)).rejects.toThrow('Initial Fetch Error');
  });

  test('throwOnError: false in start(), should not throw when flags API fails', async () => {
    const client = new ExperimentClient(API_KEY, {
      throwOnError: false,
      fetchOnStart: false,
      pollOnStart: false, // Disable polling to avoid interference
    });
    mockClientStorage(client);

    jest
      .spyOn(ExperimentClient.prototype as any, 'doFlags')
      .mockImplementation(async () => {
        throw new FetchError(500, 'Flags API Error');
      });

    // Should not throw
    await client.start(testUser);
  });

  test('throwOnError: false in start(), should not throw when initial fetch fails', async () => {
    const client = new ExperimentClient(API_KEY, {
      throwOnError: false,
      fetchOnStart: true,
      pollOnStart: false, // Disable polling to avoid interference
    });
    mockClientStorage(client);

    jest
      .spyOn(ExperimentClient.prototype as any, 'doFetch')
      .mockImplementation(async () => {
        throw new FetchError(500, 'Initial Fetch Error');
      });

    // Should not throw
    await client.start(testUser);
  });
});

test('test bootstrapping with v2 variants', async () => {
  let exposureObject: Exposure;
  const client = new ExperimentClient(API_KEY, {
    initialVariants: {
      'test-v1': {
        key: 'control',
        value: 'control',
        expKey: 'exp-1',
      },
      'test-v2': {
        key: 'control',
        value: 'control',
        metadata: {
          experimentKey: 'exp-2',
        },
      },
    },
    source: Source.InitialVariants,
    exposureTrackingProvider: {
      track(exposure: Exposure) {
        exposureObject = exposure;
      },
    },
  });
  client.exposure('test-v1');
  expect(exposureObject.experiment_key).toEqual('exp-1');
  client.exposure('test-v2');
  expect(exposureObject.experiment_key).toEqual('exp-2');
});

describe('integration plugin', () => {
  beforeEach(() => {
    safeGlobal.sessionStorage.clear();
    safeGlobal.localStorage.clear();
  });
  test('no plugin, with user provider', async () => {
    const client = new ExperimentClient(API_KEY, {
      userProvider: {
        getUser: () => {
          return {
            user_id: 'user',
            device_id: 'device',
            user_properties: { k: 'v' },
          };
        },
      },
    });
    mockClientStorage(client);
    const user = await client['addContextOrWait'](client.getUser());
    expect(user).toEqual({
      user_id: 'user',
      device_id: 'device',
      library: `experiment-js-client/${PACKAGE_VERSION}`,
      user_properties: { k: 'v' },
    });
  });
  test('no plugin, with exposure tracking provider', async () => {
    let exposure: Exposure;
    const client = new ExperimentClient(API_KEY, {
      debug: true,
      exposureTrackingProvider: {
        track: (e) => {
          exposure = e;
        },
      },
    });
    mockClientStorage(client);
    await client.fetch({ user_id: 'test_user' });
    const variant = client.variant('sdk-ci-test');
    expect(exposure.flag_key).toEqual('sdk-ci-test');
    expect(exposure.variant).toEqual(variant.value);
  });
  test('with plugin, user provider, and exposure tracking provider', async () => {
    let providerExposure: Exposure;
    let pluginExposure: ExperimentEvent;
    const client = new ExperimentClient(API_KEY, {
      debug: true,
      userProvider: {
        getUser: () => {
          return {
            user_id: 'user',
            device_id: 'device',
            user_properties: { k: 'v' },
          };
        },
      },
      exposureTrackingProvider: {
        track: (e) => {
          providerExposure = e;
        },
      },
    });
    mockClientStorage(client);
    client.addPlugin({
      type: 'integration',
      setup: async () => {
        return delay(100);
      },
      getUser: () => {
        return {
          user_id: 'user2',
          user_properties: { k2: 'v2' },
        };
      },
      track: (e) => {
        pluginExposure = e;
        return true;
      },
    } as IntegrationPlugin);
    const user = await client['addContextOrWait'](client.getUser());
    expect(user).toEqual({
      user_id: 'user2',
      device_id: 'device',
      library: `experiment-js-client/${PACKAGE_VERSION}`,
      user_properties: { k: 'v', k2: 'v2' },
    });
    await client.fetch(testUser);
    const variant = client.variant('sdk-ci-test');
    expect(providerExposure.flag_key).toEqual('sdk-ci-test');
    expect(providerExposure.variant).toEqual(variant.value);
    expect(pluginExposure.eventProperties['flag_key']).toEqual('sdk-ci-test');
    expect(pluginExposure.eventProperties['variant']).toEqual(variant.value);
  });
});

describe('trackExposure variant metadata', () => {
  test('undefined, exposure tracked', () => {
    let providerExposure: Exposure;
    const client = new ExperimentClient(API_KEY, {
      source: Source.InitialVariants,
      initialVariants: {
        flag: {
          key: 'on',
          value: 'on',
        },
      },
      exposureTrackingProvider: {
        track: (e) => {
          providerExposure = e;
        },
      },
    });
    client.exposure('flag');
    expect(providerExposure).toEqual({
      variant: 'on',
      flag_key: 'flag',
    });
  });
  test('true, exposure tracked', () => {
    let providerExposure: Exposure;
    const client = new ExperimentClient(API_KEY, {
      source: Source.InitialVariants,
      initialVariants: {
        flag: {
          key: 'on',
          value: 'on',
          metadata: { trackExposure: true },
        },
      },
      exposureTrackingProvider: {
        track: (e) => {
          providerExposure = e;
        },
      },
    });
    client.exposure('flag');
    expect(providerExposure).toEqual({
      variant: 'on',
      flag_key: 'flag',
      metadata: { trackExposure: true },
    });
  });
  test('false, exposure not tracked', () => {
    let providerExposure: Exposure;
    const client = new ExperimentClient(API_KEY, {
      source: Source.InitialVariants,
      initialVariants: {
        flag: {
          key: 'on',
          value: 'on',
          metadata: { trackExposure: false },
        },
      },
      exposureTrackingProvider: {
        track: (e) => {
          providerExposure = e;
        },
      },
    });
    client.exposure('flag');
    expect(providerExposure).toBeUndefined();
  });
});

describe('flag config polling interval config', () => {
  test('undefined, set to default', () => {
    const client = new ExperimentClient('api_key', {});
    expect(client['config'].flagConfigPollingIntervalMillis).toEqual(300000);
  });
  test('defined, less than minimum, set to minimum', () => {
    const client = new ExperimentClient('api_key', {
      flagConfigPollingIntervalMillis: 1000,
    });
    expect(client['config'].flagConfigPollingIntervalMillis).toEqual(60000);
  });
  test('defined, greater than minimum, set to configured value', () => {
    const client = new ExperimentClient('api_key', {
      flagConfigPollingIntervalMillis: 900000,
    });
    expect(client['config'].flagConfigPollingIntervalMillis).toEqual(900000);
  });
});
