import { MessageBus } from 'src/subscriptions/message-bus';
import { ExitIntentTriggerManager } from 'src/triggers/exit-intent-trigger-manager';
import { PageObject } from 'src/types';

import { createMockGlobal, setupGlobalObservers } from '../util/mocks';

setupGlobalObservers();

describe('ExitIntentTriggerManager', () => {
  let mockGlobal: any;
  let messageBus: MessageBus;
  let manager: ExitIntentTriggerManager;
  let mouseleaveListener: EventListener;

  beforeEach(() => {
    mockGlobal = createMockGlobal({
      document: {
        addEventListener: jest.fn((event: string, listener: EventListener) => {
          if (event === 'mouseleave') {
            mouseleaveListener = listener;
          }
        }),
      },
      setTimeout: jest.fn((fn) => {
        fn();
        return 1;
      }),
    });
    messageBus = new MessageBus();
  });

  const createPageObject = (minTimeOnPageMs?: number): PageObject => ({
    id: `page-${minTimeOnPageMs || 0}`,
    name: `Page ${minTimeOnPageMs || 0}`,
    conditions: [],
    trigger_type: 'exit_intent',
    trigger_value: { minTimeOnPageMs },
  });

  describe('initialize', () => {
    test('should set up mouseleave listener', () => {
      const pages = [createPageObject()];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(mockGlobal.document.addEventListener).toHaveBeenCalledWith(
        'mouseleave',
        expect.any(Function),
      );
    });

    test('should delay listener setup when minTimeOnPageMs is specified', () => {
      jest.useFakeTimers();
      mockGlobal.setTimeout = jest.fn((fn, delay) => setTimeout(fn, delay));

      const pages = [createPageObject(5000)];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Listener should not be set up yet
      expect(mockGlobal.document.addEventListener).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(5000);

      // Listener should now be set up
      expect(mockGlobal.document.addEventListener).toHaveBeenCalledWith(
        'mouseleave',
        expect.any(Function),
      );

      jest.useRealTimers();
    });

    test('should use minimum time requirement across all pages', () => {
      jest.useFakeTimers();
      mockGlobal.setTimeout = jest.fn((fn, delay) => setTimeout(fn, delay));

      const pages = [
        createPageObject(5000),
        createPageObject(3000),
        createPageObject(10000),
      ];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Should use minimum time (3000ms)
      expect(mockGlobal.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        3000,
      );

      jest.useRealTimers();
    });
  });

  describe('exit intent detection', () => {
    test('should fire when mouse leaves near top of viewport', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('exit_intent', publishSpy);

      const pages = [createPageObject()];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Simulate mouse leaving near top
      mouseleaveListener({
        clientY: 30,
        relatedTarget: null,
      } as MouseEvent);

      expect(publishSpy).toHaveBeenCalled();
      expect(publishSpy).toHaveBeenCalledWith({
        durationMs: expect.any(Number),
      });
    });

    test('should not fire when mouse leaves from bottom/middle', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('exit_intent', publishSpy);

      const pages = [createPageObject()];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Simulate mouse leaving from middle
      mouseleaveListener({
        clientY: 400,
        relatedTarget: null,
      } as MouseEvent);

      expect(publishSpy).not.toHaveBeenCalled();
    });

    test('should not fire when relatedTarget exists', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('exit_intent', publishSpy);

      const pages = [createPageObject()];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Simulate mouse moving to another element
      mouseleaveListener({
        clientY: 30,
        relatedTarget: {} as EventTarget,
      } as MouseEvent);

      expect(publishSpy).not.toHaveBeenCalled();
    });

    test('should fire at clientY <= 50', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('exit_intent', publishSpy);

      const pages = [createPageObject()];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Test edge case at exactly 50
      mouseleaveListener({
        clientY: 50,
        relatedTarget: null,
      } as MouseEvent);

      expect(publishSpy).toHaveBeenCalled();
    });
  });

  describe('isActive', () => {
    test('should return false without payload', () => {
      const pages = [createPageObject()];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(manager.isActive(pages[0])).toBe(false);
    });

    test('should return true when no time requirement', () => {
      const pages = [createPageObject()];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(manager.isActive(pages[0], { durationMs: 1000 })).toBe(true);
    });

    test('should return true when duration meets requirement', () => {
      const pages = [createPageObject(5000)];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(manager.isActive(pages[0], { durationMs: 5000 })).toBe(true);
      expect(manager.isActive(pages[0], { durationMs: 6000 })).toBe(true);
    });

    test('should return false when duration below requirement', () => {
      const pages = [createPageObject(5000)];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(manager.isActive(pages[0], { durationMs: 4000 })).toBe(false);
    });
  });

  describe('reset', () => {
    test('should update page load time', () => {
      const pages = [createPageObject()];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const initialSnapshot = manager.getSnapshot();
      const initialTime = initialSnapshot.pageLoadTime;

      // Wait a bit
      jest.spyOn(Date, 'now').mockReturnValue(initialTime + 5000);

      manager.reset();

      const newSnapshot = manager.getSnapshot();
      expect(newSnapshot.pageLoadTime).toBeGreaterThan(initialTime);

      jest.restoreAllMocks();
    });

    test('should reset time on page calculation', () => {
      const pages = [createPageObject()];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const initialSnapshot = manager.getSnapshot();
      const initialTime = initialSnapshot.pageLoadTime;

      // Simulate time passing
      const mockNow = initialTime + 5000;
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      manager.reset();

      const newSnapshot = manager.getSnapshot();
      expect(newSnapshot.timeOnPage).toBe(0);

      jest.restoreAllMocks();
    });
  });

  describe('getSnapshot', () => {
    test('should return page load time and time on page', () => {
      const pages = [createPageObject()];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot).toHaveProperty('pageLoadTime');
      expect(snapshot).toHaveProperty('timeOnPage');
      expect(typeof snapshot.pageLoadTime).toBe('number');
      expect(typeof snapshot.timeOnPage).toBe('number');
    });

    test('should calculate time on page correctly', () => {
      const pages = [createPageObject()];
      manager = new ExitIntentTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const initialSnapshot = manager.getSnapshot();
      const initialTime = initialSnapshot.pageLoadTime;

      // Simulate time passing
      jest.spyOn(Date, 'now').mockReturnValue(initialTime + 3000);

      const newSnapshot = manager.getSnapshot();
      expect(newSnapshot.timeOnPage).toBe(3000);

      jest.restoreAllMocks();
    });
  });
});
