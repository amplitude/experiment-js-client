import { MessageBus } from 'src/subscriptions/message-bus';
import { ElementAppearedTriggerManager } from 'src/triggers/element-appeared-trigger-manager';
import { PageObject } from 'src/types';

import { createMockGlobal, setupGlobalObservers } from '../util/mocks';

setupGlobalObservers();

describe('ElementAppearedTriggerManager', () => {
  let mockGlobal: any;
  let messageBus: MessageBus;
  let manager: ElementAppearedTriggerManager;

  beforeEach(() => {
    mockGlobal = createMockGlobal();
    messageBus = new MessageBus();
  });

  const createPageObject = (
    selector: string,
    triggerType:
      | 'element_appeared'
      | 'element_visible'
      | 'scrolled_to' = 'element_appeared',
  ): PageObject => ({
    id: `page-${selector}`,
    name: `Page ${selector}`,
    conditions: [],
    trigger_type: triggerType,
    trigger_value:
      triggerType === 'scrolled_to'
        ? { mode: 'element', selector }
        : { selector },
  });

  describe('initialize', () => {
    test('should collect selectors from element_appeared pages', () => {
      const pages = [createPageObject('.button')];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot.elementAppearedSelectors).toContain('.button');
    });

    test('should collect selectors from element_visible pages', () => {
      const pages = [createPageObject('.visible-elem', 'element_visible')];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot.internalSelectors).toContain('.visible-elem');
    });

    test('should collect selectors from scrolled_to pages with element mode', () => {
      const pages = [createPageObject('.scroll-target', 'scrolled_to')];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot.internalSelectors).toContain('.scroll-target');
    });

    test('should collect selectors from multiple trigger types', () => {
      const pages = [
        createPageObject('.appeared', 'element_appeared'),
        createPageObject('.visible', 'element_visible'),
        createPageObject('.scroll', 'scrolled_to'),
      ];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot.elementAppearedSelectors).toContain('.appeared');
      expect(snapshot.internalSelectors).toContain('.visible');
      expect(snapshot.internalSelectors).toContain('.scroll');
    });

    test('should not initialize mutation observer if no selectors', () => {
      manager = new ElementAppearedTriggerManager([], messageBus, mockGlobal);
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot.elementAppearedSelectors).toHaveLength(0);
      expect(snapshot.internalSelectors).toHaveLength(0);
    });
  });

  describe('triggerInitialCheck', () => {
    test('should publish element_appeared event when element_appeared selector is found', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('element_appeared', publishSpy);

      const mockElement = {
        style: { display: 'block', visibility: 'visible' },
      };
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);
      mockGlobal.getComputedStyle = jest.fn(() => ({
        display: 'block',
        visibility: 'visible',
      }));

      const pages = [createPageObject('.button')];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();
      manager.triggerInitialCheck();

      expect(publishSpy).toHaveBeenCalledWith({ mutationList: [] });
    });

    test('should publish element_appeared_internal event for internal selectors', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('element_appeared_internal', publishSpy);

      const pages = [createPageObject('.visible', 'element_visible')];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();
      manager.triggerInitialCheck();

      expect(publishSpy).toHaveBeenCalledWith({ mutationList: [] });
    });

    test('should mark visible elements as appeared', () => {
      const mockElement = {
        style: { display: 'block', visibility: 'visible' },
      };
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);
      mockGlobal.getComputedStyle = jest.fn(() => ({
        display: 'block',
        visibility: 'visible',
      }));

      const pages = [createPageObject('.button')];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();
      manager.triggerInitialCheck();

      const snapshot = manager.getSnapshot();
      expect(snapshot.appearedElements).toContain('.button');
    });

    test('should not mark hidden elements as appeared', () => {
      const mockElement = {
        style: { display: 'none', visibility: 'visible' },
      };
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);
      mockGlobal.getComputedStyle = jest.fn(() => ({
        display: 'none',
        visibility: 'visible',
      }));

      const pages = [createPageObject('.hidden')];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();
      manager.triggerInitialCheck();

      const snapshot = manager.getSnapshot();
      expect(snapshot.appearedElements).not.toContain('.hidden');
    });

    test('should handle multiple matching elements and mark selector as appeared if any visible', () => {
      const hiddenElement = {
        style: { display: 'none', visibility: 'visible' },
      };
      const visibleElement = {
        style: { display: 'block', visibility: 'visible' },
      };
      mockGlobal.document.querySelectorAll = jest.fn(() => [
        hiddenElement,
        visibleElement,
      ]);
      mockGlobal.getComputedStyle = jest
        .fn()
        .mockReturnValueOnce({ display: 'none', visibility: 'visible' })
        .mockReturnValueOnce({ display: 'block', visibility: 'visible' });

      const pages = [createPageObject('.multi')];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();
      manager.triggerInitialCheck();

      const snapshot = manager.getSnapshot();
      expect(snapshot.appearedElements).toContain('.multi');
    });
  });

  describe('isActive', () => {
    test('should return true if element has appeared', () => {
      const mockElement = {
        style: { display: 'block', visibility: 'visible' },
      };
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);
      mockGlobal.getComputedStyle = jest.fn(() => ({
        display: 'block',
        visibility: 'visible',
      }));

      const pages = [createPageObject('.button')];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();
      manager.triggerInitialCheck();

      expect(manager.isActive(pages[0])).toBe(true);
    });

    test('should return false if element has not appeared', () => {
      mockGlobal.document.querySelectorAll = jest.fn(() => []);

      const pages = [createPageObject('.button')];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();
      manager.triggerInitialCheck();

      expect(manager.isActive(pages[0])).toBe(false);
    });
  });

  describe('reset', () => {
    test('should clear appeared elements and re-check', () => {
      const mockElement = {
        style: { display: 'block', visibility: 'visible' },
      };
      mockGlobal.document.querySelectorAll = jest.fn(() => [mockElement]);
      mockGlobal.getComputedStyle = jest.fn(() => ({
        display: 'block',
        visibility: 'visible',
      }));

      const pages = [createPageObject('.button')];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();
      manager.triggerInitialCheck();

      // Verify element appeared
      expect(manager.getSnapshot().appearedElements).toContain('.button');

      // Reset
      manager.reset();

      // Should re-check and mark as appeared again
      expect(manager.getSnapshot().appearedElements).toContain('.button');
    });
  });

  describe('getSnapshot', () => {
    test('should return current state with separated selectors', () => {
      const pages = [
        createPageObject('.button'),
        createPageObject('.link', 'element_visible'),
      ];
      manager = new ElementAppearedTriggerManager(
        pages,
        messageBus,
        mockGlobal,
      );
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot).toHaveProperty('appearedElements');
      expect(snapshot).toHaveProperty('elementAppearedSelectors');
      expect(snapshot).toHaveProperty('internalSelectors');
      expect(snapshot.elementAppearedSelectors).toEqual(['.button']);
      expect(snapshot.internalSelectors).toEqual(['.link']);
    });
  });
});
