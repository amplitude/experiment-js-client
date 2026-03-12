import { MessageType } from '../subscriptions/message-bus';
import { PageObject } from '../types';

import { BaseTriggerManager } from './base-trigger-manager';
import { TriggerManagerOptions } from './index';

/**
 * Manages URL change triggers.
 *
 * URL change triggers activate whenever the URL changes through:
 * - Browser back/forward navigation (popstate)
 * - history.pushState (when navigation handler is enabled)
 * - history.replaceState (when navigation handler is enabled)
 *
 * EXTRACTED FROM subscriptions.ts:
 * - Line 76: lastPublishedUrl state
 * - Line 96-98: markUrlAsPublished method
 * - Line 563-612: setupLocationChangePublisher method
 * - Line 1097-1098: case 'url_change' in isPageActive
 */
export class UrlChangeTriggerManager extends BaseTriggerManager {
  readonly triggerType: MessageType = 'url_change';

  // EXTRACTED FROM subscriptions.ts line 76
  private lastPublishedUrl: string | null = null;
  private navigationHandlerEnabled: boolean = false;

  constructor(
    pageObjects: PageObject[],
    messageBus: any,
    globalScope: typeof globalThis,
    options?: TriggerManagerOptions,
  ) {
    super(pageObjects, messageBus, globalScope, options);
    this.navigationHandlerEnabled =
      options?.useDefaultNavigationHandler ?? false;
  }

  /**
   * Initialize URL change listeners.
   * EXTRACTED FROM subscriptions.ts setupLocationChangePublisher (line 563-612)
   */
  initialize(): void {
    if (!this.navigationHandlerEnabled) {
      // Navigation handler is disabled, don't set up listeners
      return;
    }

    // Add URL change listener for back/forward navigation
    this.globalScope.addEventListener('popstate', () => {
      this.handleUrlChange();
    });

    // Wrap history methods
    this.wrapHistoryMethods();
  }

  /**
   * Mark a URL as already published to prevent duplicate events.
   * EXTRACTED FROM subscriptions.ts markUrlAsPublished (line 96-98)
   */
  markUrlAsPublished(url: string): void {
    this.lastPublishedUrl = url;
  }

  /**
   * Handle URL change and publish event if URL changed.
   * EXTRACTED FROM subscriptions.ts handleUrlChange (line 575-584)
   */
  private handleUrlChange(): void {
    const currentUrl = this.globalScope.location.href;
    if (currentUrl === this.lastPublishedUrl) {
      return;
    }

    this.lastPublishedUrl = currentUrl;
    this.publish();

    // Update previousUrl if webExperiment exists
    if (this.globalScope.webExperiment) {
      this.globalScope.webExperiment.previousUrl = currentUrl;
    }
  }

  /**
   * Wrap history.pushState and history.replaceState to detect URL changes.
   * EXTRACTED FROM subscriptions.ts wrapHistoryMethods (line 586-608)
   */
  private wrapHistoryMethods(): void {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    const handleUrlChange = () => this.handleUrlChange();

    // Wrapper for pushState
    history.pushState = function (...args) {
      // Call the original pushState
      const result = originalPushState.apply(this, args);
      // Handle URL change
      handleUrlChange();
      return result;
    };

    // Wrapper for replaceState
    history.replaceState = function (...args) {
      // Call the original replaceState
      const result = originalReplaceState.apply(this, args);
      // Handle URL change
      handleUrlChange();
      return result;
    };
  }

  /**
   * Check if URL change trigger is active for a page.
   * URL change pages are always active (triggers on every URL change).
   * EXTRACTED FROM subscriptions.ts line 1097-1098
   */
  isActive(page: PageObject): boolean {
    return true;
  }

  /**
   * Reset is a no-op for URL change trigger.
   * URL change state persists across navigations.
   */
  reset(): void {
    // No state to reset - URL change state persists
  }

  getSnapshot() {
    return {
      type: 'url_change' as const,
      lastPublishedUrl: this.lastPublishedUrl,
      navigationHandlerEnabled: this.navigationHandlerEnabled,
    };
  }
}
