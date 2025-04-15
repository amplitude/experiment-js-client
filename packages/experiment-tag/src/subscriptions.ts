import { EvaluationEngine } from '@amplitude/experiment-core';

import { activePagesMap, DefaultWebExperimentClient } from './experiment';
import {
  MessageBus,
  MessagePayloads,
  AnalyticsEventPayload,
  ManualTriggerPayload,
  MessageType,
} from './message-bus';
import { DebouncedMutationManager } from './mutation-manager';
import { PageObject, PageObjects } from './types';

const evaluationEngine = new EvaluationEngine();

type initOptions = {
  useDefaultNavigationHandler?: boolean;
  isVisualEditorMode?: boolean;
};

export type PageChangeEvent = {
  activePages: activePagesMap;
};

export class SubscriptionManager {
  private webExperimentClient: DefaultWebExperimentClient;
  private messageBus: MessageBus;
  private pageObjects: PageObjects;
  private options: initOptions;
  private readonly globalScope: typeof globalThis;
  private pageChangeSubscribers: Set<(event: PageChangeEvent) => void> =
    new Set();
  private lastNotifiedActivePages: activePagesMap = {};

  constructor(
    webExperimentClient: DefaultWebExperimentClient,
    messageBus: MessageBus,
    pageObjects: PageObjects,
    options: initOptions,
    globalScope: typeof globalThis,
  ) {
    this.webExperimentClient = webExperimentClient;
    this.messageBus = messageBus;
    this.pageObjects = pageObjects;
    this.options = options;
    this.globalScope = globalScope;
  }

  public setPageObjects = (pageObjects: PageObjects) => {
    this.pageObjects = pageObjects;
  };

  public initSubscriptions = () => {
    if (this.options.useDefaultNavigationHandler) {
      this.setupLocationChangePublisher();
    }
    // this.setupMutationObserverPublisher();
    this.setupPageObjectSubscriptions();
  };

  /**
   * Adds a subscriber to the page change event. Returns a function to unsubscribe.
   * @param callback
   */

  public addPageChangeSubscriber = (
    callback: (event: PageChangeEvent) => void,
  ): (() => void) => {
    this.pageChangeSubscribers.add(callback);
    return () => {
      this.pageChangeSubscribers.delete(callback);
    };
  };

  public setupPageObjectSubscriptions = () => {
    for (const [experiment, pages] of Object.entries(this.pageObjects)) {
      for (const [pageName, page] of Object.entries(pages)) {
        this.messageBus.subscribe(
          page.trigger_type,
          (payload) => {
            if (this.isPageObjectActive(page, payload)) {
              this.webExperimentClient.updateActivePages(
                experiment,
                pageName,
                true,
              );
            } else {
              this.webExperimentClient.updateActivePages(
                experiment,
                pageName,
                false,
              );
            }
          },
          undefined,
          (payload) => {
            if (
              (!('updateActivePages' in payload) ||
                !payload.updateActivePages) &&
              !this.options.isVisualEditorMode
            ) {
              this.webExperimentClient.applyVariants();
            }

            const activePages = this.webExperimentClient.getActivePages();

            if (
              !this.areActivePagesEqual(
                activePages,
                this.lastNotifiedActivePages,
              )
            ) {
              this.lastNotifiedActivePages =
                this.cloneActivePagesMap(activePages);
              for (const subscriber of this.pageChangeSubscribers) {
                subscriber({ activePages });
              }
            }
          },
        );
      }
    }
  };

  private setupMutationObserverPublisher = () => {
    const mutationManager = new DebouncedMutationManager(
      this.globalScope.document.documentElement,
      (mutationList) => {
        this.messageBus.publish('element_appeared', { mutationList });
      },
      [],
    );
    return mutationManager.observe();
  };

  private setupLocationChangePublisher = () => {
    // Add URL change listener for back/forward navigation
    this.globalScope.addEventListener('popstate', () => {
      this.messageBus.publish('url_change');
    });

    const handleUrlChange = () => {
      this.messageBus.publish('url_change');
      this.globalScope.webExperiment.previousUrl =
        this.globalScope.location.href;
    };

    // Create wrapper functions for pushState and replaceState
    const wrapHistoryMethods = () => {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      // Wrapper for pushState
      history.pushState = function (...args) {
        // Call the original pushState
        const result = originalPushState.apply(this, args);
        // Revert mutations and apply variants
        handleUrlChange();
        return result;
      };

      // Wrapper for replaceState
      history.replaceState = function (...args) {
        // Call the original replaceState
        const result = originalReplaceState.apply(this, args);
        // Revert mutations and apply variants
        handleUrlChange();
        return result;
      };
    };

    // Initialize the wrapper
    wrapHistoryMethods();
  };

  private isPageObjectActive = <T extends MessageType>(
    page: PageObject,
    message: MessagePayloads[T],
  ): boolean => {
    // Check conditions
    if (page.conditions && page.conditions.length > 0) {
      const matchConditions = evaluationEngine.evaluateConditions(
        {
          context: { page: { url: this.globalScope.location.href } },
          result: {},
        },
        page.conditions,
      );
      if (!matchConditions) {
        return false;
      }
    }

    // Check if page is active
    switch (page.trigger_type) {
      case 'url_change':
        return true;

      case 'manual':
        return (
          (message as ManualTriggerPayload).name === page.trigger_value.name
        );

      case 'analytics_event': {
        const eventMessage = message as AnalyticsEventPayload;
        return (
          eventMessage.event_type === page.trigger_value.event_type &&
          Object.entries(page.trigger_value.event_properties || {}).every(
            ([key, value]) => eventMessage.event_properties[key] === value,
          )
        );
      }

      case 'element_appeared': {
        // const mutationMessage = message as DomMutationPayload;
        const element = this.globalScope.document.querySelector(
          page.trigger_value.selector as string,
        );
        if (element) {
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }
        return false;
      }

      default:
        return false;
    }
  };

  private cloneActivePagesMap = (map: activePagesMap): activePagesMap => {
    const clone: activePagesMap = {};
    for (const key in map) {
      clone[key] = new Set(map[key]);
    }
    return clone;
  };

  private areActivePagesEqual = (
    a: activePagesMap,
    b: activePagesMap,
  ): boolean => {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      const aSet = a[key];
      const bSet = b[key];
      if (!bSet || aSet.size !== bSet.size) return false;

      for (const value of aSet) {
        if (!bSet.has(value)) return false;
      }
    }
    return true;
  };
}
