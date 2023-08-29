import { Experiment } from '../src';

const API_KEY = 'client-DvWljIjiiuqLbyjqdvBaLFfEBrAvGuA3';
const OTHER_KEY = 'some-other-key';

test('Experiment.initialize, default instance name and api key, same object', async () => {
  const client1 = Experiment.initialize(API_KEY);
  const client2 = Experiment.initialize(API_KEY, {
    instanceName: '$default_instance',
  });
  expect(client2).toBe(client1);
});

test('Experiment.initialize, custom instance name, same object', async () => {
  const client1 = Experiment.initialize(API_KEY, {
    instanceName: 'brian',
  });
  const client2 = Experiment.initialize(API_KEY, {
    instanceName: 'brian',
  });
  expect(client2).toBe(client1);
});

test('Experiment.initialize, same instance name, different api key, different object', async () => {
  const client1 = Experiment.initialize(API_KEY);
  const client2 = Experiment.initialize(OTHER_KEY);
  expect(client2).not.toBe(client1);
});

test('Experiment.initialize, custom user provider wrapped correctly', async () => {
  const customUserProvider = {
    getUser: () => {
      return { user_id: 'user_id' };
    },
  };
  const client1 = Experiment.initialize(API_KEY, {
    userProvider: customUserProvider,
  });
  expect(client1.getUserProvider()).not.toStrictEqual(customUserProvider);
});
