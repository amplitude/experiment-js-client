import { AnalyticsConnectorImpl } from '../src/analyticsConnector';

test('addEventListener, logEvent, listner called', async () => {
  const analyticsConnector = new AnalyticsConnectorImpl();
  const expectedEvent = { eventType: 'test' };
  analyticsConnector.setEventReceiver((event) => {
    expect(event).toEqual(expectedEvent);
  });
});

test('multiple logEvent, late addEventListener, listner called', async () => {
  const expectedEvent0 = { eventType: 'test0' };
  const expectedEvent1 = { eventType: 'test1' };
  const expectedEvent2 = { eventType: 'test2' };
  const analyticsConnector = new AnalyticsConnectorImpl();
  analyticsConnector.logEvent(expectedEvent0);
  analyticsConnector.logEvent(expectedEvent1);
  analyticsConnector.logEvent(expectedEvent2);
  let count = 0;
  analyticsConnector.setEventReceiver((event) => {
    if (count == 0) {
      expect(event).toEqual(expectedEvent0);
    } else if (count == 1) {
      expect(event).toEqual(expectedEvent1);
    } else if (count == 2) {
      expect(event).toEqual(expectedEvent2);
    }
    count++;
  });
  expect(count).toEqual(3);
});
