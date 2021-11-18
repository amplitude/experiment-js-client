import { AnalyticsConnectorImpl } from "../src/analyticsConnector";

test('addEventListener, logEvent, listner called', async () => {
  const analyticsConnector = new AnalyticsConnectorImpl();
  const expectedEvent = { eventType: 'test' };
  analyticsConnector.addEventListener((event) => {
    expect(event).toEqual(expectedEvent);
  });
});