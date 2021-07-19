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

const fallbackVariant: Variant = { value: 'fallback', payload: 'payload' };
const serverVariant: Variant = { value: 'on', payload: 'payload' };
const initialVariant: Variant = { value: 'initial' };
const offVariant: Variant = { value: 'off' };

const key = 'sdk-ci-test';
const initialKey = 'initial-key';

const initialVariants: Variants = {
  'initial-key': initialVariant,
  'sdk-ci-test': offVariant,
};

beforeEach(() => {
  localStorage.clear();
});

test('ExperimentClient.fetch, success', async () => {
  const client = new ExperimentClient(API_KEY, {});
  await client.fetch(testUser);
  const variant = client.variant('sdk-ci-test');
  expect(variant).toEqual({ value: 'on', payload: 'payload' });
});

test('ExperimentClient.fetch, no retries, timeout failure', async () => {
  const client = new ExperimentClient(API_KEY, {
    retryFetchOnFailure: false,
    fetchTimeoutMillis: 1,
  });
  await client.fetch(testUser);
  const variants = client.all();
  expect(variants).toEqual({});
});

test('ExperimentClient.fetch, with retries, retry success', async () => {
  const client = new ExperimentClient(API_KEY, {
    fetchTimeoutMillis: 1,
  });
  await client.fetch(testUser);
  await delay(1000);
  const variant = client.variant('sdk-ci-test');
  expect(variant).toEqual({ value: 'on', payload: 'payload' });
});

test('ExperimentClient.fetch, fallbacks returned in correct order', async () => {
  const client = new ExperimentClient(API_KEY, {
    fallbackVariant: fallbackVariant,
    initialVariants: initialVariants,
  });

  const firstFallbck: Variant = { value: 'first' };

  let variant = client.variant('asdf', firstFallbck);
  expect(variant).toEqual(firstFallbck);
  variant = client.variant('asdf', 'first');
  expect(variant).toEqual(firstFallbck);

  variant = client.variant(initialKey, firstFallbck);
  expect(variant).toEqual(firstFallbck);

  variant = client.variant(initialKey);
  expect(variant).toEqual(initialVariant);

  await client.fetch(testUser);

  variant = client.variant('asdf', firstFallbck);
  expect(variant).toEqual(firstFallbck);
  variant = client.variant('asdf', 'first');
  expect(variant).toEqual(firstFallbck);

  variant = client.variant(initialKey, firstFallbck);
  expect(variant).toEqual(firstFallbck);

  variant = client.variant(initialKey);
  expect(variant).toEqual(initialVariant);

  variant = client.variant(key, firstFallbck);
  expect(variant).toEqual(serverVariant);
});

test('ExperimentClient.all, initial variants returned', async () => {
  const client = new ExperimentClient(API_KEY, {
    initialVariants: initialVariants,
  });
  const variants = client.all();
  expect(variants).toEqual(initialVariants);
});

test('ExperimentClient.fetch, initial variants source, fetch overridden', async () => {
  const client = new ExperimentClient(API_KEY, {
    source: Source.InitialVariants,
    initialVariants: initialVariants,
  });
  let variant = client.variant(key);
  expect(variant).toEqual(offVariant);
  await client.fetch(testUser);
  variant = client.variant(key);
  expect(variant).toEqual(offVariant);
});

test('ExperimentClient.fetch, sets user, setUser overrides', async () => {
  const client = new ExperimentClient(API_KEY, {});
  await client.fetch(testUser);
  expect(client.getUser()).toEqual(testUser);
  const newUser = { user_id: 'new_test_user' };
  client.setUser(newUser);
  expect(client.getUser()).toEqual(newUser);
});

test('ExperimentClient.fetch, with user provider, success', async () => {
  const client = new ExperimentClient(API_KEY, {}).setUserProvider(
    new TestUserProvider(),
  );
  await client.fetch();
  const variant = client.variant('sdk-ci-test');
  expect(variant).toEqual({ value: 'on', payload: 'payload' });
});
