import { EventBridgeImpl } from 'src/eventBridge';

test('setEventReceiver, logEvent, listener called', async () => {
  const eventBridge = new EventBridgeImpl();
  const expectedEvent = { eventType: 'test' };
  eventBridge.setEventReceiver((event) => {
    expect(event).toEqual(expectedEvent);
  });
});

test('multiple logEvent, late setEventReceiver, listener called', async () => {
  const expectedEvent0 = { eventType: 'test0' };
  const expectedEvent1 = { eventType: 'test1' };
  const expectedEvent2 = { eventType: 'test2' };
  const eventBridge = new EventBridgeImpl();
  eventBridge.logEvent(expectedEvent0);
  eventBridge.logEvent(expectedEvent1);
  eventBridge.logEvent(expectedEvent2);
  let count = 0;
  eventBridge.setEventReceiver((event) => {
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
