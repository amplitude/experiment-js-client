import { EvaluationEngine } from '@amplitude/experiment-core';

import { DefaultWebExperimentClient, INJECT_ACTION } from './experiment';
import {
  MessageBus,
  MessagePayloads,
  ElementAppearedPayload,
  ManualTriggerPayload,
  ExitIntentPayload,
  MessageType,
} from './message-bus';
import { DebouncedMutationManager } from './mutation-manager';
import {
  ElementAppearedTriggerValue,
  ElementVisibleTriggerValue,
  ManualTriggerValue,
  ExitIntentTriggerValue,
  PageObject,
  PageObjects,
} from './types';

const evaluationEngine = new EvaluationEngine();

type initOptions = {
  useDefaultNavigationHandler?: boolean;
  isVisualEditorMode?: boolean;
};

export type PageChangeEvent = {
  activePages: PageObjects;
};

export class SubscriptionManager {
  private webExperimentClient: DefaultWebExperimentClient;
  private messageBus: MessageBus;
  private pageObjects: PageObjects;
  private options: initOptions;
  private readonly globalScope: typeof globalThis;
  private pageChangeSubscribers: Set<(event: PageChangeEvent) => void> =
    new Set();
  private lastNotifiedActivePages: PageObjects = {};
  private intersectionObservers: Map<string, IntersectionObserver> = new Map();
  private elementVisibilityState: Map<string, boolean> = new Map();
  private elementAppearedState: Map<string, boolean> = new Map();
  private activeElementSelectors: Set<string> = new Set();
  private pageLoadTime: number = Date.now();

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
    this.setupMutationObserverPublisher();
    this.setupVisibilityPublisher();
    this.setupExitIntentPublisher();
    this.setupPageObjectSubscriptions();
    this.setupUrlChangeReset();
    // Initial check for elements that already exist
    this.checkInitialElements();
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
      for (const page of Object.values(pages)) {
        this.messageBus.subscribe(
          page.trigger_type,
          (payload) => {
            if (this.isPageObjectActive(page, payload)) {
              this.webExperimentClient.updateActivePages(
                experiment,
                page,
                true,
              );
            } else {
              this.webExperimentClient.updateActivePages(
                experiment,
                page,
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
              if (page.trigger_type === 'url_change') {
                // First revert all inject actions
                Object.values(
                  this.webExperimentClient.appliedMutations,
                ).forEach((variantMap) => {
                  Object.values(variantMap).forEach((actionMap) => {
                    if (actionMap[INJECT_ACTION]) {
                      Object.values(actionMap[INJECT_ACTION]).forEach(
                        (action) => {
                          action.revert?.();
                        },
                      );
                    }
                  });
                });

                // Then clean up the appliedMutations structure
                const mutations = this.webExperimentClient.appliedMutations;
                Object.keys(mutations).forEach((flagKey) => {
                  const variantMap = mutations[flagKey];
                  Object.keys(variantMap).forEach((variantKey) => {
                    if (variantMap[variantKey][INJECT_ACTION]) {
                      delete variantMap[variantKey][INJECT_ACTION];

                      if (Object.keys(variantMap[variantKey]).length === 0) {
                        delete variantMap[variantKey];
                      }
                    }
                  });

                  if (Object.keys(variantMap).length === 0) {
                    delete mutations[flagKey];
                  }
                });
              }
              this.webExperimentClient.applyVariants();
              if (this.webExperimentClient.isPreviewMode) {
                this.webExperimentClient.previewVariants({
                  keyToVariant: this.webExperimentClient.previewFlags,
                });
              }
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

  // TODO: to cleanup and centralize state management
  private setupUrlChangeReset = () => {
    // Reset element state on URL navigation
    this.messageBus.subscribe('url_change', () => {
      this.elementAppearedState.clear();
      this.activeElementSelectors.clear();
      this.pageLoadTime = Date.now();
      const elementSelectors = this.getElementSelectors();
      elementSelectors.forEach((selector) =>
        this.activeElementSelectors.add(selector),
      );
      this.setupVisibilityPublisher();
      this.checkInitialElements();
    });
  };

  private checkInitialElements = () => {
    // Trigger initial check for element_appeared triggers
    this.messageBus.publish('element_appeared', { mutationList: [] });
  };

  private getElementSelectors(): Set<string> {
    const selectors = new Set<string>();

    for (const pages of Object.values(this.pageObjects)) {
      for (const page of Object.values(pages)) {
        if (
          page.trigger_type === 'element_appeared' ||
          page.trigger_type === 'element_visible'
        ) {
          const triggerValue = page.trigger_value as
            | ElementAppearedTriggerValue
            | ElementVisibleTriggerValue;
          const selector = triggerValue.selector;
          if (selector) {
            selectors.add(selector);
          }
        }
      }
    }

    return selectors;
  }

  private isMutationRelevantToSelector(
    mutationList: MutationRecord[],
    selector: string,
  ): boolean {
    for (const mutation of mutationList) {
      // Check if any added nodes match the selector
      if (mutation.addedNodes.length > 0) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof Element) {
            try {
              // Check if the added node itself matches
              if (node.matches(selector)) {
                return true;
              }
              // Check if any descendant matches
              if (node.querySelector(selector)) {
                return true;
              }
            } catch (e) {
              // Invalid selector, skip
              continue;
            }
          }
        }
      }

      // Check if mutation target or its ancestors/descendants match
      if (mutation.target instanceof Element) {
        try {
          // Check if target matches
          if (mutation.target.matches(selector)) {
            return true;
          }
          // Check if target contains matching elements
          if (mutation.target.querySelector(selector)) {
            return true;
          }
        } catch (e) {
          // Invalid selector, skip
          continue;
        }
      }
    }

    return false;
  }

  private setupMutationObserverPublisher = () => {
    this.activeElementSelectors = this.getElementSelectors();

    // Create filter function that checks against active selectors (dynamic)
    // As elements appear and are removed from activeElementSelectors,
    // fewer mutations will pass the filter, improving performance over time
    const filters =
      this.activeElementSelectors.size > 0
        ? [
            (mutation: MutationRecord) => {
              // Check against active selectors only (not already appeared)
              return Array.from(this.activeElementSelectors).some((selector) =>
                this.isMutationRelevantToSelector([mutation], selector),
              );
            },
          ]
        : [];

    const mutationManager = new DebouncedMutationManager(
      this.globalScope.document.documentElement,
      (mutationList) => {
        this.messageBus.publish('element_appeared', { mutationList });
      },
      filters,
    );
    return mutationManager.observe();
  };

  private setupVisibilityPublisher = () => {
    // Set up IntersectionObservers for each element_visible page object
    for (const pages of Object.values(this.pageObjects)) {
      for (const page of Object.values(pages)) {
        if (page.trigger_type === 'element_visible') {
          const triggerValue = page.trigger_value as ElementVisibleTriggerValue;
          const selector = triggerValue.selector;
          const visibilityRatio = triggerValue.visibilityRatio ?? 0;

          // Create unique key for this selector + threshold combination
          const observerKey = `${selector}:${visibilityRatio}`;

          // Skip if we already have an observer for this selector + threshold
          if (this.intersectionObservers.has(observerKey)) {
            continue;
          }

          // Create IntersectionObserver for this threshold
          const observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                const isVisible = entry.intersectionRatio >= visibilityRatio;

                // Update visibility state
                this.elementVisibilityState.set(observerKey, isVisible);

                // If element becomes visible, disconnect observer (one-time trigger)
                if (isVisible) {
                  observer.disconnect();
                  this.intersectionObservers.delete(observerKey);

                  // Publish element_visible event
                  this.messageBus.publish('element_visible', {
                    mutationList: [],
                  });
                }
              });
            },
            {
              threshold: visibilityRatio,
            },
          );

          this.intersectionObservers.set(observerKey, observer);

          // Observe the element if it exists
          const element = this.globalScope.document.querySelector(selector);
          if (element) {
            observer.observe(element);
          }
        }
      }
    }

    // Re-check for elements on mutations (in case they appear later)
    this.messageBus.subscribe('element_appeared', (payload) => {
      const { mutationList } = payload;

      for (const [
        observerKey,
        observer,
      ] of this.intersectionObservers.entries()) {
        const [selector] = observerKey.split(':');

        // Check if mutation is relevant (or if it's the initial check with empty list)
        const isRelevant =
          mutationList.length === 0 ||
          this.isMutationRelevantToSelector(mutationList, selector);

        if (isRelevant) {
          const element = this.globalScope.document.querySelector(selector);
          if (element) {
            observer.observe(element);
          }
        }
      }
    });
  };

  private setupExitIntentPublisher = () => {
    // Get all page objects that use exit_intent trigger
    const pages = Object.values(this.pageObjects).flatMap((pages) =>
      Object.values(pages).filter(
        (page) => page.trigger_type === 'exit_intent',
      ),
    );

    if (pages.length === 0) {
      return;
    }

    // Get minimum time requirement (use lowest value so listener activates earliest)
    let minTimeOnPageMs = 0;
    for (const page of pages) {
      const triggerValue = page.trigger_value as ExitIntentTriggerValue;
      minTimeOnPageMs = Math.min(
        minTimeOnPageMs,
        triggerValue.minTimeOnPageMs ?? 0,
      );
    }

    // Detect exit intent via mouse movement
    const handleMouseLeave = (event: MouseEvent) => {
      // Only trigger if:
      // 1. Mouse Y position is near top of viewport (leaving towards browser chrome)
      // 2. Mouse is leaving the document (relatedTarget is null)
      // 3. Not already triggered
      if (
        event.clientY <= 50 && // 50px from top
        event.relatedTarget === null
      ) {
        this.messageBus.publish('exit_intent', {
          durationMs: Date.now() - this.pageLoadTime,
        });
      }
    };

    // Install listener after minimum time requirement
    if (minTimeOnPageMs > 0) {
      setTimeout(() => {
        this.globalScope.document.addEventListener(
          'mouseleave',
          handleMouseLeave,
        );
      }, minTimeOnPageMs);
    } else {
      // Install immediately if no time requirement
      this.globalScope.document.addEventListener(
        'mouseleave',
        handleMouseLeave,
      );
    }
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

      case 'manual': {
        const triggerValue = page.trigger_value as ManualTriggerValue;
        return (message as ManualTriggerPayload).name === triggerValue.name;
      }

      // case 'analytics_event': {
      //   const eventMessage = message as AnalyticsEventPayload;
      //   return (
      //     eventMessage.event_type === page.trigger_value.event_type &&
      //     Object.entries(page.trigger_value.event_properties || {}).every(
      //       ([key, value]) => eventMessage.event_properties[key] === value,
      //     )
      //   );
      // }

      case 'element_appeared': {
        const triggerValue = page.trigger_value as ElementAppearedTriggerValue;
        const selector = triggerValue.selector;

        // Check if we've already marked this element as appeared
        if (this.elementAppearedState.get(selector)) {
          return true;
        }

        // Check if mutation is relevant to this selector before querying DOM
        // Skip this check if mutationList is empty (initial check)
        const elementAppearedMessage = message as ElementAppearedPayload;
        if (
          elementAppearedMessage.mutationList.length > 0 &&
          !this.isMutationRelevantToSelector(
            elementAppearedMessage.mutationList,
            selector,
          )
        ) {
          return false;
        }

        // Check if element exists and is not hidden
        const element = this.globalScope.document.querySelector(selector);
        if (element) {
          const style = window.getComputedStyle(element);
          const hasAppeared =
            style.display !== 'none' && style.visibility !== 'hidden';

          // Once it appears, remember it and remove from active checking
          if (hasAppeared) {
            this.elementAppearedState.set(selector, true);
            this.activeElementSelectors.delete(selector);
          }

          return hasAppeared;
        }
        return false;
      }

      case 'element_visible': {
        const triggerValue = page.trigger_value as ElementVisibleTriggerValue;
        const selector = triggerValue.selector;
        const visibilityRatio = triggerValue.visibilityRatio ?? 0;
        const observerKey = `${selector}:${visibilityRatio}`;

        // Check stored visibility state from IntersectionObserver
        return this.elementVisibilityState.get(observerKey) ?? false;
      }

      case 'exit_intent': {
        const durationMs = (message as ExitIntentPayload).durationMs;
        const triggerValue = page.trigger_value as ExitIntentTriggerValue;
        return (
          triggerValue.minTimeOnPageMs === undefined ||
          durationMs >= triggerValue.minTimeOnPageMs
        );
      }

      default:
        return false;
    }
  };

  private cloneActivePagesMap = (map: PageObjects): PageObjects => {
    const clone: PageObjects = {};
    for (const outerKey in map) {
      clone[outerKey] = {};
      for (const innerKey in map[outerKey]) {
        clone[outerKey][innerKey] = { ...map[outerKey][innerKey] };
      }
    }
    return clone;
  };

  private areActivePagesEqual = (a: PageObjects, b: PageObjects): boolean => {
    const aOuterKeys = Object.keys(a);
    const bOuterKeys = Object.keys(b);
    if (aOuterKeys.length !== bOuterKeys.length) return false;

    for (const outerKey of aOuterKeys) {
      const aInner = a[outerKey];
      const bInner = b[outerKey];
      if (!bInner) return false;

      const aInnerKeys = Object.keys(aInner);
      const bInnerKeys = Object.keys(bInner);
      if (aInnerKeys.length !== bInnerKeys.length) return false;

      for (const innerKey of aInnerKeys) {
        const aPage = aInner[innerKey];
        const bPage = bInner[innerKey];
        if (!bPage || aPage.id !== bPage.id) return false;
      }
    }

    return true;
  };
}
