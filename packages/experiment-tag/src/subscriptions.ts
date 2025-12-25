import { EvaluationEngine } from '@amplitude/experiment-core';

import { DefaultWebExperimentClient, INJECT_ACTION } from './experiment';
import {
  ManualTriggerPayload,
  ExitIntentPayload,
  MessageBus,
  MessagePayloads,
  AnalyticsEventPayload,
  MessageType,
  TimeOnPagePayload,
} from './message-bus';
import { DebouncedMutationManager } from './mutation-manager';
import {
  ElementAppearedTriggerValue,
  ElementVisibleTriggerValue,
  ManualTriggerValue,
  ExitIntentTriggerValue,
  PageObject,
  PageObjects,
  UserInteractionTriggerValue,
  TimeOnPageTriggerValue,
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
  private elementAppearedState: Set<string> = new Set();
  private targetedElementSelectors: Set<string> = new Set();
  private scrolledToObservers: Map<string, IntersectionObserver> = new Map();
  private scrolledToElementState: Map<string, boolean> = new Map();
  private maxScrollPercentage = 0;
  private timeOnPageTimeouts: Record<number, ReturnType<typeof setTimeout>> =
    {};
  private visibilityChangeHandler: (() => void) | null = null;
  private firedUserInteractions: Set<string> = new Set();
  private hoverTimeouts: WeakMap<
    Element,
    Map<string, ReturnType<typeof setTimeout>>
  > = new WeakMap();
  private focusTimeouts: WeakMap<
    Element,
    Map<string, ReturnType<typeof setTimeout>>
  > = new WeakMap();
  private userInteractionAbortController: AbortController | null = null;
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
    this.setupPageObjectSubscriptions();
    if (this.options.useDefaultNavigationHandler) {
      this.setupLocationChangePublisher();
    }
    this.setupMutationObserverPublisher();
    this.setupVisibilityPublisher();
    this.setupUserInteractionPublisher();
    this.setupExitIntentPublisher();
    this.setupScrolledToPublisher();
    this.setupTimeOnPagePublisher();
    this.setupVisibilityChangeHandler();
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
    const triggerTypeExperimentMap: Record<string, Set<string>> = {};

    for (const [experiment, pages] of Object.entries(this.pageObjects)) {
      for (const page of Object.values(pages)) {
        if (!triggerTypeExperimentMap[page.trigger_type]) {
          triggerTypeExperimentMap[page.trigger_type] = new Set();
        }
        triggerTypeExperimentMap[page.trigger_type].add(experiment);
      }
    }

    // Subscribe individual page callbacks
    for (const [experiment, pages] of Object.entries(this.pageObjects)) {
      for (const page of Object.values(pages)) {
        this.messageBus.subscribe(page.trigger_type, (payload) => {
          this.webExperimentClient.updateActivePages(
            experiment,
            page,
            this.isPageObjectActive(page, payload),
          );
        });
      }
    }

    // Set up groupCallbacks (one per trigger type)
    for (const triggerType of Object.keys(triggerTypeExperimentMap)) {
      this.messageBus.groupSubscribe(triggerType as MessageType, (payload) => {
        if (
          (!('updateActivePages' in payload) || !payload.updateActivePages) &&
          !this.options.isVisualEditorMode
        ) {
          const isUrlChange = triggerType === 'url_change';
          if (isUrlChange) {
            this.resetTriggerStates();
            // First revert all inject actions
            Object.values(this.webExperimentClient.appliedMutations).forEach(
              (variantMap) => {
                Object.values(variantMap).forEach((actionMap) => {
                  if (actionMap[INJECT_ACTION]) {
                    Object.values(actionMap[INJECT_ACTION]).forEach(
                      (action) => {
                        action.revert?.();
                      },
                    );
                  }
                });
              },
            );

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
          // Apply variants for experiments relevant to this trigger type
          this.webExperimentClient.applyVariants({
            flagKeys: isUrlChange
              ? undefined
              : Array.from(triggerTypeExperimentMap[triggerType] || []),
          });
          if (this.webExperimentClient.isPreviewMode) {
            this.webExperimentClient.previewVariants({
              keyToVariant: this.webExperimentClient.previewFlags,
            });
          }
        }

        const activePages = this.webExperimentClient.getActivePages();

        if (
          !this.areActivePagesEqual(activePages, this.lastNotifiedActivePages)
        ) {
          this.lastNotifiedActivePages = this.cloneActivePagesMap(activePages);
          for (const subscriber of this.pageChangeSubscribers) {
            subscriber({ activePages });
          }
        }
      });
    }
  };

  private resetTriggerStates = () => {
    // Clear "has fired" state for all triggers
    this.elementAppearedState.clear();
    this.elementVisibilityState.clear();
    this.firedUserInteractions.clear();
    this.scrolledToElementState.clear();
    this.maxScrollPercentage = 0;
    this.pageLoadTime = Date.now();

    // Deactivate all non-url_change pages since their trigger states were reset
    for (const [experiment, pages] of Object.entries(this.pageObjects)) {
      for (const page of Object.values(pages)) {
        if (page.trigger_type !== 'url_change') {
          this.webExperimentClient.updateActivePages(experiment, page, false);
        }
      }
    }

    this.setupTimeOnPagePublisher();

    // Trigger initial check for elements that already exist on new page
    this.checkInitialElements();
  };

  private updateElementAppearedState = (
    selectors: Iterable<string>,
    mutationList?: MutationRecord[],
  ) => {
    for (const selector of selectors) {
      // For initial checks (no mutationList), check all selectors
      // For actual mutations, only check if mutation is relevant
      const isRelevant =
        !mutationList ||
        mutationList.length === 0 ||
        this.isMutationRelevantToSelector(mutationList, selector);

      if (isRelevant) {
        try {
          const element = this.globalScope.document.querySelector(selector);
          if (element) {
            const style = this.globalScope.getComputedStyle(element);
            const hasAppeared =
              style.display !== 'none' && style.visibility !== 'hidden';

            if (hasAppeared) {
              this.elementAppearedState.add(selector);
            }
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
    }
  };

  private checkInitialElements = () => {
    // Check for elements that already exist in the DOM and update state
    this.updateElementAppearedState(this.targetedElementSelectors);

    // Publish event to notify subscribers
    this.messageBus.publish('element_appeared');
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
        } else if (page.trigger_type === 'scrolled_to') {
          const triggerValue = page.trigger_value as ScrolledToTriggerValue;
          if (triggerValue.mode === 'element' && triggerValue.selector) {
            selectors.add(triggerValue.selector);
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
    this.targetedElementSelectors = this.getElementSelectors();

    // Create filter function that checks against active selectors
    // fewer mutations will pass the filter, improving performance over time
    const filters =
      this.targetedElementSelectors.size > 0
        ? [
            (mutation: MutationRecord) => {
              // Check against active selectors only (not already appeared)
              return Array.from(this.targetedElementSelectors).some(
                (selector) =>
                  this.isMutationRelevantToSelector([mutation], selector),
              );
            },
          ]
        : [];

    const mutationManager = new DebouncedMutationManager(
      this.globalScope.document.documentElement,
      (mutationList) => {
        // Check each active selector and update state
        this.updateElementAppearedState(
          this.targetedElementSelectors,
          mutationList,
        );

        // Publish event with mutationList for other subscribers (e.g., visibility publisher)
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
          const observerKey = `${selector}\0${visibilityRatio}`;

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

                // Publish event when element becomes visible
                // Observer continues running; state check prevents duplicate firing
                if (isVisible) {
                  this.messageBus.publish('element_visible');
                }
              });
            },
            {
              threshold: visibilityRatio,
            },
          );

          this.intersectionObservers.set(observerKey, observer);

          // Observe the element if it exists
          try {
            const element = this.globalScope.document.querySelector(selector);
            if (element) {
              observer.observe(element);
            }
          } catch (e) {
            // Invalid selector, skip
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
        const [selector] = observerKey.split('\0');

        // Check if mutation is relevant (or if it's the initial check with empty list)
        const isRelevant =
          mutationList.length === 0 ||
          this.isMutationRelevantToSelector(mutationList, selector);

        if (isRelevant) {
          try {
            const element = this.globalScope.document.querySelector(selector);
            if (element) {
              observer.observe(element);
            }
          } catch (e) {
            // Invalid selector, skip
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

    let minTimeOnPageMs = Infinity;
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

  private setupUserInteractionPublisher = () => {
    // Abort all existing listeners at once
    this.userInteractionAbortController?.abort();
    this.userInteractionAbortController = new AbortController();
    const { signal } = this.userInteractionAbortController;

    const clickSelectors = new Set<string>();
    const hoverSelectors = new Map<string, Set<number>>();
    const focusSelectors = new Map<string, Set<number>>();

    for (const pages of Object.values(this.pageObjects)) {
      for (const page of Object.values(pages)) {
        if (page.trigger_type === 'user_interaction') {
          const triggerValue =
            page.trigger_value as UserInteractionTriggerValue;
          const { selector, interactionType, minThresholdMs } = triggerValue;

          if (interactionType === 'click') {
            clickSelectors.add(selector);
          } else if (interactionType === 'hover') {
            if (!hoverSelectors.has(selector)) {
              hoverSelectors.set(selector, new Set());
            }
            hoverSelectors.get(selector)!.add(minThresholdMs || 0);
          } else if (interactionType === 'focus') {
            if (!focusSelectors.has(selector)) {
              focusSelectors.set(selector, new Set());
            }
            focusSelectors.get(selector)!.add(minThresholdMs || 0);
          }
        }
      }
    }

    // Set up document-level event delegation for each interaction type
    if (clickSelectors.size > 0) {
      this.setupClickDelegation(clickSelectors, signal);
    }
    if (hoverSelectors.size > 0) {
      this.setupHoverDelegation(hoverSelectors, signal);
    }
    if (focusSelectors.size > 0) {
      this.setupFocusDelegation(focusSelectors, signal);
    }
  };

  private setupClickDelegation = (
    selectors: Set<string>,
    signal: AbortSignal,
  ) => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target) return;

      for (const selector of selectors) {
        try {
          if (target.closest(selector)) {
            const interactionKey = `${selector}\0click`;
            if (!this.firedUserInteractions.has(interactionKey)) {
              this.firedUserInteractions.add(interactionKey);
              this.messageBus.publish('user_interaction');
            }
            break;
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
    };

    this.globalScope.document.addEventListener('click', handler, { signal });
  };

  private setupThresholdBasedDelegation = (
    selectors: Map<string, Set<number>>,
    signal: AbortSignal,
    config: {
      interactionType: 'hover' | 'focus';
      startEvent: string;
      endEvent: string;
      timeoutStorage: WeakMap<
        Element,
        Map<string, ReturnType<typeof setTimeout>>
      >;
    },
  ) => {
    const startHandler = (event: Event) => {
      const target = event.target as Element;
      if (!target) return;

      for (const [selector, thresholds] of selectors) {
        try {
          const matchedAncestor = target.closest(selector);
          if (matchedAncestor) {
            // Process all thresholds for this selector
            for (const minThresholdMs of thresholds) {
              const interactionKey = `${selector}\0${config.interactionType}\0${minThresholdMs}`;

              if (this.firedUserInteractions.has(interactionKey)) {
                continue;
              }

              // Get or create timeout map for the matched ancestor (not target)
              let timeoutMap = config.timeoutStorage.get(matchedAncestor);
              if (!timeoutMap) {
                timeoutMap = new Map();
                config.timeoutStorage.set(matchedAncestor, timeoutMap);
              }

              // Clear any existing timeout for this specific selector+threshold
              const timeoutKey = `${selector}\0${minThresholdMs}`;
              const existingTimeout = timeoutMap.get(timeoutKey);
              if (existingTimeout) {
                this.globalScope.clearTimeout(existingTimeout);
              }

              const fireTrigger = () => {
                this.firedUserInteractions.add(interactionKey);
                this.messageBus.publish('user_interaction');
                timeoutMap?.delete(timeoutKey);
              };

              if (minThresholdMs) {
                const timeout = this.globalScope.setTimeout(
                  fireTrigger,
                  minThresholdMs,
                );
                timeoutMap.set(timeoutKey, timeout);
              } else {
                fireTrigger();
              }
            }
            break;
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
    };

    const endHandler = (event: Event) => {
      const target = event.target as Element;
      if (!target) return;

      // Check relatedTarget to determine if we actually left the ancestor
      const relatedTarget = (event as MouseEvent | FocusEvent)
        .relatedTarget as Element | null;

      for (const [selector] of selectors) {
        try {
          const matchedAncestor = target.closest(selector);
          if (matchedAncestor) {
            // Only clear timeouts if we're actually leaving the matched ancestor
            // (not just moving to a child element)
            if (!relatedTarget || !matchedAncestor.contains(relatedTarget)) {
              const timeoutMap = config.timeoutStorage.get(matchedAncestor);
              if (timeoutMap) {
                // Clear all timeouts for this ancestor
                for (const timeout of timeoutMap.values()) {
                  this.globalScope.clearTimeout(timeout);
                }
                config.timeoutStorage.delete(matchedAncestor);
              }
            }
            break;
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
    };

    this.globalScope.document.addEventListener(
      config.startEvent,
      startHandler,
      {
        signal,
      },
    );
    this.globalScope.document.addEventListener(config.endEvent, endHandler, {
      signal,
    });
  };

  private setupHoverDelegation = (
    selectors: Map<string, Set<number>>,
    signal: AbortSignal,
  ) => {
    this.setupThresholdBasedDelegation(selectors, signal, {
      interactionType: 'hover',
      startEvent: 'mouseover',
      endEvent: 'mouseout',
      timeoutStorage: this.hoverTimeouts,
    });
  };

  private setupFocusDelegation = (
    selectors: Map<string, Set<number>>,
    signal: AbortSignal,
  ) => {
    this.setupThresholdBasedDelegation(selectors, signal, {
      interactionType: 'focus',
      startEvent: 'focusin',
      endEvent: 'focusout',
      timeoutStorage: this.focusTimeouts,
    });
  };

  private setupTimeOnPagePublisher = () => {
    // Clear any existing timeouts first
    Object.values(this.timeOnPageTimeouts).forEach(clearTimeout);
    this.timeOnPageTimeouts = {};

    // Collect unique duration thresholds
    const durations = new Set<number>();
    for (const pages of Object.values(this.pageObjects)) {
      for (const page of Object.values(pages)) {
        if (page.trigger_type === 'time_on_page') {
          const triggerValue = page.trigger_value as TimeOnPageTriggerValue;
          durations.add(triggerValue.durationMs);
        }
      }
    }

    // Start timers for each unique duration
    this.setUpTimeouts(durations);
  };

  private setUpTimeouts = (durations: Set<number>) => {
    durations.forEach((durationMs) => {
      this.timeOnPageTimeouts[durationMs] = this.globalScope.setTimeout(() => {
        this.messageBus.publish('time_on_page', { durationMs });
        delete this.timeOnPageTimeouts[durationMs];
      }, durationMs);
    });
  };

  private setupVisibilityChangeHandler = () => {
    // Remove existing listener if it exists
    if (this.visibilityChangeHandler) {
      this.globalScope.document.removeEventListener(
        'visibilitychange',
        this.visibilityChangeHandler,
      );
    }

    this.visibilityChangeHandler = () => {
      if (this.globalScope.document.hidden) {
        // Tab hidden: clear all timeouts
        Object.values(this.timeOnPageTimeouts).forEach(clearTimeout);
      } else {
        // Tab visible: restart timers
        const durations = new Set(
          Object.keys(this.timeOnPageTimeouts).map(Number),
        );
        this.setUpTimeouts(durations);
      }
    };

    this.globalScope.document.addEventListener(
      'visibilitychange',
      this.visibilityChangeHandler,
    );
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

                    // Publish scrolled_to event
                    // Observer continues running; state check prevents duplicate firing
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
    let evalContext: Record<string, unknown> = {
      page: { url: this.globalScope.location.href },
    };

    if (page.trigger_type === 'analytics_event') {
      const eventMessage = message as AnalyticsEventPayload;

      evalContext = {
        ...evalContext,
        type: 'analytics_event',
        data: {
          event: eventMessage.event_type,
          properties: eventMessage.event_properties,
        },
      };
    }

    // Check conditions with enriched context
    if (page.conditions && page.conditions.length > 0) {
      const matchConditions = evaluationEngine.evaluateConditions(
        {
          context: evalContext,
          result: {},
        },
        page.conditions,
      );
      if (!matchConditions) {
        return false;
      }
    }

    // Check if page is active based on trigger type
    switch (page.trigger_type) {
      case 'url_change':
        return true;

      case 'manual': {
        const triggerValue = page.trigger_value as ManualTriggerValue;
        return (message as ManualTriggerPayload).name === triggerValue.name;
      }

      case 'analytics_event': {
        // Event type already matched above, conditions evaluated
        return true;
      }

      case 'element_appeared': {
        const triggerValue = page.trigger_value as ElementAppearedTriggerValue;
        const selector = triggerValue.selector;

        // State is managed by mutation callback, just check it
        return this.elementAppearedState.has(selector);
      }

      case 'element_visible': {
        const triggerValue = page.trigger_value as ElementVisibleTriggerValue;
        const selector = triggerValue.selector;
        const visibilityRatio = triggerValue.visibilityRatio ?? 0;
        const observerKey = `${selector}\0${visibilityRatio}`;

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

      case 'user_interaction': {
        const triggerValue = page.trigger_value as UserInteractionTriggerValue;
        // Include minThresholdMs in key for hover and focus to differentiate between different durations
        const interactionKey =
          triggerValue.interactionType === 'hover' ||
          triggerValue.interactionType === 'focus'
            ? `${triggerValue.selector}\0${triggerValue.interactionType}\0${
                triggerValue.minThresholdMs || 0
              }`
            : `${triggerValue.selector}\0${triggerValue.interactionType}`;
        return this.firedUserInteractions.has(interactionKey);
      }

      case 'time_on_page': {
        const payload = message as TimeOnPagePayload;
        const triggerValue = page.trigger_value as TimeOnPageTriggerValue;
        return payload.durationMs >= triggerValue.durationMs;
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
