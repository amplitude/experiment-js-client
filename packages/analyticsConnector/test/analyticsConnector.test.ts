import { AnalyticsConnector } from 'src/analyticsConnector';

test('AnalyticsConnector.getInstance returns the same instance', async () => {
  const connector = AnalyticsConnector.getInstance('$default_instance');
  connector.identityStore.setIdentity({ userId: 'userId' });

  const connector2 = AnalyticsConnector.getInstance('$default_instance');
  const identity = connector2.identityStore.getIdentity();
  expect(identity).toEqual({ userId: 'userId' });
});
