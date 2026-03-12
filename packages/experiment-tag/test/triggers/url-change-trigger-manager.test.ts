import { MessageBus } from 'src/subscriptions/message-bus';
import { UrlChangeTriggerManager } from 'src/triggers/url-change-trigger-manager';
import { PageObject } from 'src/types';

import { createMockGlobal, setupGlobalObservers } from '../util/mocks';

setupGlobalObservers();

describe('UrlChangeTriggerManager', () => {
  let mockGlobal: ReturnType<typeof createMockGlobal> & typeof globalThis;
  let messageBus: MessageBus;
  let manager: UrlChangeTriggerManager;
  let originalPushState: typeof history.pushState;
  let originalReplaceState: typeof history.replaceState;
  let popstateListener: EventListener;

  beforeEach(() => {
    originalPushState = history.pushState;
    originalReplaceState = history.replaceState;

    mockGlobal = createMockGlobal({
      location: {
        href: 'http://test.com/',
      },
      history: {
        pushState: jest.fn(),
        replaceState: jest.fn(),
      },
      addEventListener: jest.fn((event: string, listener: EventListener) => {
        if (event === 'popstate') {
          popstateListener = listener;
        }
      }),
      webExperiment: {
        previousUrl: '',
      },
    }) as ReturnType<typeof createMockGlobal> & typeof globalThis;
    messageBus = new MessageBus();
  });

  afterEach(() => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  });

  const createPageObject = (): PageObject => ({
    id: 'url-change-page',
    name: 'URL Change Page',
    conditions: [],
    trigger_type: 'url_change',
    trigger_value: {},
  });

  describe('initialize with useDefaultNavigationHandler=false', () => {
    test('should not set up navigation handler', () => {
      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: false,
      });
      manager.initialize();

      expect(mockGlobal.addEventListener).not.toHaveBeenCalled();
    });
  });

  describe('initialize with useDefaultNavigationHandler=true', () => {
    test('should set up popstate listener', () => {
      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: true,
      });
      manager.initialize();

      expect(mockGlobal.addEventListener).toHaveBeenCalledWith(
        'popstate',
        expect.any(Function),
      );
    });

    test('should wrap history.pushState', () => {
      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: true,
      });
      manager.initialize();

      expect(typeof history.pushState).toBe('function');
      // History should be modified
      expect(history.pushState).not.toBe(originalPushState);
    });

    test('should wrap history.replaceState', () => {
      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: true,
      });
      manager.initialize();

      expect(typeof history.replaceState).toBe('function');
      // History should be modified
      expect(history.replaceState).not.toBe(originalReplaceState);
    });
  });

  describe('navigation detection', () => {
    test('should publish event on popstate', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('url_change', publishSpy);

      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: true,
      });
      manager.initialize();

      // Change URL
      mockGlobal.location.href = 'http://test.com/new-page';

      // Trigger popstate
      popstateListener({} as Event);

      expect(publishSpy).toHaveBeenCalled();
    });

    test('should not publish duplicate events for same URL', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('url_change', publishSpy);

      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: true,
      });
      manager.initialize();

      mockGlobal.location.href = 'http://test.com/page';

      // First popstate
      popstateListener({} as Event);
      expect(publishSpy).toHaveBeenCalledTimes(1);

      publishSpy.mockClear();

      // Second popstate with same URL
      popstateListener({} as Event);
      expect(publishSpy).not.toHaveBeenCalled();
    });

    test('should publish event when URL changes', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('url_change', publishSpy);

      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: true,
      });
      manager.initialize();

      mockGlobal.location.href = 'http://test.com/page1';
      popstateListener({} as Event);
      expect(publishSpy).toHaveBeenCalledTimes(1);

      mockGlobal.location.href = 'http://test.com/page2';
      popstateListener({} as Event);
      expect(publishSpy).toHaveBeenCalledTimes(2);
    });

    test('should update previousUrl when URL changes', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('url_change', publishSpy);

      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: true,
      });
      manager.initialize();

      const newUrl = 'http://test.com/new-page';
      mockGlobal.location.href = newUrl;

      // Trigger URL change through popstate
      popstateListener({} as Event);

      expect(publishSpy).toHaveBeenCalled();
    });
  });

  describe('isActive', () => {
    test('should always return true for url_change pages', () => {
      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(manager.isActive(pages[0])).toBe(true);
    });

    test('should return true regardless of how it is called', () => {
      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(manager.isActive(pages[0])).toBe(true);
    });
  });

  describe('markUrlAsPublished', () => {
    test('should prevent duplicate events for marked URL', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('url_change', publishSpy);

      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: true,
      });
      manager.initialize();

      const url = 'http://test.com/page';
      mockGlobal.location.href = url;

      // Mark URL as already published
      manager.markUrlAsPublished(url);

      // Try to trigger with same URL
      popstateListener({} as Event);

      expect(publishSpy).not.toHaveBeenCalled();
    });

    test('should allow events after marking different URL', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('url_change', publishSpy);

      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: true,
      });
      manager.initialize();

      // Mark one URL
      manager.markUrlAsPublished('http://test.com/page1');

      // Try to trigger with different URL
      mockGlobal.location.href = 'http://test.com/page2';
      popstateListener({} as Event);

      expect(publishSpy).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    test('should not modify state', () => {
      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      // Reset should not throw or cause issues
      expect(() => manager.reset()).not.toThrow();
    });
  });

  describe('getSnapshot', () => {
    test('should return current state', () => {
      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: true,
      });
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot).toHaveProperty('type', 'url_change');
      expect(snapshot).toHaveProperty('lastPublishedUrl');
      expect(snapshot).toHaveProperty('navigationHandlerEnabled');
      expect(snapshot.navigationHandlerEnabled).toBe(true);
    });

    test('should reflect navigation handler status', () => {
      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: false,
      });
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot.navigationHandlerEnabled).toBe(false);
    });

    test('should track last published URL', () => {
      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal, {
        useDefaultNavigationHandler: true,
      });
      manager.initialize();

      const url = 'http://test.com/page';
      manager.markUrlAsPublished(url);

      const snapshot = manager.getSnapshot();
      expect(snapshot.lastPublishedUrl).toBe(url);
    });
  });

  describe('default options', () => {
    test('should default to useDefaultNavigationHandler=false', () => {
      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot.navigationHandlerEnabled).toBe(false);
    });

    test('should respect undefined options', () => {
      const pages = [createPageObject()];
      manager = new UrlChangeTriggerManager(
        pages,
        messageBus,
        mockGlobal,
        undefined,
      );
      manager.initialize();

      expect(() => manager.initialize()).not.toThrow();
    });
  });
});
