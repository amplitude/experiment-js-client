import { ExperimentClient } from '../src/experimentClient';
import { ExperimentUser } from '../src/types/user';

const API_KEY = 'client-DvWljIjiiuqLbyjqdvBaLFfEBrAvGuA3';

const testUser: ExperimentUser = { user_id: 'test_user' };
const testClient: ExperimentClient = new ExperimentClient(API_KEY, {});

const testTimeoutNoRetriesClient = new ExperimentClient(API_KEY, {
  retryFetchOnFailure: false,
  fetchTimeoutMillis: 1,
});

const testTimeoutRetrySuccessClient = new ExperimentClient(API_KEY, {
  fetchTimeoutMillis: 1,
});

beforeEach(() => {
    localStorage.clear();
});

test('ExperimentClient.fetch, success', async () => {
  await testClient.fetch(testUser);
  const variant = testClient.variant('sdk-ci-test');
  expect(variant).toEqual({ value: 'on', payload: 'payload' });
});

test('ExperimentClient.fetch, no retries, timeout failure', async () => {
  await testTimeoutNoRetriesClient.fetch(testUser);
  const variants = testTimeoutNoRetriesClient.all();
  expect(variants).toEqual({});
});

test('ExperimentClient.fetch, no retries, timeout failure', async () => {
  await testTimeoutRetrySuccessClient.fetch(testUser);
  const variant = testClient.variant('sdk-ci-test');
  expect(variant).toEqual({ value: 'on', payload: 'payload' });
});
