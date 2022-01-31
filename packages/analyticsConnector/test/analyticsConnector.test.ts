import { AnalyticsConnector } from 'src/analyticsConnector';

test('AnalyticsConnector.getInstance returns the same instance', async () => {
  const core = AnalyticsConnector.getInstance('$default_instance');
  core.identityStore.setIdentity({ userId: 'userId' });

  const core2 = AnalyticsConnector.getInstance('$default_instance');
  const identity = core2.identityStore.getIdentity();
  expect(identity).toEqual({ userId: 'userId' });
});
