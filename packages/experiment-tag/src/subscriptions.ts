import { EvaluationEngine } from '@amplitude/experiment-core';

import { DefaultWebExperimentClient, INJECT_ACTION } from './experiment';
import {
  MessageBus,
  MessagePayloads,
  ElementAppearedPayload,
  ManualTriggerPayload,
  MessageType,
  ScrolledToPayload,
} from './message-bus';
import { DebouncedMutationManager } from './mutation-manager';
import {
  ElementAppearedTriggerValue,
  ElementVisibleTriggerValue,
  ManualTriggerValue,
  PageObject,
  PageObjects,
  ScrolledToTriggerValue,
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
  private scrolledToObservers: Map<string, IntersectionObserver> = new Map();
  private scrolledToElementState: Map<string, boolean> = new Map();
  private maxScrollPercentage = 0;

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
    this.setupScrolledToPublisher();
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

  private setupScrolledToPublisher = () => {
    // Check if we have any scrolled_to triggers
    let hasPercentTrigger = false;
    let hasElementTrigger = false;
    const pages = Object.values(this.pageObjects).flatMap((pages) =>
      Object.values(pages).filter(
        (page) => page.trigger_type === 'scrolled_to',
      ),
    );

    for (const page of pages) {
      if (page.trigger_type === 'scrolled_to') {
        const triggerValue = page.trigger_value as ScrolledToTriggerValue;
        if (triggerValue.mode === 'percent') {
          hasPercentTrigger = true;
        } else if (triggerValue.mode === 'element') {
          hasElementTrigger = true;
        }
      }
    }

    // Setup percentage-based scroll listener if needed
    if (hasPercentTrigger) {
      let rafId: number | null = null;

      const handleScroll = () => {
        const scrollPercentage = this.calculateScrollPercentage();
        // Track maximum scroll percentage reached
        if (scrollPercentage > this.maxScrollPercentage) {
          this.maxScrollPercentage = scrollPercentage;
          this.messageBus.publish('scrolled_to', {});
        }
      };

      const throttledScroll = () => {
        // Cancel any pending animation frame
        if (rafId !== null) {
          return;
        }

        // Schedule the handler to run on the next animation frame
        rafId = this.globalScope.requestAnimationFrame(() => {
          handleScroll();
          rafId = null;
        });
      };

      this.globalScope.addEventListener('scroll', throttledScroll, {
        passive: true,
      });

      // Initial check
      handleScroll();
    }

    // Setup IntersectionObserver for element-based triggers
    if (hasElementTrigger) {
      for (const page of pages) {
        if (page.trigger_type === 'scrolled_to') {
          const triggerValue = page.trigger_value as ScrolledToTriggerValue;

          if (triggerValue.mode === 'element') {
            const selector = triggerValue.selector;
            const offsetPx = triggerValue.offsetPx || 0;
            // Use null byte as delimiter
            const observerKey = `${selector}\0${offsetPx}`;

            // Skip if we already have an observer for this selector + offset
            if (this.scrolledToObservers.has(observerKey)) {
              continue;
            }

            // Create root margin based on offset
            // Negative bottom margin means trigger when element is offsetPx above viewport bottom
            const rootMargin = `0px 0px -${offsetPx}px 0px`;

            const observer = new IntersectionObserver(
              (entries) => {
                entries.forEach((entry) => {
                  // Trigger when element enters viewport (considering offset)
                  if (entry.isIntersecting) {
                    this.scrolledToElementState.set(observerKey, true);
                    observer.disconnect();
                    this.scrolledToObservers.delete(observerKey);

                    // Publish scrolled_to event
                    this.messageBus.publish('scrolled_to', {});
                  }
                });
              },
              {
                rootMargin,
                threshold: 0,
              },
            );

            this.scrolledToObservers.set(observerKey, observer);

            // Observe all elements matching the selector
            const elements =
              this.globalScope.document.querySelectorAll(selector);
            elements.forEach((element) => {
              observer.observe(element);
            });
          }
        }
      }

      // Re-check for elements on mutations (in case they appear later)
      this.messageBus.subscribe('element_appeared', (payload) => {
        const { mutationList } = payload;

        for (const [
          observerKey,
          observer,
        ] of this.scrolledToObservers.entries()) {
          const [selector] = observerKey.split('\0');

          // Check if mutation is relevant (or if it's the initial check with empty list)
          const isRelevant =
            mutationList.length === 0 ||
            this.isMutationRelevantToSelector(mutationList, selector);

          if (isRelevant) {
            const elements =
              this.globalScope.document.querySelectorAll(selector);
            elements.forEach((element) => {
              observer.observe(element);
            });
          }
        }
      });
    }
  };

  private calculateScrollPercentage(): number {
    const windowHeight = this.globalScope.innerHeight;
    const documentHeight =
      this.globalScope.document.documentElement.scrollHeight;
    const scrollTop = this.globalScope.scrollY;
    const scrollableHeight = documentHeight - windowHeight;

    if (scrollableHeight <= 0) {
      return 100;
    }

    return (scrollTop / scrollableHeight) * 100;
  }

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

      case 'scrolled_to': {
        const triggerValue = page.trigger_value as ScrolledToTriggerValue;

        if (triggerValue.mode === 'percent') {
          return this.maxScrollPercentage >= triggerValue.percentage;
        } else if (triggerValue.mode === 'element') {
          const offset = triggerValue.offsetPx || 0;
          const observerKey = `${triggerValue.selector}\0${offset}`;
          return this.scrolledToElementState.get(observerKey) ?? false;
        }

        return false;
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
