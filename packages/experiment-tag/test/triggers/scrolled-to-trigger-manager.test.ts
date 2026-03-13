import { MessageBus } from 'src/subscriptions/message-bus';
import { ScrolledToTriggerManager } from 'src/triggers/scrolled-to-trigger-manager';
import { PageObject } from 'src/types';

import {
  createMockGlobal,
  MockIntersectionObserver,
  setupGlobalObservers,
} from '../util/mocks';

setupGlobalObservers();

describe('ScrolledToTriggerManager', () => {
  let mockGlobal: any;
  let messageBus: MessageBus;
  let manager: ScrolledToTriggerManager;
  let scrollListener: EventListener;
  let observerCallback: IntersectionObserverCallback;

  beforeEach(() => {
    mockGlobal = createMockGlobal({
      scrollY: 0,
      innerHeight: 800,
      document: {
        documentElement: {
          scrollHeight: 2000,
        },
        querySelectorAll: jest.fn(() => []),
        addEventListener: jest.fn(),
      },
      addEventListener: jest.fn((event: string, listener: EventListener) => {
        if (event === 'scroll') {
          scrollListener = listener;
        }
      }),
      requestAnimationFrame: jest.fn((fn) => {
        fn();
        return 1;
      }),
      cancelAnimationFrame: jest.fn(),
    });
    messageBus = new MessageBus();

    // Capture the IntersectionObserver callback
    global.IntersectionObserver = jest.fn((callback, options) => {
      observerCallback = callback;
      return new MockIntersectionObserver(callback, options);
    }) as any;
  });

  const createPercentPageObject = (percentage: number): PageObject => ({
    id: `page-${percentage}`,
    name: `Page ${percentage}`,
    conditions: [],
    trigger_type: 'scrolled_to',
    trigger_value: { mode: 'percent', percentage },
  });

  const createElementPageObject = (
    selector: string,
    offsetPx = 0,
  ): PageObject => ({
    id: `page-${selector}`,
    name: `Page ${selector}`,
    conditions: [],
    trigger_type: 'scrolled_to',
    trigger_value: { mode: 'element', selector, offsetPx },
  });

  describe('percentage-based scrolling', () => {
    test('should set up scroll listener for percentage triggers', () => {
      const pages = [createPercentPageObject(50)];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(mockGlobal.addEventListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function),
        expect.objectContaining({ passive: true }),
      );
    });

    test('should track max scroll percentage', () => {
      const pages = [createPercentPageObject(50)];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Simulate scroll to 50%
      mockGlobal.scrollY = 600; // (2000 - 800) * 0.5 = 600
      scrollListener({} as Event);

      const snapshot = manager.getSnapshot();
      expect(snapshot.maxScrollPercentage).toBe(50);
    });

    test('should publish event when scroll percentage increases', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('scrolled_to', publishSpy);

      const pages = [createPercentPageObject(50)];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      mockGlobal.scrollY = 600;
      scrollListener({} as Event);

      expect(publishSpy).toHaveBeenCalled();
    });

    test('should not publish if scroll percentage does not increase', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('scrolled_to', publishSpy);

      const pages = [createPercentPageObject(50)];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      mockGlobal.scrollY = 600;
      scrollListener({} as Event);

      publishSpy.mockClear();

      // Scroll to same position
      scrollListener({} as Event);

      expect(publishSpy).not.toHaveBeenCalled();
    });

    test('should track maximum scroll percentage reached', () => {
      const pages = [createPercentPageObject(50)];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Scroll to 75%
      mockGlobal.scrollY = 900;
      scrollListener({} as Event);

      // Scroll back to 25%
      mockGlobal.scrollY = 300;
      scrollListener({} as Event);

      // Max should still be 75%
      const snapshot = manager.getSnapshot();
      expect(snapshot.maxScrollPercentage).toBe(75);
    });
  });

  describe('element-based scrolling', () => {
    test('should create IntersectionObserver for element triggers', () => {
      const pages = [createElementPageObject('.section')];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(global.IntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          rootMargin: '0px 0px 0px 0px',
          threshold: 0,
        }),
      );
    });

    test('should use offsetPx for root margin', () => {
      const pages = [createElementPageObject('.section', 100)];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(global.IntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          rootMargin: '0px 0px 100px 0px',
        }),
      );
    });

    test('should mark element as scrolled when it intersects', () => {
      const mockElement = document.createElement('div');
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);

      const pages = [createElementPageObject('.section')];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Simulate intersection
      observerCallback(
        [
          {
            target: mockElement,
            isIntersecting: true,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );

      expect(manager.isActive(pages[0])).toBe(true);
    });

    test('should publish event when element intersects', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('scrolled_to', publishSpy);

      const mockElement = document.createElement('div');
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);

      const pages = [createElementPageObject('.section')];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      observerCallback(
        [
          {
            target: mockElement,
            isIntersecting: true,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );

      expect(publishSpy).toHaveBeenCalled();
    });

    test('should create separate observers for different selectors', () => {
      const pages = [
        createElementPageObject('.section1'),
        createElementPageObject('.section2'),
      ];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(global.IntersectionObserver).toHaveBeenCalledTimes(2);
    });
  });

  describe('isActive', () => {
    test('should return true for percentage trigger when scrolled past', () => {
      const pages = [createPercentPageObject(50)];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      mockGlobal.scrollY = 600;
      scrollListener({} as Event);

      expect(manager.isActive(pages[0])).toBe(true);
    });

    test('should return false for percentage trigger when not scrolled enough', () => {
      const pages = [createPercentPageObject(75)];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      mockGlobal.scrollY = 600; // 50%
      scrollListener({} as Event);

      expect(manager.isActive(pages[0])).toBe(false);
    });

    test('should return true for element trigger after intersection', () => {
      const mockElement = document.createElement('div');
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);

      const pages = [createElementPageObject('.section')];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      observerCallback(
        [
          {
            target: mockElement,
            isIntersecting: true,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );

      expect(manager.isActive(pages[0])).toBe(true);
    });
  });

  describe('reset', () => {
    test('should reset scroll percentage', () => {
      const pages = [createPercentPageObject(50)];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      mockGlobal.scrollY = 600;
      scrollListener({} as Event);

      expect(manager.getSnapshot().maxScrollPercentage).toBe(50);

      manager.reset();

      expect(manager.getSnapshot().maxScrollPercentage).toBe(0);
    });

    test('should reset element scroll state', () => {
      const mockElement = document.createElement('div');
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);

      const pages = [createElementPageObject('.section')];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      observerCallback(
        [
          {
            target: mockElement,
            isIntersecting: true,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );

      expect(manager.isActive(pages[0])).toBe(true);

      manager.reset();

      expect(manager.isActive(pages[0])).toBe(false);
    });

    test('should keep observers active after reset', () => {
      const pages = [createElementPageObject('.section')];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshotBefore = manager.getSnapshot();
      manager.reset();
      const snapshotAfter = manager.getSnapshot();

      expect(snapshotAfter.observerCount).toBe(snapshotBefore.observerCount);
    });
  });

  describe('getSnapshot', () => {
    test('should return current state', () => {
      const pages = [
        createPercentPageObject(50),
        createElementPageObject('.section'),
      ];
      manager = new ScrolledToTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot).toHaveProperty('maxScrollPercentage');
      expect(snapshot).toHaveProperty('elementScrollState');
      expect(snapshot).toHaveProperty('observerCount');
    });
  });
});
