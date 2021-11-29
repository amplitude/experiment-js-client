import { getAmplitudeCore } from '../src/amplitudeCore';

test('getAmplitudeCore returns the same instance', async () => {
  const core = getAmplitudeCore('$default_instance');
  core.identityStore.setIdentity({ userId: 'userId' });

  const core2 = getAmplitudeCore('$default_instance');
  const identity = core2.identityStore.getIdentity();
  expect(identity).toEqual({ userId: 'userId' });
});
