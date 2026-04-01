import { EvaluationEngine } from '@amplitude/experiment-core';

import { BehavioralTargetingManager } from '../behavioral-targeting';
import { areBehaviorsEqual } from '../behavioral-targeting/util';
import { DefaultWebExperimentClient, INJECT_ACTION } from '../experiment';
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
  AnalyticsEventTriggerValue,
} from '../types';
import {
  DebugState,
  PageObjectDebugInfo,
  TriggerDebugInfo,
} from '../types/debug';
import { DebugRecorder } from '../util/debug-recorder';
import {
  arePageObjectsEqual,
  clonePageObjects,
  getElementSelectors,
  getPageObjectsByTriggerType,
} from '../util/page-object';
import { DebouncedMutationManager } from '../util/triggers/mutation-manager';

import {
  ExitIntentPayload,
  MessageBus,
  MessagePayloads,
  AnalyticsEventPayload,
  MessageType,
  TimeOnPagePayload,
} from './message-bus';

const evaluationEngine = new EvaluationEngine();

const DEBUG_DEBOUNCE_MS = 100;

type initOptions = {
  useDefaultNavigationHandler?: boolean;
  isVisualEditorMode?: boolean;
  isDebugActive?: boolean;
};

export type PageChangeEvent = {
  activePages: PageObjects;
};

