import { MessageBus } from 'src/subscriptions/message-bus';
import { TimeOnPageTriggerManager } from 'src/triggers/time-on-page-trigger-manager';
import { PageObject } from 'src/types';

import { createMockGlobal, setupGlobalObservers } from '../util/mocks';

setupGlobalObservers();

describe('TimeOnPageTriggerManager', () => {
  let mockGlobal: any;
  let messageBus: MessageBus;
  let manager: TimeOnPageTriggerManager;
  let visibilityChangeListener: EventListener;

  beforeEach(() => {
    mockGlobal = createMockGlobal({
      document: {
        hidden: false,
        addEventListener: jest.fn((event: string, listener: EventListener) => {
          if (event === 'visibilitychange') {
            visibilityChangeListener = listener;
          }
        }),
      },
      setTimeout: jest.fn(),
      clearTimeout: jest.fn(),
    });
    messageBus = new MessageBus();
  });

  const createPageObject = (durationMs: number): PageObject => ({
    id: `page-${durationMs}`,
    name: `Page ${durationMs}`,
    conditions: [],
    trigger_type: 'time_on_page',
    trigger_value: { durationMs },
  });

  describe('initialize', () => {
    test('should set up timeout for each unique duration', () => {
      const pages = [createPageObject(1000), createPageObject(2000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(mockGlobal.setTimeout).toHaveBeenCalledTimes(2);
      expect(mockGlobal.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        1000,
      );
      expect(mockGlobal.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        2000,
      );
    });

    test('should set up visibility change handler', () => {
      const pages = [createPageObject(1000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(mockGlobal.document.addEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
    });

    test('should deduplicate durations', () => {
      const pages = [
        createPageObject(1000),
        createPageObject(1000),
        createPageObject(1000),
      ];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Should only set up one timeout for 1000ms
      expect(mockGlobal.setTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('timeout firing', () => {
    test('should publish event when timeout fires', () => {
      jest.useFakeTimers();
      const publishSpy = jest.fn();
      messageBus.subscribe('time_on_page', publishSpy);

      mockGlobal.setTimeout = jest.fn((fn, delay) => setTimeout(fn, delay));

      const pages = [createPageObject(1000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      jest.advanceTimersByTime(1000);

      expect(publishSpy).toHaveBeenCalledWith({ durationMs: 1000 });

      jest.useRealTimers();
    });

    test('should remove timeout after firing', () => {
      jest.useFakeTimers();
      mockGlobal.setTimeout = jest.fn((fn, delay) => setTimeout(fn, delay));

      const pages = [createPageObject(1000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshotBefore = manager.getSnapshot();
      expect(snapshotBefore.activeTimeouts).toContain(1000);

      jest.advanceTimersByTime(1000);

      const snapshotAfter = manager.getSnapshot();
      expect(snapshotAfter.activeTimeouts).not.toContain(1000);

      jest.useRealTimers();
    });
  });

  describe('visibility handling', () => {
    test('should clear timeouts when page becomes hidden', () => {
      jest.useFakeTimers();
      mockGlobal.setTimeout = jest.fn((fn, delay) => setTimeout(fn, delay));
      mockGlobal.clearTimeout = jest.fn(clearTimeout);

      const pages = [createPageObject(5000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Hide the page
      mockGlobal.document.hidden = true;
      visibilityChangeListener({} as Event);

      // Timeout should be cleared
      expect(mockGlobal.clearTimeout).toHaveBeenCalled();

      jest.useRealTimers();
    });

    test('should restart timeouts when page becomes visible', () => {
      jest.useFakeTimers();
      let timeoutCount = 0;
      mockGlobal.setTimeout = jest.fn((fn, delay) => {
        timeoutCount++;
        return setTimeout(fn, delay);
      });
      mockGlobal.clearTimeout = jest.fn(clearTimeout);

      const pages = [createPageObject(5000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(timeoutCount).toBe(1);

      // Hide the page
      mockGlobal.document.hidden = true;
      visibilityChangeListener({} as Event);

      // Show the page again
      mockGlobal.document.hidden = false;
      visibilityChangeListener({} as Event);

      // Timeout should be restarted
      expect(timeoutCount).toBe(2);

      jest.useRealTimers();
    });

    test('should not restart fired timeouts', () => {
      jest.useFakeTimers();
      const publishSpy = jest.fn();
      messageBus.subscribe('time_on_page', publishSpy);

      let timeoutCount = 0;
      mockGlobal.setTimeout = jest.fn((fn, delay) => {
        timeoutCount++;
        return setTimeout(fn, delay);
      });
      mockGlobal.clearTimeout = jest.fn(clearTimeout);

      const pages = [createPageObject(1000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(timeoutCount).toBe(1);

      // Fire the timeout
      jest.advanceTimersByTime(1000);
      expect(publishSpy).toHaveBeenCalledTimes(1);

      // Hide and show the page
      mockGlobal.document.hidden = true;
      visibilityChangeListener({} as Event);
      mockGlobal.document.hidden = false;
      visibilityChangeListener({} as Event);

      // Should not restart fired timeout
      expect(timeoutCount).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('isActive', () => {
    test('should return false without payload', () => {
      const pages = [createPageObject(1000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(manager.isActive(pages[0])).toBe(false);
    });

    test('should return true if payload duration >= page duration', () => {
      const pages = [createPageObject(1000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(manager.isActive(pages[0], { durationMs: 1000 })).toBe(true);
      expect(manager.isActive(pages[0], { durationMs: 2000 })).toBe(true);
    });

    test('should return false if payload duration < page duration', () => {
      const pages = [createPageObject(2000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(manager.isActive(pages[0], { durationMs: 1000 })).toBe(false);
    });
  });

  describe('reset', () => {
    test('should clear existing timeouts', () => {
      jest.useFakeTimers();
      mockGlobal.setTimeout = jest.fn((fn, delay) => setTimeout(fn, delay));
      mockGlobal.clearTimeout = jest.fn(clearTimeout);

      const pages = [createPageObject(1000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      manager.reset();

      expect(mockGlobal.clearTimeout).toHaveBeenCalled();

      jest.useRealTimers();
    });

    test('should restart timeouts after reset', () => {
      jest.useFakeTimers();
      let timeoutCount = 0;
      mockGlobal.setTimeout = jest.fn((fn, delay) => {
        timeoutCount++;
        return setTimeout(fn, delay);
      });

      const pages = [createPageObject(1000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(timeoutCount).toBe(1);

      manager.reset();

      expect(timeoutCount).toBe(2);

      jest.useRealTimers();
    });
  });

  describe('getSnapshot', () => {
    test('should return active timeouts', () => {
      const pages = [createPageObject(1000), createPageObject(2000)];
      manager = new TimeOnPageTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot).toHaveProperty('activeTimeouts');
      expect(snapshot.activeTimeouts).toHaveLength(2);
    });
  });
});
