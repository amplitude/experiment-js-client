import { ElementAppearedPayload } from '../subscriptions/message-bus';
import { DebouncedMutationManager } from '../util/triggers/mutation-manager';
import { ElementAppearedTriggerValue, PageObject } from '../types';
import { isMutationRelevantToSelector } from '../util/triggers/mutation';

import { BaseTriggerManager } from './base-trigger-manager';

interface ElementAppearedState {
  appearedElements: Set<string>;
  targetSelectors: Set<string>;
  mutationCleanup: (() => void) | null;
}

/**
 * Manages element_appeared triggers using MutationObserver.
 * Tracks when elements appear in the DOM and become visible.
 */
export class ElementAppearedTriggerManager extends BaseTriggerManager<ElementAppearedPayload> {
  readonly triggerType = 'element_appeared' as const;
  private state!: ElementAppearedState;

  initialize(): void {
    this.state = {
      appearedElements: new Set(),
      targetSelectors: new Set(),
      mutationCleanup: null,
    };

    // Collect all target selectors from element_appeared, element_visible, and scrolled_to page objects
    for (const page of this.pageObjects) {
      if (page.trigger_type === 'element_appeared') {
        const triggerValue =
          this.getTriggerValue<ElementAppearedTriggerValue>(page);
        this.state.targetSelectors.add(triggerValue.selector);
      } else if (page.trigger_type === 'element_visible') {
        const triggerValue = page.trigger_value as any;
        this.state.targetSelectors.add(triggerValue.selector);
      } else if (page.trigger_type === 'scrolled_to') {
        const triggerValue = page.trigger_value as any;
        if (triggerValue.mode === 'element' && triggerValue.selector) {
          this.state.targetSelectors.add(triggerValue.selector);
        }
      }
    }

    if (this.state.targetSelectors.size === 0) {
      return;
    }

    // Create filter function that checks against targeted selectors
    const filters = [
      (mutation: MutationRecord) => {
        return Array.from(this.state.targetSelectors).some((selector) =>
          isMutationRelevantToSelector([mutation], selector),
        );
      },
    ];

    // Set up debounced mutation observer
    const mutationManager = new DebouncedMutationManager(
      this.globalScope.document.documentElement,
      (mutationList) => {
        this.handleMutations(mutationList);
      },
      filters,
    );
    this.state.mutationCleanup = mutationManager.observe();
  }

  /**
   * Trigger initial check for elements.
   * Must be called AFTER all page object subscriptions are set up.
   */
  public triggerInitialCheck(): void {
    this.checkInitialElements();
  }

  isActive(page: PageObject): boolean {
    const triggerValue =
      this.getTriggerValue<ElementAppearedTriggerValue>(page);
    return this.state.appearedElements.has(triggerValue.selector);
  }

  reset(): void {
    // Clear appeared state
    this.state.appearedElements.clear();
    // Re-check for elements on the new page
    this.checkInitialElements();
  }

  getSnapshot(): Record<string, any> {
    return {
      appearedElements: Array.from(this.state.appearedElements),
      targetSelectors: Array.from(this.state.targetSelectors),
    };
  }

  private checkInitialElements(): void {
    // Check for elements that already exist in the DOM
    for (const selector of this.state.targetSelectors) {
      this.checkElement(selector);
    }
    // Publish with empty mutation list to trigger initial visibility checks
    this.publish({ mutationList: [] });
  }

  private checkElement(selector: string): void {
    try {
      const element = this.globalScope.document.querySelector(selector);
      if (element) {
        const style = this.globalScope.getComputedStyle(element);
        const hasAppeared =
          style.display !== 'none' && style.visibility !== 'hidden';

        if (hasAppeared) {
          this.state.appearedElements.add(selector);
        }
      }
    } catch (e) {
      // Invalid selector, skip
    }
  }

  private handleMutations(mutationList: MutationRecord[]): void {
    // Check each active selector and update state
    for (const selector of this.state.targetSelectors) {
      const isRelevant = isMutationRelevantToSelector(mutationList, selector);

      if (isRelevant) {
        this.checkElement(selector);
      }
    }

    // Publish event with mutationList for other subscribers (e.g., visibility publisher)
    this.publish({ mutationList });
  }
}
