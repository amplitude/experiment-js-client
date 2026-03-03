import { EvaluationEngine } from '@amplitude/experiment-core';

import { DefaultWebExperimentClient, INJECT_ACTION } from '../experiment';
import {
  TriggerManager,
  TRIGGER_MANAGER_REGISTRY,
  ManualTriggerManager,
} from '../triggers';
import { PageObject, PageObjects } from '../types';
import { arePageObjectsEqual, clonePageObjects } from '../util/page-object';

import { MessageBus, MessageType } from './message-bus';

const evaluationEngine = new EvaluationEngine();

type initOptions = {
  useDefaultNavigationHandler?: boolean;
  isVisualEditorMode?: boolean;
};

export type PageChangeEvent = {
  activePages: PageObjects;
};

export class SubscriptionManager {
  private triggerManagers: Map<MessageType, TriggerManager> = new Map();
  private pageChangeSubscribers: Set<(event: PageChangeEvent) => void> =
    new Set();
  private lastNotifiedActivePages: PageObjects = {};

  constructor(
    private webExperimentClient: DefaultWebExperimentClient,
    private messageBus: MessageBus,
    private pageObjects: PageObjects,
    private options: initOptions,
    private readonly globalScope: typeof globalThis,
  ) {
    this.initializeTriggerManagers();
  }

  public setPageObjects = (pageObjects: PageObjects) => {
    this.pageObjects = pageObjects;
  };

  public markUrlAsPublished = (url: string) => {
    const urlChangeManager = this.triggerManagers.get('url_change') as any;
    if (urlChangeManager && urlChangeManager.markUrlAsPublished) {
      urlChangeManager.markUrlAsPublished(url);
    }
  };

  public initSubscriptions = () => {
    this.setupPageObjectSubscriptions();

    // Trigger initial element check AFTER subscriptions are set up
    const elementAppearedManager = this.triggerManagers.get(
      'element_appeared',
    ) as any;
    if (elementAppearedManager && elementAppearedManager.triggerInitialCheck) {
      elementAppearedManager.triggerInitialCheck();
    }
  };

  /**
   * Adds a subscriber to the page change event. Returns a function to unsubscribe.
   */
  public addPageChangeSubscriber = (
    callback: (event: PageChangeEvent) => void,
  ): (() => void) => {
    this.pageChangeSubscribers.add(callback);
    return () => {
      this.pageChangeSubscribers.delete(callback);
    };
  };

  /**
   * Get debug snapshots from all trigger managers
   */
  public getManagerSnapshots(): Record<string, any> {
    const snapshots: Record<string, any> = {};
    for (const [type, manager] of this.triggerManagers.entries()) {
      if (manager.getSnapshot) {
        snapshots[type] = manager.getSnapshot();
      }
    }
    return snapshots;
  }

  /**
   * Toggle manual page object activation
   */
  public toggleManualPageObject = (page: string, isActive: boolean): void => {
    const manager = this.triggerManagers.get('manual') as
      | ManualTriggerManager
      | undefined;
    if (manager) {
      manager.toggle(page, isActive);
    }
  };

  /**
   * Create trigger managers only for trigger types that have page objects.
   * Special handling:
   * - element_appeared tracks selectors from element_appeared, element_visible, and scrolled_to
   * - url_change is always initialized with ALL page objects
   */
  private initializeTriggerManagers(): void {
    // Group page objects by trigger type
    const pageObjectsByType = this.groupPageObjectsByType();

    // Flatten all page objects for element_appeared and url_change (they need to see all types)
    const allPageObjects = Array.from(pageObjectsByType.values()).flat();

    // Check if we need element_appeared manager
    const needsElementAppeared =
      pageObjectsByType.has('element_appeared') ||
      pageObjectsByType.has('element_visible') ||
      pageObjectsByType.has('scrolled_to');

    // Initialize url_change manager with ALL page objects (always initialized)
    this.initializeManager('url_change', allPageObjects);

    // Initialize element_appeared FIRST (if needed) so other managers can subscribe
    if (needsElementAppeared) {
      this.initializeManager('element_appeared', allPageObjects);
    }

    // Initialize all other managers
    for (const [triggerType, pages] of pageObjectsByType.entries()) {
      if (triggerType === 'element_appeared') continue; // Already initialized
      if (triggerType === 'url_change') continue; // Already initialized
      if (pages.length === 0) continue;

      this.initializeManager(triggerType, pages);
    }
  }

