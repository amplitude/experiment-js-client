import { MessageBus, MessageType } from '../subscriptions/message-bus';
import { PageObject } from '../types';

import { AnalyticsEventTriggerManager } from './analytics-event-trigger-manager';
import { TriggerManager } from './base-trigger-manager';
import { ElementAppearedTriggerManager } from './element-appeared-trigger-manager';
import { ElementVisibleTriggerManager } from './element-visible-trigger-manager';
import { ExitIntentTriggerManager } from './exit-intent-trigger-manager';
import { ManualTriggerManager } from './manual-trigger-manager';
import { ScrolledToTriggerManager } from './scrolled-to-trigger-manager';
import { TimeOnPageTriggerManager } from './time-on-page-trigger-manager';
import { UrlChangeTriggerManager } from './url-change-trigger-manager';
import { UserInteractionTriggerManager } from './user-interaction-trigger-manager';

// Export all managers
export * from './base-trigger-manager';
export * from './element-visible-trigger-manager';
export * from './element-appeared-trigger-manager';
export * from './user-interaction-trigger-manager';
export * from './scrolled-to-trigger-manager';
export * from './time-on-page-trigger-manager';
export * from './exit-intent-trigger-manager';
export * from './analytics-event-trigger-manager';
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
 * Registry of all available trigger manager types.
 * Maps trigger type to manager class constructor.
 */
export const TRIGGER_MANAGER_REGISTRY: Record<
  TriggerType,
  new (
    pageObjects: PageObject[],
    messageBus: MessageBus,
    globalScope: typeof globalThis,
    options?: TriggerManagerOptions,
  ) => TriggerManager
> = {
  element_appeared: ElementAppearedTriggerManager,
  element_visible: ElementVisibleTriggerManager,
  user_interaction: UserInteractionTriggerManager,
  time_on_page: TimeOnPageTriggerManager,
  scrolled_to: ScrolledToTriggerManager,
  exit_intent: ExitIntentTriggerManager,
  analytics_event: AnalyticsEventTriggerManager,
  manual: ManualTriggerManager,
  url_change: UrlChangeTriggerManager,
};
