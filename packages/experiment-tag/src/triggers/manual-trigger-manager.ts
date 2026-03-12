import { MessageBus, ManualTriggerPayload, MessageType } from '../subscriptions/message-bus';
import { PageObject, ManualTriggerValue } from '../types';

/**
 * Manages manual page triggers.
 *
 * Manual triggers are activated programmatically via the trigger() method.
 * This is the simplest trigger type and serves as a reference implementation.
 *
 * Extracted from subscriptions.ts:
 * - manuallyActivatedPageObjects Set (state management)
 * - toggleManualPageObject method (trigger activation)
 * - manual case in isActive check
 */
export class ManualTriggerManager {
  readonly triggerType: MessageType = 'manual';

  // Extracted from subscriptions.ts line 55
  private manuallyActivatedPageObjects: Set<string> = new Set();

  constructor(
    private readonly pageObjects: PageObject[],
    private readonly messageBus: MessageBus,
    private readonly globalScope: typeof globalThis,
  ) {}

  initialize(): void {
    // Manual triggers don't need initialization
  }

  /**
   * Trigger a manual page activation.
   * Extracted from subscriptions.ts toggleManualPageObject method (line 223-230)
   */
  trigger(name: string): void {
    this.manuallyActivatedPageObjects.add(name);
    this.messageBus.publish('manual', { name });
  }

  /**
   * Deactivate a manual page.
   */
  untrigger(name: string): void {
    this.manuallyActivatedPageObjects.delete(name);
    this.messageBus.publish('manual', { name });
  }

  /**
   * Check if manual trigger is active for a page.
   * Extracted from subscriptions.ts line 1097-1100
   */
  isActive(page: PageObject): boolean {
    const triggerValue = page.trigger_value as ManualTriggerValue;
    return this.manuallyActivatedPageObjects.has(triggerValue.name);
  }

  /**
   * Reset manual trigger state.
   * Extracted from subscriptions.ts line 238
   */
  reset(): void {
    this.manuallyActivatedPageObjects.clear();
  }

  getSnapshot() {
    return {
      type: 'manual' as const,
      activePages: Array.from(this.manuallyActivatedPageObjects),
    };
  }
}
