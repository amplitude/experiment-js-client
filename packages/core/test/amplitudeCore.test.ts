import { AmplitudeCore } from '../src/amplitudeCore';

test('getAmplitudeCore returns the same instance', async () => {
  const core = AmplitudeCore.getInstance('$default_instance');
  core.identityStore.setIdentity({ userId: 'userId' });

  const core2 = AmplitudeCore.getInstance('$default_instance');
  const identity = core2.identityStore.getIdentity();
  expect(identity).toEqual({ userId: 'userId' });
});
