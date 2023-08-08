import { AnalyticsConnector } from '@amplitude/analytics-connector';

import { ExperimentClient } from '../src';
import { ExperimentAnalyticsProvider } from '../src';
import { FetchOptions } from '../src';
import { Exposure, ExposureTrackingProvider } from '../src';
import { ExperimentUserProvider } from '../src';
import { Source } from '../src';
import { ExperimentUser } from '../src';
import { Variant, Variants } from '../src';
import { ConnectorExposureTrackingProvider } from '../src/integration/connector';
import { HttpClient, SimpleResponse } from '../src/types/transport';
import { randomString } from '../src/util/randomstring';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

class TestUserProvider implements ExperimentUserProvider {
  getUser(): ExperimentUser {
    return { user_id: `${randomString(32)}` };
  }
}

const API_KEY = 'client-DvWljIjiiuqLbyjqdvBaLFfEBrAvGuA3';
const SERVER_API_KEY = 'server-qz35UwzJ5akieoAdIgzM4m9MIiOLXLoz';

const testUser: ExperimentUser = { user_id: 'test_user' };

const serverKey = 'sdk-ci-test';
const serverVariant: Variant = { value: 'on', payload: 'payload' };
const serverOffVariant: Variant = { value: 'off' };

const initialKey = 'initial-key';
const initialVariant: Variant = { value: 'initial' };

const initialVariants: Variants = {
  'sdk-ci-test': serverOffVariant,
  'initial-key': initialVariant,
};

const fallbackVariant: Variant = { value: 'fallback', payload: 'payload' };
const explicitFallbackString = 'first';
const explicitFallbackVariant: Variant = { value: explicitFallbackString };
const unknownKey = 'not-a-valid-key';

beforeEach(() => {
  localStorage.clear();
});

/**
 * Basic test that fetching variants for a user succeeds.
 */
test('ExperimentClient.fetch, success', async () => {
  const client = new ExperimentClient(API_KEY, {});
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
  const variants = client.all();
  expect(variants).toEqual(initialVariants);
});

/**
 * Call clear() to clear all variants in the cache and storage.
 */
test('ExperimentClient.clear, clear the variants in storage', async () => {
  const client = new ExperimentClient(API_KEY, {});
  await client.fetch(testUser);
  const variant = client.variant('sdk-ci-test');
  expect(variant).toEqual({ value: 'on', payload: 'payload' });
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
  await client.fetch();
  const variant = client.variant('sdk-ci-test');
  expect(variant).toEqual({ value: 'on', payload: 'payload' });
});

/**
 * Test that fetch with a user provided by a config user provider rather than an
 * explicit user argument is successful.
 */
test('ExperimentClient.fetch, with config user provider, success', async () => {
  const client = new ExperimentClient(API_KEY, {
    userProvider: new TestUserProvider(),
  });
  await client.fetch();
  const variant = client.variant('sdk-ci-test');
  expect(variant).toEqual({ value: 'on', payload: 'payload' });
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
  const exposureTrackingProvider = new ConnectorExposureTrackingProvider(
    eventBridge,
  );
  const trackSpy = jest.spyOn(exposureTrackingProvider, 'track');
  const logEventSpy = jest.spyOn(eventBridge, 'logEvent');
  const client = new ExperimentClient(API_KEY, {
    exposureTrackingProvider: exposureTrackingProvider,
  });
  await client.fetch(testUser);
  for (let i = 0; i < 10; i++) {
    client.variant('key-that-does-not-exist');
  }

  expect(trackSpy).toBeCalledTimes(1);
  expect(trackSpy).toHaveBeenCalledWith({
    flag_key: 'key-that-does-not-exist',
  });
  expect(logEventSpy).toBeCalledTimes(1);
  expect(logEventSpy).toHaveBeenCalledWith({
    eventType: '$exposure',
    eventProperties: { flag_key: 'key-that-does-not-exist' },
  });

  for (let i = 0; i < 10; i++) {
    client.variant(serverKey);
  }

  expect(trackSpy).toBeCalledTimes(2);
  expect(trackSpy).toHaveBeenCalledWith({
    flag_key: serverKey,
    variant: serverVariant.value,
  });
  expect(logEventSpy).toBeCalledTimes(2);
  expect(logEventSpy).toHaveBeenCalledWith({
    eventType: '$exposure',
    eventProperties: {
      flag_key: serverKey,
      variant: serverVariant.value,
    },
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
      JSON.stringify({ flag: { key: 'key' } }),
    ),
  });
  await client.fetch();
  const v = client.variant('flag');
  expect(v).toEqual({ value: 'key' });
});

