import { UrlChangePayload } from '../subscriptions/message-bus';
import { PageObject } from '../types';

import { BaseTriggerManager } from './base-trigger-manager';

import { TriggerManagerOptions } from './index';

/**
 * Manages url_change triggers.
 * Wraps browser history methods and listens to navigation events to publish url_change events.
 */
export class UrlChangeTriggerManager extends BaseTriggerManager<UrlChangePayload> {
  readonly triggerType = 'url_change' as const;
  private lastPublishedUrl: string | null = null;
  private useDefaultNavigationHandler: boolean;

  constructor(
    pageObjects: PageObject[],
    messageBus: any,
    globalScope: typeof globalThis,
    options?: TriggerManagerOptions,
  ) {
    super(pageObjects, messageBus, globalScope);
    this.useDefaultNavigationHandler =
      options?.useDefaultNavigationHandler ?? false;
  }

  initialize(): void {
    if (!this.useDefaultNavigationHandler) {
      return;
    }

    // Add URL change listener for back/forward navigation
    this.globalScope.addEventListener('popstate', () => {
      const currentUrl = this.globalScope.location.href;
      if (currentUrl === this.lastPublishedUrl) {
        return;
      }

      this.lastPublishedUrl = currentUrl;
      this.publish();
    });

    const handleUrlChange = () => {
      const currentUrl = this.globalScope.location.href;
      if (currentUrl === this.lastPublishedUrl) {
        return;
      }

      this.lastPublishedUrl = currentUrl;
      this.publish();
      this.globalScope.webExperiment.previousUrl = currentUrl;
    };

    // Wrap history methods to detect navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    // Wrapper for pushState
    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      handleUrlChange();
      return result;
    };

    // Wrapper for replaceState
    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      handleUrlChange();
      return result;
    };
  }

  isActive(_page: PageObject): boolean {
    // url_change pages are always considered active
    // (their conditions are evaluated separately)
    return true;
  }

  reset(): void {
    // No state to reset
  }

  getSnapshot(): Record<string, any> {
    return {
      type: 'url_change',
      lastPublishedUrl: this.lastPublishedUrl,
      navigationHandlerEnabled: this.useDefaultNavigationHandler,
    };
  }

  /**
   * Mark a URL as published to avoid duplicate url_change events
   */
  public markUrlAsPublished(url: string): void {
    this.lastPublishedUrl = url;
  }
}
