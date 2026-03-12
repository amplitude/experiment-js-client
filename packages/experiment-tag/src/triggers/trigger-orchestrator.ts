import { MessageBus, MessageType } from '../subscriptions/message-bus';
import { PageObject } from '../types';

import { TriggerManager } from './base-trigger-manager';
import { TRIGGER_MANAGER_REGISTRY, TriggerManagerOptions } from './index';

/**
 * Orchestrates all trigger managers registered in TRIGGER_MANAGER_REGISTRY.
 * Instantiates, initializes, and coordinates trigger managers.
 */
export class TriggerOrchestrator {
  private managers: Map<MessageType, TriggerManager> = new Map();

  constructor(
    private readonly pageObjects: PageObject[],
    private readonly messageBus: MessageBus,
    private readonly globalScope: typeof globalThis,
    private readonly options?: TriggerManagerOptions,
  ) {
    this.initializeManagers();
  }

  /**
   * Initialize all registered trigger managers.
   */
  private initializeManagers(): void {
    for (const [triggerType, ManagerClass] of Object.entries(
      TRIGGER_MANAGER_REGISTRY,
    )) {
      if (!ManagerClass) continue;

      const manager = new ManagerClass(
        this.pageObjects,
        this.messageBus,
        this.globalScope,
        this.options,
      );
      manager.initialize();
      this.managers.set(triggerType as MessageType, manager);
    }
  }

  /**
   * Check if a page's trigger is currently active.
   * Returns true if the page's trigger type has a manager and that manager reports it as active.
   */
  isPageActive(page: PageObject, payload?: any): boolean {
    const manager = this.managers.get(page.trigger_type);
    if (!manager) {
      // No manager for this trigger type - not handled by orchestrator
      return false;
    }
    return manager.isActive(page, payload);
  }

  /**
   * Reset all trigger managers.
   */
  reset(): void {
    for (const manager of this.managers.values()) {
      manager.reset();
    }
  }

  /**
   * Get snapshot of all trigger managers' state.
   */
  getSnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    for (const [triggerType, manager] of this.managers.entries()) {
      if (manager.getSnapshot) {
        snapshot[triggerType] = manager.getSnapshot();
      }
    }
    return snapshot;
  }

  /**
   * Get a specific trigger manager by type.
   */
  getManager<T extends TriggerManager = TriggerManager>(
    triggerType: MessageType,
  ): T | undefined {
    return this.managers.get(triggerType) as T | undefined;
  }

  /**
   * Check if a trigger type is managed by the orchestrator.
   */
  hasTriggerManager(triggerType: MessageType): boolean {
    return this.managers.has(triggerType);
  }
}
