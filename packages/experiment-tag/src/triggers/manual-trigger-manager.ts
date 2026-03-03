import { ManualTriggerPayload } from '../subscriptions/message-bus';
import { ManualTriggerValue, PageObject } from '../types';

import { BaseTriggerManager } from './base-trigger-manager';

interface ManualState {
  activatedPages: Set<string>; // name -> is active
}

/**
 * Manages manual triggers that are activated programmatically.
 */
export class ManualTriggerManager extends BaseTriggerManager<ManualTriggerPayload> {
  readonly triggerType = 'manual' as const;
  private state!: ManualState;

  initialize(): void {
    this.state = {
      activatedPages: new Set(),
    };
  }

  isActive(page: PageObject): boolean {
    const triggerValue = this.getTriggerValue<ManualTriggerValue>(page);
    return this.state.activatedPages.has(triggerValue.name);
  }

  reset(): void {
    // Clear all manual activations
    this.state.activatedPages.clear();
  }

  getSnapshot(): Record<string, any> {
    return {
      activatedPages: Array.from(this.state.activatedPages),
    };
  }

  /**
   * Toggle manual activation state for a page.
   * Public method called from SubscriptionManager.
   */
  public toggle(name: string, isActive: boolean): void {
    if (isActive) {
      this.state.activatedPages.add(name);
    } else {
      this.state.activatedPages.delete(name);
    }
    this.publish({ name });
  }
}
