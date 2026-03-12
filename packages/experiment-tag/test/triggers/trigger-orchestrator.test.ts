import { MessageBus } from '../../src/subscriptions/message-bus';
import { TriggerOrchestrator } from '../../src/triggers/trigger-orchestrator';
import { PageObject } from '../../src/types';

describe('TriggerOrchestrator', () => {
  let messageBus: MessageBus;
  let globalScope: typeof globalThis;

  beforeEach(() => {
    messageBus = new MessageBus();
    globalScope = global as any;
  });

  describe('initialization', () => {
    it('should initialize all registered trigger managers', () => {
      const pageObjects: PageObject[] = [
        {
          id: 'page1',
          trigger_type: 'manual',
          trigger_value: { name: 'test-page' },
        } as PageObject,
        {
          id: 'page2',
          trigger_type: 'url_change',
          trigger_value: {},
        } as PageObject,
      ];

      const orchestrator = new TriggerOrchestrator(
        pageObjects,
        messageBus,
        globalScope,
      );

      // Should have managers for registered trigger types
      expect(orchestrator.hasTriggerManager('manual')).toBe(true);
      expect(orchestrator.hasTriggerManager('url_change')).toBe(true);

      // Should not have managers for unregistered types
      expect(orchestrator.hasTriggerManager('element_appeared')).toBe(false);
    });

    it('should pass options to trigger managers', () => {
      const pageObjects: PageObject[] = [];
      const options = { useDefaultNavigationHandler: false };

      const orchestrator = new TriggerOrchestrator(
        pageObjects,
        messageBus,
        globalScope,
        options,
      );

      const urlManager = orchestrator.getManager('url_change');
      expect(urlManager).toBeDefined();
    });
  });

  describe('isPageActive', () => {
    it('should delegate to appropriate trigger manager', () => {
      const pageObjects: PageObject[] = [
        {
          id: 'page1',
          trigger_type: 'manual',
          trigger_value: { name: 'test-page' },
        } as PageObject,
      ];

      const orchestrator = new TriggerOrchestrator(
        pageObjects,
        messageBus,
        globalScope,
      );

      const page = pageObjects[0];

      // Initially not active
      expect(orchestrator.isPageActive(page)).toBe(false);

      // Activate via manual trigger manager
      const manualManager = orchestrator.getManager('manual');
      (manualManager as any).toggle('test-page', true);

      expect(orchestrator.isPageActive(page)).toBe(true);
    });

    it('should return false for unmanaged trigger types', () => {
      const pageObjects: PageObject[] = [];
      const orchestrator = new TriggerOrchestrator(
        pageObjects,
        messageBus,
        globalScope,
      );

      const page: PageObject = {
        id: 'page1',
        trigger_type: 'element_appeared',
        trigger_value: { selector: '.test' },
      } as PageObject;

      // Should return false for trigger types not in registry
      expect(orchestrator.isPageActive(page)).toBe(false);
    });

    it('should pass payload to manager isActive check', () => {
      const pageObjects: PageObject[] = [
        {
          id: 'page1',
          trigger_type: 'url_change',
          trigger_value: {},
        } as PageObject,
      ];

      const orchestrator = new TriggerOrchestrator(
        pageObjects,
        messageBus,
        globalScope,
      );

      const page = pageObjects[0];
      const payload = { updateActivePages: true };

      // Should pass payload through to manager
      orchestrator.isPageActive(page, payload);
    });
  });

  describe('reset', () => {
    it('should reset all trigger managers', () => {
      const pageObjects: PageObject[] = [
        {
          id: 'page1',
          trigger_type: 'manual',
          trigger_value: { name: 'test-page' },
        } as PageObject,
      ];

      const orchestrator = new TriggerOrchestrator(
        pageObjects,
        messageBus,
        globalScope,
      );

      const page = pageObjects[0];
      const manualManager = orchestrator.getManager('manual');

      // Activate page
      (manualManager as any).toggle('test-page', true);
      expect(orchestrator.isPageActive(page)).toBe(true);

      // Reset
      orchestrator.reset();
      expect(orchestrator.isPageActive(page)).toBe(false);
    });
  });

  describe('getSnapshot', () => {
    it('should return snapshots from all managers', () => {
      const pageObjects: PageObject[] = [
        {
          id: 'page1',
          trigger_type: 'manual',
          trigger_value: { name: 'test-page' },
        } as PageObject,
      ];

      const orchestrator = new TriggerOrchestrator(
        pageObjects,
        messageBus,
        globalScope,
      );

      const snapshot = orchestrator.getSnapshot();

      // Should have snapshots for all registered managers
      expect(snapshot).toHaveProperty('manual');
      expect(snapshot).toHaveProperty('url_change');

      // Manual manager snapshot should be correct
      expect(snapshot.manual).toEqual({
        type: 'manual',
        activatedPages: [],
      });
    });

    it('should reflect current state in snapshots', () => {
      const pageObjects: PageObject[] = [
        {
          id: 'page1',
          trigger_type: 'manual',
          trigger_value: { name: 'test-page' },
        } as PageObject,
      ];

      const orchestrator = new TriggerOrchestrator(
        pageObjects,
        messageBus,
        globalScope,
      );

      const manualManager = orchestrator.getManager('manual');
      (manualManager as any).toggle('test-page', true);

      const snapshot = orchestrator.getSnapshot();

      expect(snapshot.manual).toEqual({
        type: 'manual',
        activatedPages: ['test-page'],
      });
    });
  });

  describe('getManager', () => {
    it('should return specific manager by type', () => {
      const pageObjects: PageObject[] = [];
      const orchestrator = new TriggerOrchestrator(
        pageObjects,
        messageBus,
        globalScope,
      );

      const manualManager = orchestrator.getManager('manual');
      expect(manualManager).toBeDefined();
      expect((manualManager as any).triggerType).toBe('manual');

      const urlManager = orchestrator.getManager('url_change');
      expect(urlManager).toBeDefined();
      expect((urlManager as any).triggerType).toBe('url_change');
    });

    it('should return undefined for unregistered types', () => {
      const pageObjects: PageObject[] = [];
      const orchestrator = new TriggerOrchestrator(
        pageObjects,
        messageBus,
        globalScope,
      );

      const manager = orchestrator.getManager('element_appeared');
      expect(manager).toBeUndefined();
    });
  });

  describe('hasTriggerManager', () => {
    it('should return true for registered trigger types', () => {
      const pageObjects: PageObject[] = [];
      const orchestrator = new TriggerOrchestrator(
        pageObjects,
        messageBus,
        globalScope,
      );

      expect(orchestrator.hasTriggerManager('manual')).toBe(true);
      expect(orchestrator.hasTriggerManager('url_change')).toBe(true);
    });

    it('should return false for unregistered trigger types', () => {
      const pageObjects: PageObject[] = [];
      const orchestrator = new TriggerOrchestrator(
        pageObjects,
        messageBus,
        globalScope,
      );

      expect(orchestrator.hasTriggerManager('element_appeared')).toBe(false);
      expect(orchestrator.hasTriggerManager('element_visible')).toBe(false);
    });
  });
});