export class SubscriptionManager {
  private webExperimentClient: DefaultWebExperimentClient;
  private messageBus: MessageBus;
  private pageObjects: PageObjects;
  private readonly behavioralTargetingManager:
    | BehavioralTargetingManager
    | undefined;
  private options: initOptions;
  private readonly globalScope: typeof globalThis;
  private pageChangeSubscribers: Set<(event: PageChangeEvent) => void> =
    new Set();
  private lastNotifiedActivePages: PageObjects = {};
  private lastNotifiedActiveBehavioralFlags: Map<string, Set<string>> =
    new Map();
  private intersectionObservers: Map<string, IntersectionObserver> = new Map();
  private elementVisibilityState: Map<string, boolean> = new Map();
  private elementAppearedState: Set<string> = new Set();
  private manuallyActivatedPageObjects: Set<string> = new Set();
  private targetedElementSelectors: Set<string> = new Set();
  private scrolledToObservers: Map<string, IntersectionObserver> = new Map();
  private scrolledToElementState: Map<string, boolean> = new Map();
  private analyticsEventState: Set<string> = new Set();
  private maxScrollPercentage = 0;
  private timeOnPageTimeouts: Record<number, ReturnType<typeof setTimeout>> =
    {};
  private firedUserInteractions: Set<string> = new Set();
  private clickTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private hoverTimeouts: WeakMap<
    Element,
    Map<string, ReturnType<typeof setTimeout>>
  > = new WeakMap();
  private focusTimeouts: WeakMap<
    Element,
    Map<string, ReturnType<typeof setTimeout>>
  > = new WeakMap();
  private userInteractionAbortController: AbortController | null = null;
  private pageLoadTime: number = Number.POSITIVE_INFINITY;
  private lastPublishedUrl: string | null = null;
  private debugStateSubscribers: Set<(state: DebugState) => void> = new Set();
  private debugDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    webExperimentClient: DefaultWebExperimentClient,
    messageBus: MessageBus,
    pageObjects: PageObjects,
    behavioralTargetingManager: BehavioralTargetingManager | undefined,
    options: initOptions,
    globalScope: typeof globalThis,
  ) {
    this.webExperimentClient = webExperimentClient;
    this.messageBus = messageBus;
    this.pageObjects = pageObjects;
    this.behavioralTargetingManager = behavioralTargetingManager;
    this.options = options;
    this.globalScope = globalScope;
  }

  public setPageObjects = (pageObjects: PageObjects) => {
    this.pageObjects = pageObjects;
  };

  public markUrlAsPublished = (url: string) => {
    this.lastPublishedUrl = url;
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

  public addDebugStateSubscriber = (
    callback: (state: DebugState) => void,
  ): (() => void) => {
    this.debugStateSubscribers.add(callback);
    return () => {
      this.debugStateSubscribers.delete(callback);
    };
  };

  public getDebugPageObjects(): Record<string, PageObjectDebugInfo[]> {
    const result: Record<string, PageObjectDebugInfo[]> = {};
    const activePages = this.webExperimentClient.getActivePages();

    for (const [flagKey, pages] of Object.entries(this.pageObjects)) {
      result[flagKey] = Object.values(pages).map((page) => {
        const urlConditionsPassed = this.evaluateUrlConditions(page);
        const trigger = this.buildTriggerDebugInfo(page, flagKey, activePages);

        return {
          id: page.id,
          name: page.name,
          urlConditionsPassed,
          triggerPassed: trigger.passed,
          trigger,
          overallStatus:
            urlConditionsPassed && trigger.passed ? 'pass' : 'fail',
        };
      });
    }

    return result;
  }

  private evaluateUrlConditions(page: PageObject): boolean {
    if (!page.conditions || page.conditions.length === 0) {
      return true;
    }
    return evaluationEngine.evaluateConditions(
      {
        context: { page: { url: this.globalScope.location.href } },
        result: {},
      },
      page.conditions,
    );
  }

  private buildTriggerDebugInfo(
    page: PageObject,
    flagKey: string,
    activePages: PageObjects,
  ): TriggerDebugInfo {
    switch (page.trigger_type) {
      case 'url_change':
        return { type: 'url_change', passed: true };

      case 'element_appeared': {
        const { selector } = page.trigger_value as ElementAppearedTriggerValue;
        return {
          type: 'element_appeared',
          passed: this.elementAppearedState.has(selector),
          config: { selector },
        };
      }

      case 'element_visible': {
        const { selector, visibilityRatio: rawRatio } =
          page.trigger_value as ElementVisibleTriggerValue;
        const visibilityRatio = rawRatio ?? 0;
        const key = `${selector}\0${visibilityRatio}`;
        return {
          type: 'element_visible',
          passed: this.elementVisibilityState.get(key) ?? false,
          config: { selector, visibilityRatio },
        };
      }

      case 'manual': {
        const { name } = page.trigger_value as ManualTriggerValue;
        return {
          type: 'manual',
          passed: this.manuallyActivatedPageObjects.has(name),
          config: { name },
        };
      }

      case 'analytics_event':
        return {
          type: 'analytics_event',
          passed: this.analyticsEventState.has(page.id),
          config: { conditions: page.trigger_value },
        };

      case 'user_interaction': {
        const {
          selector,
          interactionType,
          minThresholdMs: rawMs,
        } = page.trigger_value as UserInteractionTriggerValue;
        const minThresholdMs = rawMs || 0;
        const key = `${selector}\0${interactionType}\0${minThresholdMs}`;
        return {
          type: 'user_interaction',
          passed: this.firedUserInteractions.has(key),
          config: { selector, interactionType, minThresholdMs },
        };
      }

      case 'exit_intent': {
        const { minTimeOnPageMs } =
          page.trigger_value as ExitIntentTriggerValue;
        return {
          type: 'exit_intent',
          passed: !!activePages[flagKey]?.[page.id],
          config: { minTimeOnPageMs },
        };
      }

      case 'time_on_page': {
        const { durationMs } = page.trigger_value as TimeOnPageTriggerValue;
        const elapsedMs = Math.max(0, Date.now() - this.pageLoadTime);
        return {
          type: 'time_on_page',
          passed: !(durationMs in this.timeOnPageTimeouts),
          config: { durationMs },
          elapsedMs,
        };
      }

      case 'scrolled_to': {
        const tv = page.trigger_value as ScrolledToTriggerValue;
        if (tv.mode === 'percent') {
          const { percentage } = tv;
          return {
            type: 'scrolled_to',
            passed: this.maxScrollPercentage >= percentage,
            config: { mode: 'percent' as const, percentage },
            currentPercentage: Math.round(this.maxScrollPercentage),
          };
        }
        const { selector, offsetPx } = tv;
        const offset = offsetPx || 0;
        const key = `${selector}\0${offset}`;
        return {
          type: 'scrolled_to',
          passed: this.scrolledToElementState.get(key) ?? false,
          config: { mode: 'element' as const, selector, offsetPx },
        };
      }

      default:
        return { type: 'url_change', passed: false };
    }
  }

  private scheduleDebugNotification = () => {
    if (!this.options.isDebugActive || this.debugStateSubscribers.size === 0) {
      return;
    }

    if (this.debugDebounceTimer !== null) {
      this.globalScope.clearTimeout(this.debugDebounceTimer);
    }

    this.debugDebounceTimer = this.globalScope.setTimeout(() => {
      this.debugDebounceTimer = null;
      const state = this.webExperimentClient.getDebugState();
      for (const subscriber of this.debugStateSubscribers) {
        subscriber(state);
      }
    }, DEBUG_DEBOUNCE_MS);
  };

  public setupPageObjectSubscriptions = () => {
    const triggerTypeExperimentMap: Record<string, Set<string>> = {
      // should always include url_change to ensure initial state is reset upon navigation
      url_change: new Set(),
    };

    // Ensure analytics_event subscription is set up if behavioral targeting exists
    // This ensures behavioral targeting evaluation runs even without analytics_event page objects
    if (this.behavioralTargetingManager) {
      triggerTypeExperimentMap.analytics_event = new Set();
    }

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
          const wasActive =
            !!this.webExperimentClient.getActivePages()[experiment]?.[page.id];
          const isActive = this.isPageObjectActive(page, payload);
          this.webExperimentClient.updateActivePages(
            experiment,
            page,
            isActive,
          );
          if (isActive && !wasActive) {
            DebugRecorder.push(
              'trigger_fired',
              `flag=${experiment}, page=${page.name || page.id}, ` +
                `type=${page.trigger_type}`,
            );
          }
        });
      }
    }

    // Set up groupCallbacks (one per trigger type)
    for (const triggerType of Object.keys(triggerTypeExperimentMap)) {
      this.messageBus.groupSubscribe(triggerType as MessageType, (payload) => {
        const isUrlChange = triggerType === 'url_change';
        const isAnalyticsEvent = triggerType === 'analytics_event';

        // Handle URL change: reset state and revert injections
        if (isUrlChange) {
          DebugRecorder.push(
            'url_change',
            `navigated to ${this.globalScope.location.href}`,
          );
          this.resetTriggerStates();
          this.revertInjections();
        }

        // Get current page state and check if it changed
        const activePages = this.webExperimentClient.getActivePages();
        const pagesChanged = !arePageObjectsEqual(
          activePages,
          this.lastNotifiedActivePages,
        );

        // Get current behavioral state and check if it changed
        const activeBehavioralFlags =
          this.webExperimentClient.behavioralTargetingManager?.getMatchedBehaviors();

        const behaviorsChanged =
          isAnalyticsEvent &&
          !areBehaviorsEqual(
            activeBehavioralFlags,
            this.lastNotifiedActiveBehavioralFlags,
          );
        if (behaviorsChanged) {
          this.webExperimentClient.updateUserWithBehaviors();
        }
        // Skip processing in visual editor mode or internal updates
        const isInternalUpdate =
          'updateActivePages' in payload && payload.updateActivePages;
        const shouldApplyVariants =
          !isInternalUpdate &&
          !this.options.isVisualEditorMode &&
          (pagesChanged || behaviorsChanged || isUrlChange);

        if (shouldApplyVariants) {
          // Determine which experiments to apply variants for
          let relevantFlags: string[] | undefined;

          if (isUrlChange) {
            relevantFlags = undefined; // All experiments
          } else {
            // Combine flags from both page triggers and behavioral changes
            const pageTriggerFlags = Array.from(
              triggerTypeExperimentMap[triggerType] || [],
            );
            const behaviorFlags = behaviorsChanged
              ? Array.from(
                  new Set([
                    ...Array.from(activeBehavioralFlags?.keys() || []),
                    ...Array.from(
                      this.lastNotifiedActiveBehavioralFlags?.keys() || [],
                    ),
                  ]),
                )
              : [];
            relevantFlags = Array.from(
              new Set([...pageTriggerFlags, ...behaviorFlags]),
            );
          }

          // Apply non-preview variants
          this.webExperimentClient.applyVariants({
            flagKeys: relevantFlags?.filter(
              (flag) => !this.webExperimentClient.previewFlags[flag],
            ),
          });

          // Apply preview variants if in preview mode
          if (this.webExperimentClient.isPreviewMode) {
            const previewFlags = relevantFlags
              ? Object.fromEntries(
                  Object.entries(this.webExperimentClient.previewFlags).filter(
                    ([flag]) => relevantFlags.includes(flag),
                  ),
                )
              : this.webExperimentClient.previewFlags;

            this.webExperimentClient.previewVariants({
              keyToVariant: previewFlags,
            });
          }
        }

        // Notify subscribers if pages actually changed
        this.lastNotifiedActivePages = clonePageObjects(activePages);
        for (const subscriber of this.pageChangeSubscribers) {
          subscriber({ activePages });
        }

        // Debug subscribers fire on any URL change or page change,
        // since the debugger cares about currentUrl and trigger state too.
        if (pagesChanged || isUrlChange) {
          this.scheduleDebugNotification();
        }

        // Update last notified behaviors if they changed
        if (behaviorsChanged && activeBehavioralFlags) {
          this.lastNotifiedActiveBehavioralFlags = new Map(
            Array.from(activeBehavioralFlags.entries()).map(([key, value]) => [
              key,
              new Set(value),
            ]),
          );
        }
      });
    }
  };

  public toggleManualPageObject = (page: string, isActive: boolean): void => {
    if (isActive) {
      this.manuallyActivatedPageObjects.add(page);
    } else {
      this.manuallyActivatedPageObjects.delete(page);
    }
    this.messageBus.publish('manual');
  };

  private resetTriggerStates = () => {
    DebugRecorder.push('trigger_reset', 'all non-url_change triggers cleared');
    // Clear "has fired" state for all triggers
    this.elementAppearedState.clear();
    this.elementVisibilityState.clear();
    this.firedUserInteractions.clear();
    this.scrolledToElementState.clear();
    this.manuallyActivatedPageObjects.clear();
    this.maxScrollPercentage = 0;
    this.pageLoadTime = Date.now();
    this.analyticsEventState.clear();
    this.lastNotifiedActiveBehavioralFlags = new Map();

    // Clear pending click timeouts
    for (const timeout of this.clickTimeouts.values()) {
      this.globalScope.clearTimeout(timeout);
    }
    this.clickTimeouts.clear();

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

  private revertInjections = () => {
    // First revert all inject actions
    Object.values(this.webExperimentClient.appliedMutations).forEach(
      (variantMap) => {
        Object.values(variantMap).forEach((actionMap) => {
          if (actionMap[INJECT_ACTION]) {
            Object.values(actionMap[INJECT_ACTION]).forEach((action) => {
              action.revert?.();
            });
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
  };

  private updateElementAppearedState = (
    selectors: Iterable<string>,
    mutationList: MutationRecord[],
  ) => {
    for (const selector of selectors) {
      // For initial checks (no mutationList), check all selectors
      // For actual mutations, only check if mutation is relevant
      const isRelevant =
        mutationList.length === 0 ||
        this.isMutationRelevantToSelector(mutationList, selector);

      if (isRelevant) {
        try {
          const elements = this.globalScope.document.querySelectorAll(selector);
          for (const element of Array.from(elements)) {
            const style = this.globalScope.getComputedStyle(element);
            const hasAppeared =
              style.display !== 'none' && style.visibility !== 'hidden';

            if (hasAppeared) {
              this.elementAppearedState.add(selector);
              break; // Only need to find one visible element
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
    this.updateElementAppearedState(this.targetedElementSelectors, []);
    this.messageBus.publish('element_appeared', { mutationList: [] });
  };

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
        }
      }
    }

    return false;
  }

  private setupMutationObserverPublisher = () => {
    this.targetedElementSelectors = getElementSelectors(this.pageObjects);

    if (this.targetedElementSelectors.size === 0) {
      return;
    }

    // Create filter function that checks against targeted selectors
    // Only mutations that might affect our target elements pass through
    const filters = [
      (mutation: MutationRecord) => {
        return Array.from(this.targetedElementSelectors).some((selector) =>
          this.isMutationRelevantToSelector([mutation], selector),
        );
      },
    ];

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
    const visibilityPages = getPageObjectsByTriggerType(this.pageObjects, [
      'element_visible',
    ]);
    if (visibilityPages.length === 0) {
      return;
    }

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
            const elements =
              this.globalScope.document.querySelectorAll(selector);
            elements.forEach((element) => {
              observer.observe(element);
            });
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
            const elements =
              this.globalScope.document.querySelectorAll(selector);
            elements.forEach((element) => {
              observer.observe(element);
            });
          } catch (e) {
            // Invalid selector, skip
          }
        }
      }
    });
  };

  private setupExitIntentPublisher = () => {
    this.pageLoadTime = Date.now();
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
      this.globalScope.setTimeout(() => {
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
      const currentUrl = this.globalScope.location.href;
      if (currentUrl === this.lastPublishedUrl) {
        return;
      }

      this.lastPublishedUrl = currentUrl;
      this.messageBus.publish('url_change');
    });

    const handleUrlChange = () => {
      const currentUrl = this.globalScope.location.href;
      if (currentUrl === this.lastPublishedUrl) {
        return;
      }

      this.lastPublishedUrl = currentUrl;
      this.messageBus.publish('url_change');
      this.globalScope.webExperiment.previousUrl = currentUrl;
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

    const clickSelectors = new Map<string, Set<number>>();
    const hoverSelectors = new Map<string, Set<number>>();
    const focusSelectors = new Map<string, Set<number>>();

    for (const pages of Object.values(this.pageObjects)) {
      for (const page of Object.values(pages)) {
        if (page.trigger_type === 'user_interaction') {
          const triggerValue =
            page.trigger_value as UserInteractionTriggerValue;
          const { selector, interactionType, minThresholdMs } = triggerValue;

          if (interactionType === 'click') {
            if (!clickSelectors.has(selector)) {
              clickSelectors.set(selector, new Set());
            }
            clickSelectors.get(selector)?.add(minThresholdMs || 0);
          } else if (interactionType === 'hover') {
            if (!hoverSelectors.has(selector)) {
              hoverSelectors.set(selector, new Set());
            }
            hoverSelectors.get(selector)?.add(minThresholdMs || 0);
          } else if (interactionType === 'focus') {
            if (!focusSelectors.has(selector)) {
              focusSelectors.set(selector, new Set());
            }
            focusSelectors.get(selector)?.add(minThresholdMs || 0);
          }
        }
      }
    }

    if (
      clickSelectors.size === 0 &&
      hoverSelectors.size === 0 &&
      focusSelectors.size === 0
    ) {
      return;
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
    selectors: Map<string, Set<number>>,
    signal: AbortSignal,
  ) => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target) return;

      for (const [selector, thresholds] of selectors) {
        try {
          if (target.closest(selector)) {
            // Process all thresholds for this selector
            for (const minThresholdMs of thresholds) {
              const interactionKey = `${selector}\0click\0${minThresholdMs}`;

              // Skip if already fired
              if (this.firedUserInteractions.has(interactionKey)) {
                continue;
              }

              // Skip if timeout is already pending for this interaction
              if (this.clickTimeouts.has(interactionKey)) {
                continue;
              }

              const fireTrigger = () => {
                this.firedUserInteractions.add(interactionKey);
                this.messageBus.publish('user_interaction');
                this.clickTimeouts.delete(interactionKey);
              };

              if (minThresholdMs > 0) {
                // Set timeout for delayed firing
                const timeout = this.globalScope.setTimeout(
                  fireTrigger,
                  minThresholdMs,
                );
                this.clickTimeouts.set(interactionKey, timeout);
              } else {
                // Fire immediately if no threshold
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

              // Only set a timeout if one doesn't already exist
              // This prevents the timer from resetting when the mouse moves within the element
              const timeoutKey = `${selector}\0${minThresholdMs}`;
              const existingTimeout = timeoutMap.get(timeoutKey);

              if (!existingTimeout) {
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

    if (durations.size === 0) {
      return;
    }

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
    const timeOnPagePages = getPageObjectsByTriggerType(this.pageObjects, [
      'time_on_page',
    ]);
    if (timeOnPagePages.length === 0) {
      return;
    }

    const visibilityChangeHandler = () => {
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
      visibilityChangeHandler,
    );
  };

  private setupScrolledToPublisher = () => {
    // Check if we have any scrolled_to triggers
    const pages = getPageObjectsByTriggerType(this.pageObjects, [
      'scrolled_to',
    ]);

    if (pages.length === 0) {
      return;
    }

    let hasPercentTrigger = false;
    let hasElementTrigger = false;

    for (const page of pages) {
      const triggerValue = page.trigger_value as ScrolledToTriggerValue;
      if (triggerValue.mode === 'percent') {
        hasPercentTrigger = true;
      } else if (triggerValue.mode === 'element') {
        hasElementTrigger = true;
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
            const rootMargin = `0px 0px ${offsetPx}px 0px`;

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
            try {
              const elements =
                this.globalScope.document.querySelectorAll(selector);
              elements.forEach((element) => {
                observer.observe(element);
              });
            } catch (e) {
              // Ignore invalid selectors
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
        ] of this.scrolledToObservers.entries()) {
          const [selector] = observerKey.split('\0');

          // Check if mutation is relevant (or if it's the initial check with empty list)
          const isRelevant =
            mutationList.length === 0 ||
            this.isMutationRelevantToSelector(mutationList, selector);

          if (isRelevant) {
            try {
              const elements =
                this.globalScope.document.querySelectorAll(selector);
              elements.forEach((element) => {
                observer.observe(element);
              });
            } catch (e) {
              // Ignore invalid selectors
            }
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
      return 0;
    }

    return (scrollTop / scrollableHeight) * 100;
  }

  private isPageObjectActive = <T extends MessageType>(
    page: PageObject,
    message: MessagePayloads[T],
  ): boolean => {
    const evalContext: Record<string, unknown> = {
      page: { url: this.globalScope.location.href },
    };

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
        return this.manuallyActivatedPageObjects.has(triggerValue.name);
      }

      case 'analytics_event': {
        const id = page.id;
        if (this.analyticsEventState.has(id)) return true;
        const triggerValue = page.trigger_value as AnalyticsEventTriggerValue;
        const eventMessage = message as AnalyticsEventPayload;

        const eventContext = {
          type: 'analytics_event',
          data: {
            event: eventMessage.event,
            properties: eventMessage.properties,
          },
        };

        const match = evaluationEngine.evaluateConditions(
          {
            context: eventContext,
            result: {},
          },
          triggerValue,
        );
        if (match) {
          this.analyticsEventState.add(id);
        }
        return match;
      }

      case 'element_appeared': {
        const triggerValue = page.trigger_value as ElementAppearedTriggerValue;
        const selector = triggerValue.selector;
        return this.elementAppearedState.has(selector);
      }

      case 'element_visible': {
        const triggerValue = page.trigger_value as ElementVisibleTriggerValue;
        const selector = triggerValue.selector;
        const visibilityRatio = triggerValue.visibilityRatio ?? 0;
        const observerKey = `${selector}\0${visibilityRatio}`;
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
        const interactionKey = `${triggerValue.selector}\0${
          triggerValue.interactionType
        }\0${triggerValue.minThresholdMs || 0}`;
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
}
