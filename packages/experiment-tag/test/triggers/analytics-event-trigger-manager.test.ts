import { MessageBus } from 'src/subscriptions/message-bus';
import { AnalyticsEventTriggerManager } from 'src/triggers/analytics-event-trigger-manager';
import { PageObject } from 'src/types';

import { createMockGlobal, setupGlobalObservers } from '../util/mocks';

setupGlobalObservers();

describe('AnalyticsEventTriggerManager', () => {
  let mockGlobal: any;
  let messageBus: MessageBus;
  let manager: AnalyticsEventTriggerManager;

  beforeEach(() => {
    mockGlobal = createMockGlobal();
    messageBus = new MessageBus();
  });

  const createPageObject = (
    conditions: any[][],
    pageId = 'test-page',
  ): PageObject => ({
    id: pageId,
    name: `Page ${pageId}`,
    conditions: [],
    trigger_type: 'analytics_event',
    trigger_value: conditions,
  });

  describe('initialize', () => {
    test('should initialize with empty state', () => {
      const pages = [createPageObject([[]])];
      manager = new AnalyticsEventTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot.firedEvents).toEqual([]);
    });
  });

  describe('isActive with event matching', () => {
    test('should return false without payload', () => {
      const conditions = [
        [
          {
            op: 'is',
            selector: ['context', 'data', 'event'],
            values: ['button_click'],
          },
        ],
      ];
      const pages = [createPageObject(conditions)];
      manager = new AnalyticsEventTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(manager.isActive(pages[0])).toBe(false);
    });

    test('should return true when event matches conditions', () => {
      const conditions = [
        [
          {
            op: 'is',
            selector: ['context', 'data', 'event'],
            values: ['button_click'],
          },
        ],
      ];
      const pages = [createPageObject(conditions)];
      manager = new AnalyticsEventTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const payload = {
        event: 'button_click',
        properties: {},
      };

      expect(manager.isActive(pages[0], payload)).toBe(true);
    });

    test('should return false when event does not match conditions', () => {
      const conditions = [
        [
          {
            op: 'is',
            selector: ['context', 'data', 'event'],
            values: ['button_click'],
          },
        ],
      ];
      const pages = [createPageObject(conditions)];
      manager = new AnalyticsEventTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const payload = {
        event: 'page_view',
        properties: {},
      };

      expect(manager.isActive(pages[0], payload)).toBe(false);
    });

    test('should match event properties', () => {
      const conditions = [
        [
          {
            op: 'is',
            selector: ['context', 'data', 'properties', 'button_name'],
            values: ['Submit'],
          },
        ],
      ];
      const pages = [createPageObject(conditions)];
      manager = new AnalyticsEventTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const payload = {
        event: 'button_click',
        properties: { button_name: 'Submit' },
      };

      expect(manager.isActive(pages[0], payload)).toBe(true);
    });

    test('should handle multiple conditions', () => {
      const conditions = [
        [
          {
            op: 'is',
            selector: ['context', 'data', 'event'],
            values: ['button_click'],
          },
          {
            op: 'is',
            selector: ['context', 'data', 'properties', 'button_name'],
            values: ['Submit'],
          },
        ],
      ];
      const pages = [createPageObject(conditions)];
      manager = new AnalyticsEventTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const payload = {
        event: 'button_click',
        properties: { button_name: 'Submit' },
      };

      expect(manager.isActive(pages[0], payload)).toBe(true);
    });
  });

  describe('event firing state', () => {
    test('should mark event as fired after first match', () => {
      const conditions = [
        [
          {
            op: 'is',
            selector: ['context', 'data', 'event'],
            values: ['button_click'],
          },
        ],
      ];
      const pages = [createPageObject(conditions, 'event-page')];
      manager = new AnalyticsEventTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const payload = {
        event: 'button_click',
        properties: {},
      };

      // First call - should match and mark as fired
      expect(manager.isActive(pages[0], payload)).toBe(true);

      const snapshot = manager.getSnapshot();
      expect(snapshot.firedEvents).toContain('event-page');
    });

    test('should return true for already fired events even without payload', () => {
      const conditions = [
        [
          {
            op: 'is',
            selector: ['context', 'data', 'event'],
            values: ['button_click'],
          },
        ],
      ];
      const pages = [createPageObject(conditions)];
      manager = new AnalyticsEventTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const payload = {
        event: 'button_click',
        properties: {},
      };

      // Fire the event
      manager.isActive(pages[0], payload);

      // Should return true even without payload
      expect(manager.isActive(pages[0])).toBe(true);
    });
  });

  describe('reset', () => {
    test('should clear fired events', () => {
      const conditions = [
        [
          {
            op: 'is',
            selector: ['context', 'data', 'event'],
            values: ['button_click'],
          },
        ],
      ];
      const pages = [createPageObject(conditions)];
      manager = new AnalyticsEventTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const payload = {
        event: 'button_click',
        properties: {},
      };

      // Fire the event
      manager.isActive(pages[0], payload);
      expect(manager.getSnapshot().firedEvents).toHaveLength(1);

      // Reset
      manager.reset();

      expect(manager.getSnapshot().firedEvents).toEqual([]);
    });

    test('should allow events to fire again after reset', () => {
      const conditions = [
        [
          {
            op: 'is',
            selector: ['context', 'data', 'event'],
            values: ['button_click'],
          },
        ],
      ];
      const pages = [createPageObject(conditions)];
      manager = new AnalyticsEventTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const payload = {
        event: 'button_click',
        properties: {},
      };

      // Fire the event
      manager.isActive(pages[0], payload);
      expect(manager.isActive(pages[0])).toBe(true);

      // Reset
      manager.reset();

      // Should be inactive again
      expect(manager.isActive(pages[0])).toBe(false);

      // Should be able to fire again
      expect(manager.isActive(pages[0], payload)).toBe(true);
    });
  });

  describe('getSnapshot', () => {
    test('should return fired events', () => {
      const pages = [
        createPageObject([[]], 'page-1'),
        createPageObject([[]], 'page-2'),
      ];
      manager = new AnalyticsEventTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot).toHaveProperty('firedEvents');
      expect(Array.isArray(snapshot.firedEvents)).toBe(true);
    });

    test('should track multiple fired events', () => {
      const conditions = [
        [
          {
            op: 'is',
            selector: ['context', 'data', 'event'],
            values: ['button_click'],
          },
        ],
      ];
      const pages = [
        createPageObject(conditions, 'page-1'),
        createPageObject(conditions, 'page-2'),
      ];
      manager = new AnalyticsEventTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const payload = {
        event: 'button_click',
        properties: {},
      };

      manager.isActive(pages[0], payload);
      manager.isActive(pages[1], payload);

      const snapshot = manager.getSnapshot();
      expect(snapshot.firedEvents).toContain('page-1');
      expect(snapshot.firedEvents).toContain('page-2');
    });
  });
});
