/* eslint-disable no-console */
import amplitude from 'amplitude-js';

import { IdentityStoreImpl } from '../src/identityStore';

test('editIdentity, setUserId setDeviceId, success', async () => {
  const identityStore = new IdentityStoreImpl();
  identityStore
    .editIdentity()
    .setUserId('user_id')
    .setDeviceId('device_id')
    .commit();
  const identity = identityStore.getIdentity();
  expect(identity).toEqual({ userId: 'user_id', deviceId: 'device_id' });
});

test('editIdentity, setUserId setDeviceId, identity listener called', async () => {
  const identityStore = new IdentityStoreImpl();
  const expectedIdentity = { userId: 'user_id', deviceId: 'device_id' };
  let listenerCalled = false;
  identityStore.addIdentityListener((identity) => {
    expect(identity).toEqual(expectedIdentity);
    listenerCalled = true;
  });
  identityStore
    .editIdentity()
    .setUserId('user_id')
    .setDeviceId('device_id')
    .commit();
  expect(listenerCalled).toEqual(true);
});

test('setIdentity, getIdentity, success', async () => {
  const identityStore = new IdentityStoreImpl();
  const expectedIdentity = { userId: 'user_id', deviceId: 'device_id' };
  identityStore.setIdentity(expectedIdentity);
  const identity = identityStore.getIdentity();
  expect(identity).toEqual(expectedIdentity);
});

test('setIdentity, identity listener called', async () => {
  const identityStore = new IdentityStoreImpl();
  const expectedIdentity = { userId: 'user_id', deviceId: 'device_id' };
  let listenerCalled = false;
  identityStore.addIdentityListener((identity) => {
    expect(identity).toEqual(expectedIdentity);
    listenerCalled = true;
  });
  identityStore.setIdentity(expectedIdentity);
  expect(listenerCalled).toEqual(true);
});

test('setIdentity with unchanged identity, identity listener not called', async () => {
  const identityStore = new IdentityStoreImpl();
  const expectedIdentity = { userId: 'user_id', deviceId: 'device_id' };
  identityStore.setIdentity(expectedIdentity);
  identityStore.addIdentityListener(() => {
    fail('identity listener should not be called');
  });
  identityStore.setIdentity(expectedIdentity);
});

test('updateUserProperties, set', async () => {
  const identityStore = new IdentityStoreImpl();
  const identify = new amplitude.Identify()
    .set('string', 'string')
    .set('int', 32)
    .set('bool', true)
    .set('double', 4.2)
    .set('jsonArray', [0, 1.1, true, 'three'])
    .set('jsonObject', { key: 'value' });
  identityStore
    .editIdentity()
    .updateUserProperties(identify['userPropertiesOperations'])
    .commit();
  const identity = identityStore.getIdentity();
  expect(identity).toEqual({
    userProperties: {
      string: 'string',
      int: 32,
      bool: true,
      double: 4.2,
      jsonArray: [0, 1.1, true, 'three'],
      jsonObject: { key: 'value' },
    },
  });
});

test('updateUserProperties, unset', async () => {
  const identityStore = new IdentityStoreImpl();
  identityStore.setIdentity({ userProperties: { key: 'value' } });
  const identify = new amplitude.Identify().unset('key');
  identityStore
    .editIdentity()
    .updateUserProperties(identify['userPropertiesOperations'])
    .commit();
  const identity = identityStore.getIdentity();
  expect(identity).toEqual({ userProperties: {} });
});

test('updateUserProperties, setOnce', async () => {
  const identityStore = new IdentityStoreImpl();
  let identify = new amplitude.Identify().setOnce('key', 'value1');
  identityStore
    .editIdentity()
    .updateUserProperties(identify['userPropertiesOperations'])
    .commit();
  let identity = identityStore.getIdentity();
  expect(identity).toEqual({ userProperties: { key: 'value1' } });
  identify = new amplitude.Identify().setOnce('key', 'value2');
  identityStore
    .editIdentity()
    .updateUserProperties(identify['userPropertiesOperations'])
    .commit();
  identity = identityStore.getIdentity();
  expect(identity).toEqual({ userProperties: { key: 'value1' } });
});

test('updateUserProperties, add to exiting number', async () => {
  const identityStore = new IdentityStoreImpl();
  const identify = new amplitude.Identify().set('int', 1).set('double', 1.1);
  identityStore
    .editIdentity()
    .updateUserProperties(identify['userPropertiesOperations'])
    .commit();
  const add = new amplitude.Identify().add('int', 1.1).add('double', 1);
  identityStore
    .editIdentity()
    .updateUserProperties(add['userPropertiesOperations'])
    .commit();
  const identity = identityStore.getIdentity();
  expect(identity).toEqual({
    userProperties: {
      int: 2.1,
      double: 2.1,
    },
  });
});

test('updateUserProperties, add to unset property', async () => {
  const identityStore = new IdentityStoreImpl();
  const add = new amplitude.Identify().add('int', 1).add('double', 1.1);
  identityStore
    .editIdentity()
    .updateUserProperties(add['userPropertiesOperations'])
    .commit();
  const identity = identityStore.getIdentity();
  expect(identity).toEqual({
    userProperties: {
      int: 1,
      double: 1.1,
    },
  });
});

test('updateUserProperties, append existing array', async () => {
  const identityStore = new IdentityStoreImpl();
  identityStore.setIdentity({ userProperties: { key: [-3, -2, -1, 0] } });
  const identify = new amplitude.Identify().append('key', [1, 2, 3]);
  identityStore
    .editIdentity()
    .updateUserProperties(identify['userPropertiesOperations'])
    .commit();
  const identity = identityStore.getIdentity();
  expect(identity).toEqual({
    userProperties: {
      key: [-3, -2, -1, 0, 1, 2, 3],
    },
  });
});

test('updateUserProperties, append to unset property', async () => {
  const identityStore = new IdentityStoreImpl();
  const identify = new amplitude.Identify().append('key', [1, 2, 3]);
  identityStore
    .editIdentity()
    .updateUserProperties(identify['userPropertiesOperations'])
    .commit();
  const identity = identityStore.getIdentity();
  expect(identity).toEqual({
    userProperties: {
      key: [1, 2, 3],
    },
  });
});

test('updateUserProperties, prepend to existing array', async () => {
  const identityStore = new IdentityStoreImpl();
  identityStore.setIdentity({ userProperties: { key: [0, 1, 2, 3] } });
  const identify = new amplitude.Identify().prepend('key', [-3, -2, -1]);
  identityStore
    .editIdentity()
    .updateUserProperties(identify['userPropertiesOperations'])
    .commit();
  const identity = identityStore.getIdentity();
  expect(identity).toEqual({
    userProperties: {
      key: [-3, -2, -1, 0, 1, 2, 3],
    },
  });
});

test('updateUserProperties, prepend to unset array', async () => {
  const identityStore = new IdentityStoreImpl();
  const identify = new amplitude.Identify().prepend('key', [1, 2, 3]);
  identityStore
    .editIdentity()
    .updateUserProperties(identify['userPropertiesOperations'])
    .commit();
  const identity = identityStore.getIdentity();
  expect(identity).toEqual({
    userProperties: {
      key: [1, 2, 3],
    },
  });
});
