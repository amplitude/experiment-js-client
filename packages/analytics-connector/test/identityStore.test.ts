/* eslint-disable no-console */
import amplitude from 'amplitude-js';

import { IdentityStoreImpl } from '../src/identityStore';

test('editIdentity, setUserId setDeviceId, success', async () => {
  const identityStore = new IdentityStoreImpl();
  identityStore
    .editIdentity()
    .setUserId('user_id')
    .setDeviceId('device_id')
    .setOptOut(true)
    .commit();
  const identity = identityStore.getIdentity();
  expect(identity).toEqual({
    userId: 'user_id',
    deviceId: 'device_id',
    userProperties: {},
    optOut: true,
  });
});

test('editIdentity, setUserId setDeviceId, identity listener called', async () => {
  const identityStore = new IdentityStoreImpl();
  const expectedIdentity = {
    userId: 'user_id',
    deviceId: 'device_id',
    userProperties: {},
  };
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

test('editIdentity, updateUserProperties, identity listener called', async () => {
  const identityStore = new IdentityStoreImpl();
  let listenerCalled = false;
  identityStore.addIdentityListener(() => {
    listenerCalled = true;
  });

  identityStore
    .editIdentity()
    .setUserId('user_id')
    .setDeviceId('device_id')
    .commit();
  expect(listenerCalled).toEqual(true);

  listenerCalled = false;
  identityStore
    .editIdentity()
    .updateUserProperties({ $set: { test: 'test' } })
    .commit();
  expect(listenerCalled).toEqual(true);

  listenerCalled = false;
  identityStore
    .editIdentity()
    .updateUserProperties({ $set: { test: 'test2' } })
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
