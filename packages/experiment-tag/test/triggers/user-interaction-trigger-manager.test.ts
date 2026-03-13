import { MessageBus } from 'src/subscriptions/message-bus';
import { UserInteractionTriggerManager } from 'src/triggers/user-interaction-trigger-manager';
import { PageObject, UserInteractionType } from 'src/types';

import { createMockGlobal, setupGlobalObservers } from '../util/mocks';

setupGlobalObservers();

describe('UserInteractionTriggerManager', () => {
  let mockGlobal: any;
  let messageBus: MessageBus;
  let manager: UserInteractionTriggerManager;
  let eventListeners: Map<string, EventListener>;

  beforeEach(() => {
    mockGlobal = createMockGlobal();
    messageBus = new MessageBus();
    eventListeners = new Map();

    // Mock addEventListener to capture event listeners (with options parameter)
    mockGlobal.document.addEventListener = jest.fn(
      (event: string, listener: EventListener, options?: any) => {
        eventListeners.set(event, listener);
      },
    );
  });

  const createPageObject = (
    selector: string,
    interactionType: UserInteractionType,
    minThresholdMs = 0,
  ): PageObject => ({
    id: `page-${selector}-${interactionType}`,
    name: `Page ${selector}`,
    conditions: [],
    trigger_type: 'user_interaction',
    trigger_value: { selector, interactionType, minThresholdMs },
  });

  describe('initialize', () => {
    test('should set up click event delegation', () => {
      const pages = [createPageObject('.button', 'click')];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      expect(mockGlobal.document.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        expect.any(Object),
      );
    });

    test('should set up hover event delegation', () => {
      const pages = [createPageObject('.button', 'hover')];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      expect(mockGlobal.document.addEventListener).toHaveBeenCalledWith(
        'mouseover',
        expect.any(Function),
        expect.any(Object),
      );
      expect(mockGlobal.document.addEventListener).toHaveBeenCalledWith(
        'mouseout',
        expect.any(Function),
        expect.any(Object),
      );
    });

    test('should set up focus event delegation', () => {
      const pages = [createPageObject('.input', 'focus')];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      expect(mockGlobal.document.addEventListener).toHaveBeenCalledWith(
        'focusin',
        expect.any(Function),
        expect.any(Object),
      );
      expect(mockGlobal.document.addEventListener).toHaveBeenCalledWith(
        'focusout',
        expect.any(Function),
        expect.any(Object),
      );
    });

    test('should not set up listeners if no pages', () => {
      manager = new UserInteractionTriggerManager([], messageBus, mockGlobal);
      manager.initialize();

      expect(mockGlobal.document.addEventListener).not.toHaveBeenCalled();
    });
  });

  describe('click interactions', () => {
    test('should fire immediately when threshold is 0', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('user_interaction', publishSpy);

      const pages = [createPageObject('.button', 'click', 0)];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      // Simulate click event
      const mockElement = { closest: jest.fn(() => true) };
      const clickListener = eventListeners.get('click')!;
      clickListener({ target: mockElement } as any);

      expect(publishSpy).toHaveBeenCalled();
      expect(manager.isActive(pages[0])).toBe(true);
    });

    test('should delay firing when threshold > 0', () => {
      jest.useFakeTimers();
      const publishSpy = jest.fn();
      messageBus.subscribe('user_interaction', publishSpy);

      mockGlobal.setTimeout = jest.fn((fn, delay) => {
        return setTimeout(fn, delay);
      });

      const pages = [createPageObject('.button', 'click', 1000)];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      // Simulate click event
      const mockElement = { closest: jest.fn(() => true) };
      const clickListener = eventListeners.get('click')!;
      clickListener({ target: mockElement } as any);

      // Should not fire immediately
      expect(publishSpy).not.toHaveBeenCalled();
      expect(manager.isActive(pages[0])).toBe(false);

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      // Should fire after threshold
      expect(publishSpy).toHaveBeenCalled();

      jest.useRealTimers();
    });

    test('should not fire if element does not match selector', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('user_interaction', publishSpy);

      const pages = [createPageObject('.button', 'click')];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      // Simulate click on non-matching element
      const mockElement = { closest: jest.fn(() => null) };
      const clickListener = eventListeners.get('click')!;
      clickListener({ target: mockElement } as any);

      expect(publishSpy).not.toHaveBeenCalled();
      expect(manager.isActive(pages[0])).toBe(false);
    });

    test('should only fire once per interaction', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('user_interaction', publishSpy);

      const pages = [createPageObject('.button', 'click')];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      const mockElement = { closest: jest.fn(() => true) };
      const clickListener = eventListeners.get('click')!;

      // Click twice
      clickListener({ target: mockElement } as any);
      clickListener({ target: mockElement } as any);

      // Should only fire once
      expect(publishSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('hover interactions', () => {
    test('should fire immediately when no threshold', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('user_interaction', publishSpy);

      const pages = [createPageObject('.button', 'hover', 0)];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      // Use a real DOM element that can be used in WeakMap
      const mockElement = document.createElement('div');
      mockElement.closest = jest.fn(() => mockElement);
      const mouseoverListener = eventListeners.get('mouseover')!;

      // Start hover
      mouseoverListener({ target: mockElement } as any);

      // Should fire immediately for 0 threshold
      expect(publishSpy).toHaveBeenCalled();
    });

    test('should cancel timeout when mouse leaves', () => {
      jest.useFakeTimers();
      const publishSpy = jest.fn();
      messageBus.subscribe('user_interaction', publishSpy);

      mockGlobal.setTimeout = jest.fn((fn, delay) => {
        return setTimeout(fn, delay);
      });
      mockGlobal.clearTimeout = jest.fn(clearTimeout);

      const pages = [createPageObject('.button', 'hover', 500)];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      const mockElement = {
        closest: jest.fn(() => true),
        contains: jest.fn(() => false),
      };
      const mouseoverListener = eventListeners.get('mouseover')!;
      const mouseoutListener = eventListeners.get('mouseout')!;

      // Start hover
      mouseoverListener({ target: mockElement } as any);

      // Leave before threshold
      jest.advanceTimersByTime(200);
      mouseoutListener({ target: mockElement, relatedTarget: null } as any);

      // Complete the time
      jest.advanceTimersByTime(300);

      // Should not have fired
      expect(publishSpy).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('isActive', () => {
    test('should return false initially', () => {
      const pages = [createPageObject('.button', 'click')];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      expect(manager.isActive(pages[0])).toBe(false);
    });

    test('should return true after interaction fires', () => {
      const pages = [createPageObject('.button', 'click')];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      const mockElement = { closest: jest.fn(() => true) };
      const clickListener = eventListeners.get('click')!;
      clickListener({ target: mockElement } as any);

      expect(manager.isActive(pages[0])).toBe(true);
    });
  });

  describe('reset', () => {
    test('should clear fired interactions', () => {
      const pages = [createPageObject('.button', 'click')];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      const mockElement = { closest: jest.fn(() => true) };
      const clickListener = eventListeners.get('click')!;
      clickListener({ target: mockElement } as any);

      expect(manager.isActive(pages[0])).toBe(true);

      // Reset
      manager.reset();

      expect(manager.isActive(pages[0])).toBe(false);
    });

    test('should clear pending click timeouts', () => {
      jest.useFakeTimers();
      mockGlobal.setTimeout = jest.fn((fn, delay) => setTimeout(fn, delay));
      mockGlobal.clearTimeout = jest.fn(clearTimeout);

      const pages = [createPageObject('.button', 'click', 1000)];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      const mockElement = { closest: jest.fn(() => true) };
      const clickListener = eventListeners.get('click')!;
      clickListener({ target: mockElement } as any);

      // Reset before timeout fires
      manager.reset();

      // Complete the time
      jest.advanceTimersByTime(1000);

      // Should not be active after reset
      expect(manager.isActive(pages[0])).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('getSnapshot', () => {
    test('should return current state', () => {
      const pages = [createPageObject('.button', 'click')];
      manager = new UserInteractionTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot).toHaveProperty('firedInteractions');
      expect(snapshot).toHaveProperty('pendingClickTimeouts');
    });
  });
});
