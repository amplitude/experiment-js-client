import { Source } from '../src/config';
import { ExperimentClient } from '../src/experimentClient';
import { ExperimentUser, ExperimentUserProvider } from '../src/types/user';
import { Variant, Variants } from '../src/types/variant';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

class TestUserProvider implements ExperimentUserProvider {
  getUser(): ExperimentUser {
    return testUser;
  }
}

const API_KEY = 'client-DvWljIjiiuqLbyjqdvBaLFfEBrAvGuA3';

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
  expect(variant).toEqual(fallbackVariant)
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

  await client.fetch();

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
 * Setting source to initial variants will prioritize variants in initial
 * variants over those stored in initial variants.
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
 * Test that fetch with an explicit user arguement will set the user within the
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
