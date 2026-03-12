import { MessageBus } from 'src/subscriptions/message-bus';
import { ManualTriggerManager } from 'src/triggers/manual-trigger-manager';
import { PageObject } from 'src/types';

import { createMockGlobal, setupGlobalObservers } from '../util/mocks';

setupGlobalObservers();

describe('ManualTriggerManager', () => {
  let mockGlobal: ReturnType<typeof createMockGlobal> & typeof globalThis;
  let messageBus: MessageBus;
  let manager: ManualTriggerManager;

  beforeEach(() => {
    mockGlobal = createMockGlobal() as ReturnType<typeof createMockGlobal> &
      typeof globalThis;
    messageBus = new MessageBus();
  });

  const createPageObject = (name: string): PageObject => ({
    id: `page-${name}`,
    name: `Page ${name}`,
    conditions: [],
    trigger_type: 'manual',
    trigger_value: { name },
  });

  describe('initialize', () => {
    test('should initialize with empty state', () => {
      const pages = [createPageObject('test-page')];
      manager = new ManualTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      const snapshot = manager.getSnapshot();
      expect(snapshot.activatedPages).toEqual([]);
    });
  });

  describe('toggle', () => {
    test('should activate page when toggled to true', () => {
      const pages = [createPageObject('test-page')];
      manager = new ManualTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      manager.toggle('test-page', true);

      expect(manager.isActive(pages[0])).toBe(true);
    });

    test('should deactivate page when toggled to false', () => {
      const pages = [createPageObject('test-page')];
      manager = new ManualTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      manager.toggle('test-page', true);
      expect(manager.isActive(pages[0])).toBe(true);

      manager.toggle('test-page', false);
      expect(manager.isActive(pages[0])).toBe(false);
    });

    test('should publish event when toggled', () => {
      const publishSpy = jest.fn();
      messageBus.subscribe('manual', publishSpy);

      const pages = [createPageObject('test-page')];
      manager = new ManualTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      manager.toggle('test-page', true);

      expect(publishSpy).toHaveBeenCalledWith({ name: 'test-page' });
    });

    test('should handle multiple pages independently', () => {
      const pages = [createPageObject('page-1'), createPageObject('page-2')];
      manager = new ManualTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      manager.toggle('page-1', true);

      expect(manager.isActive(pages[0])).toBe(true);
      expect(manager.isActive(pages[1])).toBe(false);

      manager.toggle('page-2', true);

      expect(manager.isActive(pages[0])).toBe(true);
      expect(manager.isActive(pages[1])).toBe(true);
    });
  });

  describe('isActive', () => {
    test('should return false initially', () => {
      const pages = [createPageObject('test-page')];
      manager = new ManualTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      expect(manager.isActive(pages[0])).toBe(false);
    });

    test('should return true after activation', () => {
      const pages = [createPageObject('test-page')];
      manager = new ManualTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      manager.toggle('test-page', true);

      expect(manager.isActive(pages[0])).toBe(true);
    });

    test('should return false after deactivation', () => {
      const pages = [createPageObject('test-page')];
      manager = new ManualTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      manager.toggle('test-page', true);
      manager.toggle('test-page', false);

      expect(manager.isActive(pages[0])).toBe(false);
    });
  });

  describe('reset', () => {
    test('should clear all activations', () => {
      const pages = [createPageObject('page-1'), createPageObject('page-2')];
      manager = new ManualTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      manager.toggle('page-1', true);
      manager.toggle('page-2', true);

      expect(manager.isActive(pages[0])).toBe(true);
      expect(manager.isActive(pages[1])).toBe(true);

      manager.reset();

      expect(manager.isActive(pages[0])).toBe(false);
      expect(manager.isActive(pages[1])).toBe(false);
    });

    test('should result in empty snapshot after reset', () => {
      const pages = [createPageObject('test-page')];
      manager = new ManualTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      manager.toggle('test-page', true);
      manager.reset();

      const snapshot = manager.getSnapshot();
      expect(snapshot.activatedPages).toEqual([]);
    });
  });

  describe('getSnapshot', () => {
    test('should return activated pages', () => {
      const pages = [createPageObject('page-1'), createPageObject('page-2')];
      manager = new ManualTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      manager.toggle('page-1', true);

      const snapshot = manager.getSnapshot();
      expect(snapshot.activatedPages).toEqual(['page-1']);
    });

    test('should reflect current state', () => {
      const pages = [createPageObject('test-page')];
      manager = new ManualTriggerManager(pages, messageBus, mockGlobal);
      manager.initialize();

      let snapshot = manager.getSnapshot();
      expect(snapshot.activatedPages).toEqual([]);

      manager.toggle('test-page', true);
      snapshot = manager.getSnapshot();
      expect(snapshot.activatedPages).toEqual(['test-page']);

      manager.toggle('test-page', false);
      snapshot = manager.getSnapshot();
      expect(snapshot.activatedPages).toEqual([]);
    });
  });
});
