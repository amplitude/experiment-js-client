import { IdentityStoreImpl } from "../src/identityStore";

test('editIdentity, setUserId setDeviceId, success', async () => {
  const identityStore = new IdentityStoreImpl();
  identityStore.editIdentity()
    .setUserId('user_id')
    .setDeviceId('device_id')
    .commit();
  const identity = identityStore.getIdentity();
  expect(identity).toEqual({userId: 'user_id', deviceId: 'device_id'});
});