  private initializeManager(
    triggerType: MessageType,
    pages: PageObject[],
  ): void {
    const ManagerClass =
      TRIGGER_MANAGER_REGISTRY[
        triggerType as keyof typeof TRIGGER_MANAGER_REGISTRY
      ];
    if (!ManagerClass) {
      console.warn(`No manager found for trigger type: ${triggerType}`);
      return;
    }

    const manager = new ManagerClass(pages, this.messageBus, this.globalScope, {
      useDefaultNavigationHandler: this.options.useDefaultNavigationHandler,
    });

    manager.initialize();
    this.triggerManagers.set(triggerType, manager);
  }

  private groupPageObjectsByType(): Map<MessageType, PageObject[]> {
    const grouped = new Map<MessageType, PageObject[]>();

    for (const pages of Object.values(this.pageObjects)) {
      for (const page of Object.values(pages)) {
        if (!grouped.has(page.trigger_type)) {
          grouped.set(page.trigger_type, []);
        }
        grouped.get(page.trigger_type)?.push(page);
      }
    }

    return grouped;
  }

  private setupPageObjectSubscriptions = () => {
    const triggerTypeExperimentMap: Record<string, Set<string>> = {
      // should always include url_change to ensure initial state is reset upon navigation
      url_change: new Set(),
    };

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
          const manager = this.triggerManagers.get(page.trigger_type);
          const isActive = manager
            ? this.isPageObjectActive(manager, page, payload)
            : false;
          this.webExperimentClient.updateActivePages(
            experiment,
            page,
            isActive,
          );
        });
      }
    }

    // Set up group callbacks (one per trigger type)
    for (const triggerType of Object.keys(triggerTypeExperimentMap)) {
      this.messageBus.groupSubscribe(triggerType as MessageType, (payload) => {
        const isUrlChange = triggerType === 'url_change';

        // Handle URL change: reset state and revert injections
        if (isUrlChange) {
          this.resetAllTriggers();
          this.revertInjections();
        }

        // Get current page state and check if it changed
        const activePages = this.webExperimentClient.getActivePages();
        const pagesChanged = !arePageObjectsEqual(
          activePages,
          this.lastNotifiedActivePages,
        );

        // Skip processing in visual editor mode or internal updates
        const isInternalUpdate =
          'updateActivePages' in payload && payload.updateActivePages;
        const shouldApplyVariants =
          !isInternalUpdate &&
          !this.options.isVisualEditorMode &&
          (pagesChanged || isUrlChange);

        if (shouldApplyVariants) {
          // Determine which experiments to apply variants for
          const relevantFlags = isUrlChange
            ? undefined // All experiments
            : Array.from(triggerTypeExperimentMap[triggerType] || []);

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
        if (pagesChanged) {
          this.lastNotifiedActivePages = clonePageObjects(activePages);
          for (const subscriber of this.pageChangeSubscribers) {
            subscriber({ activePages });
          }
        }
      });
    }
  };

  private isPageObjectActive = (
    manager: TriggerManager,
    page: PageObject,
    payload: any,
  ): boolean => {
    const evalContext: Record<string, unknown> = {
      page: { url: this.globalScope.location.href },
    };

    // Check page conditions first
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

    // Delegate to trigger manager
    return manager.isActive(page, payload);
  };

  private resetAllTriggers = () => {
    // Reset all trigger managers
    for (const manager of this.triggerManagers.values()) {
      manager.reset();
    }

    // Deactivate all non-url_change pages since their trigger states were reset
    for (const [experiment, pages] of Object.entries(this.pageObjects)) {
      for (const page of Object.values(pages)) {
        if (page.trigger_type !== 'url_change') {
          this.webExperimentClient.updateActivePages(experiment, page, false);
        }
      }
    }
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
}
