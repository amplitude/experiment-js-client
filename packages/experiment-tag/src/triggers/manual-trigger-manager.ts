import { MessageType } from '../subscriptions/message-bus';
import { PageObject, ManualTriggerValue } from '../types';

import { BaseTriggerManager } from './base-trigger-manager';

/**
 * Manages manual page triggers.
 *
 * Manual triggers are activated programmatically via the trigger() method.
 *
 * EXTRACTED FROM subscriptions.ts:
 * - Line 55: manuallyActivatedPageObjects Set
 * - Line 223-230: toggleManualPageObject method
 * - Line 238: manuallyActivatedPageObjects.clear() in resetTriggerStates
 * - Line 1090-1093: case 'manual' in isPageActive
 */
export class ManualTriggerManager extends BaseTriggerManager {
  readonly triggerType: MessageType = 'manual';

  // EXTRACTED FROM subscriptions.ts line 55
  private manuallyActivatedPageObjects: Set<string> = new Set();

  initialize(): void {
    // Manual triggers don't need initialization
  }

  /**
   * Toggle manual page activation.
   * EXTRACTED FROM subscriptions.ts toggleManualPageObject (line 223-230)
   */
  toggle(name: string, isActive: boolean): void {
    if (isActive) {
      this.manuallyActivatedPageObjects.add(name);
    } else {
      this.manuallyActivatedPageObjects.delete(name);
    }
    this.publish({ name });
  }

  /**
   * Check if manual trigger is active for a page.
   * EXTRACTED FROM subscriptions.ts line 1090-1093
   */
  isActive(page: PageObject): boolean {
    const triggerValue = page.trigger_value as ManualTriggerValue;
    return this.manuallyActivatedPageObjects.has(triggerValue.name);
  }

  /**
   * Reset manual trigger state.
   * EXTRACTED FROM subscriptions.ts line 238
   */
  reset(): void {
    this.manuallyActivatedPageObjects.clear();
  }

  getSnapshot() {
    return {
      type: 'manual' as const,
      activatedPages: Array.from(this.manuallyActivatedPageObjects),
    };
  }
}
