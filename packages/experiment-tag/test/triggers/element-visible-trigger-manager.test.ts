import { MessageBus } from 'src/subscriptions/message-bus';
import { ElementVisibleTriggerManager } from 'src/triggers/element-visible-trigger-manager';
import { PageObject } from 'src/types';

import {
  createMockGlobal,
  MockIntersectionObserver,
  setupGlobalObservers,
} from '../util/mocks';

setupGlobalObservers();

describe('ElementVisibleTriggerManager', () => {
  let mockGlobal: any;
  let messageBus: MessageBus;
  let manager: ElementVisibleTriggerManager;
  let observerCallback: IntersectionObserverCallback;

  beforeEach(() => {
    mockGlobal = createMockGlobal();
    messageBus = new MessageBus();

    // Capture the IntersectionObserver callback
    global.IntersectionObserver = jest.fn((callback, options) => {
      observerCallback = callback;
      return new MockIntersectionObserver(callback, options);
    }) as any;
  });

  const createPageObject = (
    selector: string,
    visibilityRatio = 0,
  ): PageObject => ({
    id: `page-${selector}`,
    name: `Page ${selector}`,
    conditions: [],
    trigger_type: 'element_visible',
    trigger_value: { selector, visibilityRatio },
  });

  describe('initialize', () => {
    test('should create IntersectionObserver for each unique selector+ratio', () => {
      const pages = [
        createPageObject('.button', 0.5),
        createPageObject('.link', 0.5),
      ];
      manager = new ElementVisibleTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot.observerCount).toBe(2);
    });

    test('should reuse observer for same selector+ratio combination', () => {
      const pages = [
        createPageObject('.button', 0.5),
        createPageObject('.button', 0.5),
      ];
      manager = new ElementVisibleTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot.observerCount).toBe(1);
    });

    test('should create separate observers for different ratios', () => {
      const pages = [
        createPageObject('.button', 0.5),
        createPageObject('.button', 0.9),
      ];
      manager = new ElementVisibleTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot.observerCount).toBe(2);
    });

    test('should use default ratio of 0 when not specified', () => {
      const pages = [createPageObject('.button')];
      manager = new ElementVisibleTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(global.IntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        { threshold: 0 },
      );
    });

    test('should reobserve elements on element_appeared events', () => {
      const mockElement = document.createElement('div');
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);

      const pages = [createPageObject('.button')];
      manager = new ElementVisibleTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Trigger element_appeared event
      messageBus.publish('element_appeared', { mutationList: [] });

      // Should have called querySelectorAll to find elements
      expect(mockGlobal.document.querySelectorAll).toHaveBeenCalledWith(
        '.button',
      );
    });
  });

  describe('intersection handling', () => {
    test('should update visibility state when element becomes visible', () => {
      const mockElement = document.createElement('div');
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);

      const pages = [createPageObject('.button', 0.5)];
      manager = new ElementVisibleTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Simulate intersection observer callback
      observerCallback(
        [
          {
            target: mockElement,
            isIntersecting: true,
            intersectionRatio: 0.6,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );

      expect(manager.isActive(pages[0])).toBe(true);
    });

    test('should not mark as visible if ratio below threshold', () => {
      const mockElement = document.createElement('div');
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);

      const pages = [createPageObject('.button', 0.5)];
      manager = new ElementVisibleTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Simulate intersection with ratio below threshold
      observerCallback(
        [
          {
            target: mockElement,
            isIntersecting: true,
            intersectionRatio: 0.3,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );

      expect(manager.isActive(pages[0])).toBe(false);
    });

    test('should publish event when element becomes visible', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('element_visible', publishSpy);

      const mockElement = document.createElement('div');
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);

      const pages = [createPageObject('.button', 0.5)];
      manager = new ElementVisibleTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      observerCallback(
        [
          {
            target: mockElement,
            isIntersecting: true,
            intersectionRatio: 0.6,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );

      expect(publishSpy).toHaveBeenCalled();
    });
  });

  describe('isActive', () => {
    test('should return false initially', () => {
      const pages = [createPageObject('.button', 0.5)];
      manager = new ElementVisibleTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(manager.isActive(pages[0])).toBe(false);
    });

    test('should return true after element becomes visible', () => {
      const mockElement = document.createElement('div');
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);

      const pages = [createPageObject('.button', 0.5)];
      manager = new ElementVisibleTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      observerCallback(
        [
          {
            target: mockElement,
            isIntersecting: true,
            intersectionRatio: 0.6,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );

      expect(manager.isActive(pages[0])).toBe(true);
    });
  });

  describe('reset', () => {
    test('should clear visibility state but keep observers', () => {
      const mockElement = document.createElement('div');
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);

      const pages = [createPageObject('.button', 0.5)];
      manager = new ElementVisibleTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Make element visible
      observerCallback(
        [
          {
            target: mockElement,
            isIntersecting: true,
            intersectionRatio: 0.6,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );

      expect(manager.isActive(pages[0])).toBe(true);

      // Reset
      manager.reset();

      // Should no longer be active
      expect(manager.isActive(pages[0])).toBe(false);

      // Observers should still exist
      expect(manager.getSnapshot().observerCount).toBe(1);
    });
  });

  describe('getSnapshot', () => {
    test('should return current state', () => {
      const pages = [createPageObject('.button', 0.5)];
      manager = new ElementVisibleTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot).toHaveProperty('observerCount');
      expect(snapshot).toHaveProperty('visibilityState');
      expect(snapshot.observerCount).toBe(1);
    });
  });
});
