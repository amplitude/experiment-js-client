import {
  MessageBus,
  MessagePayloads,
  MessageType,
} from '../subscriptions/message-bus';
import { PageObject } from '../types';

import { TriggerManagerOptions } from './index';

/**
 * Base interface that all trigger managers must implement.
 * Each trigger type (element_visible, user_interaction, etc.) has its own manager.
 */
export interface TriggerManager<TPayload = any> {
  /**
   * Trigger type this manager handles
   */
  readonly triggerType: MessageType;

  /**
   * Initialize listeners, observers, and event handlers for this trigger type.
   * Called once during setup.
   */
  initialize(): void;

  /**
   * Check if a specific page object is currently active based on trigger state.
   * @param page - The page object to check
   * @param payload - Optional message payload (for event-driven triggers)
   */
  isActive(page: PageObject, payload?: TPayload): boolean;

  /**
   * Reset trigger state (called on URL change).
   * Should clear state but may keep listeners active if appropriate.
   */
  reset(): void;

  /**
   * Get debug snapshot of current state (optional, for debugging).
   */
  getSnapshot?(): Record<string, any>;

  /**
   * Mark a URL as published (optional, for url_change manager).
   */
  markUrlAsPublished?(url: string): void;

  /**
   * Trigger an initial check (optional, for element_appeared manager).
   */
  triggerInitialCheck?(): void;
}

/**
 * Abstract base class providing common functionality for trigger managers.
 * Reduces boilerplate in individual managers.
 */
export abstract class BaseTriggerManager<TPayload = any>
  implements TriggerManager<TPayload>
{
  constructor(
    protected readonly pageObjects: PageObject[],
    protected readonly messageBus: MessageBus,
    protected readonly globalScope: typeof globalThis,
    protected readonly options?: TriggerManagerOptions,
  ) {}

  abstract readonly triggerType: MessageType;
  abstract initialize(): void;
  abstract isActive(page: PageObject, payload?: TPayload): boolean;
  abstract reset(): void;

  /**
   * Publish message to message bus
   */
  protected publish(payload?: MessagePayloads[MessageType]): void {
    this.messageBus.publish(this.triggerType, payload as any);
  }

  /**
   * Helper to get trigger value with proper typing
   */
  protected getTriggerValue<T>(page: PageObject): T {
    return page.trigger_value as T;
  }

  /**
   * Helper to clear a timeout safely
   */
  protected clearTimeout(timeoutId: ReturnType<typeof setTimeout>): void {
    this.globalScope.clearTimeout(timeoutId);
  }

  /**
   * Helper to clear multiple timeouts
   */
  protected clearTimeouts(
    timeouts: Iterable<ReturnType<typeof setTimeout>>,
  ): void {
    for (const timeout of timeouts) {
      this.clearTimeout(timeout);
    }
  }

  /**
   * Helper to disconnect an observer safely
   */
  protected disconnectObserver(observer: IntersectionObserver): void {
    observer.disconnect();
  }

  /**
   * Helper to disconnect multiple observers
   */
  protected disconnectObservers(
    observers: Iterable<IntersectionObserver>,
  ): void {
    for (const observer of observers) {
      this.disconnectObserver(observer);
    }
  }
}