test('existing storage variant removed when fetch without flag keys response stored', async () => {
  const client = new ExperimentClient(API_KEY, {});
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  client.variants.put('not-fetched-variant', { value: 'on' });
  await client.fetch(testUser);
  const variant = client.variant('not-fetched-variant');
  expect(variant).toEqual({});
});

// Testing with local api server, need to updated to use the production data.
const LOCAL_TEST_API = API_KEY; //'server-qz35UwzJ5akieoAdIgzM4m9MIiOLXLoz'; //'server-VY0FufBsdITI1Gv9y7RyUopLzk9m8t0n';
const local_test_user = testUser; //{ user_id: 'brian.giori@amplitude.com' };

const flagKeysTestVariantPartial = {
  'sdk-ci-test': serverVariant,
};
const flagKeysTestVariants = {
  'sdk-ci-test-2': { payload: undefined, value: 'on' },
  'sdk-ci-test': serverVariant,
};

test('ExperimentClient.fetch with partial flag keys in fetch options, should return the fetched variant', async () => {
  const client = new ExperimentClient(API_KEY, {});
  const option: FetchOptions = { flagKeys: ['sdk-ci-test'] };
  await client.fetch(local_test_user, option);
  const variant = client.all();
  expect(variant).toEqual(flagKeysTestVariantPartial);
});

test('ExperimentClient.fetch without fetch options, should return all variants', async () => {
  const client = new ExperimentClient(API_KEY, {});
  await client.fetch(local_test_user);
  const variant = client.all();
  expect(variant).toEqual(flagKeysTestVariants);
});

test('ExperimentClient.fetch with not exist flagKeys in fetch options', async () => {
  const client = new ExperimentClient(LOCAL_TEST_API, {});
  const option: FetchOptions = { flagKeys: ['123'] };
  await client.fetch(local_test_user, option);
  const variant = client.all();
  expect(variant).toEqual({});
});

test('ExperimentClient.variant experiment key passed from variant to exposure', async () => {
  let didTrack = false;
  const client = new ExperimentClient(LOCAL_TEST_API, {
    exposureTrackingProvider: {
      track: (exposure: Exposure) => {
        expect(exposure.experiment_key).toEqual('expKey');
        didTrack = true;
      },
    },
    source: Source.InitialVariants,
    initialVariants: { flagKey: { value: 'value', expKey: 'expKey' } },
  });
  client.variant('flagKey');
  expect(didTrack).toEqual(true);
});

describe('local evaluation', () => {
  test('start loads flags into local storage', async () => {
    const client = new ExperimentClient(SERVER_API_KEY, {});
    await client.start({ device_id: 'test_device' });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.flags.get('sdk-ci-test-local').key).toEqual(
      'sdk-ci-test-local',
    );
    client.stop();
  });

  test('variant after start returns expected locally evaluated variant', async () => {
    const client = new ExperimentClient(SERVER_API_KEY, {});
    await client.start({ device_id: 'test_device' });
    expect(client.variant('sdk-ci-test-local')).toEqual({ value: 'on' });
    client.setUser({});
    expect(client.variant('sdk-ci-test-local')).toEqual({});
    client.stop();
  });

  test('remote evaluation variant preferred over local evaluation variant', async () => {
    const client = new ExperimentClient(SERVER_API_KEY, {});
    const user = { user_id: 'test_user', device_id: 'test_device' };
    await client.start(user);
    expect(client.variant('sdk-ci-test')).toEqual({});
    await client.fetch(user);
    expect(client.variant('sdk-ci-test')).toEqual({
      value: 'on',
      payload: 'payload',
    });
    client.stop();
  });
});

describe('server zone', () => {
  test('no config uses defaults', () => {
    const client = new ExperimentClient(API_KEY, {});
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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.config.serverUrl).toEqual('https://expeirment.company.com');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(client.config.flagsServerUrl).toEqual('https://flags.company.com');
  });
});
