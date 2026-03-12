import { MessageBus, MessageType } from '../subscriptions/message-bus';
import { PageObject } from '../types';

import { TriggerManager } from './base-trigger-manager';
import { ManualTriggerManager } from './manual-trigger-manager';
import { UrlChangeTriggerManager } from './url-change-trigger-manager';

// Export all managers
export * from './base-trigger-manager';
export * from './manual-trigger-manager';
export * from './url-change-trigger-manager';

/**
 * Options that can be passed to trigger managers during initialization.
 */
export interface TriggerManagerOptions {
  useDefaultNavigationHandler?: boolean;
}

/**
 * Trigger types that have dedicated managers.
 * Note: element_appeared_internal is a message type but not a trigger type.
 */
type TriggerType = Exclude<MessageType, 'element_appeared_internal'>;

/**
 * Registry of trigger managers available in this version.
 * Additional managers will be added in subsequent releases.
 */
export const TRIGGER_MANAGER_REGISTRY: Partial<
  Record<
    TriggerType,
    new (
      pageObjects: PageObject[],
      messageBus: MessageBus,
      globalScope: typeof globalThis,
      options?: TriggerManagerOptions,
    ) => TriggerManager
  >
> = {
  manual: ManualTriggerManager,
  url_change: UrlChangeTriggerManager,
};
