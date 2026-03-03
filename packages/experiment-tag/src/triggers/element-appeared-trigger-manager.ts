import { ElementAppearedPayload } from '../subscriptions/message-bus';
import { ElementAppearedTriggerValue, PageObject } from '../types';
import { isMutationRelevantToSelector } from '../util/triggers/mutation';
import { DebouncedMutationManager } from '../util/triggers/mutation-manager';

import { BaseTriggerManager } from './base-trigger-manager';

interface ElementAppearedState {
  appearedElements: Set<string>;
  elementAppearedSelectors: Set<string>; // Selectors from element_appeared pages
  internalSelectors: Set<string>; // Selectors from element_visible, scrolled_to
  mutationCleanup: (() => void) | null;
}

/**
 * Manages element_appeared triggers using MutationObserver.
 * Tracks when elements appear in the DOM and become visible.
 * Publishes element_appeared for actual page triggers and element_appeared_internal for infrastructure.
 */
export class ElementAppearedTriggerManager extends BaseTriggerManager<ElementAppearedPayload> {
  readonly triggerType = 'element_appeared' as const;
  private state!: ElementAppearedState;

  initialize(): void {
    this.state = {
      appearedElements: new Set(),
      elementAppearedSelectors: new Set(),
      internalSelectors: new Set(),
      mutationCleanup: null,
    };

    // Collect selectors by page trigger type
    for (const page of this.pageObjects) {
      if (page.trigger_type === 'element_appeared') {
        const { selector } =
          this.getTriggerValue<ElementAppearedTriggerValue>(page);
        this.state.elementAppearedSelectors.add(selector);
      } else if (page.trigger_type === 'element_visible') {
        const { selector } = page.trigger_value as any;
        this.state.internalSelectors.add(selector);
      } else if (page.trigger_type === 'scrolled_to') {
        const triggerValue = page.trigger_value as any;
        if (triggerValue.mode === 'element' && triggerValue.selector) {
          this.state.internalSelectors.add(triggerValue.selector);
        }
      }
    }

    // Skip if no selectors to track
    if (
      this.state.elementAppearedSelectors.size === 0 &&
      this.state.internalSelectors.size === 0
    ) {
      return;
    }

    // Set up mutation observer with filter
    const mutationManager = new DebouncedMutationManager(
      this.globalScope.document.documentElement,
      (mutationList) => this.handleMutations(mutationList),
      [
        (mutation: MutationRecord) => {
          // Check if mutation affects any tracked selector
          for (const selector of this.state.elementAppearedSelectors) {
            if (isMutationRelevantToSelector([mutation], selector)) return true;
          }
          for (const selector of this.state.internalSelectors) {
            if (isMutationRelevantToSelector([mutation], selector)) return true;
          }
          return false;
        },
      ],
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
    const { selector } =
      this.getTriggerValue<ElementAppearedTriggerValue>(page);
    return this.state.appearedElements.has(selector);
  }

  reset(): void {
    this.state.appearedElements.clear();
    this.checkInitialElements();
  }

  getSnapshot(): Record<string, any> {
    return {
      appearedElements: Array.from(this.state.appearedElements),
      elementAppearedSelectors: Array.from(this.state.elementAppearedSelectors),
      internalSelectors: Array.from(this.state.internalSelectors),
    };
  }

  private checkInitialElements(): void {
    const payload = { mutationList: [] };
    let hasElementAppearedChange = false;

    // Check element_appeared selectors
    for (const selector of this.state.elementAppearedSelectors) {
      if (this.checkElement(selector)) {
        hasElementAppearedChange = true;
      }
    }

    // Check internal selectors
    for (const selector of this.state.internalSelectors) {
      this.checkElement(selector);
    }

    // Always notify internal subscribers on initial check
    this.messageBus.publish('element_appeared_internal', payload);
    if (hasElementAppearedChange) {
      this.publish(payload);
    }
  }

  private handleMutations(mutationList: MutationRecord[]): void {
    const payload = { mutationList };
    let hasElementAppearedChange = false;
    let hasInternalChange = false;

    // Check element_appeared selectors for relevant mutations
    for (const selector of this.state.elementAppearedSelectors) {
      if (
        !this.state.appearedElements.has(selector) &&
        isMutationRelevantToSelector(mutationList, selector) &&
        this.checkElement(selector)
      ) {
        hasElementAppearedChange = true;
      }
    }

    // Check internal selectors for relevant mutations
    for (const selector of this.state.internalSelectors) {
      if (
        !this.state.appearedElements.has(selector) &&
        isMutationRelevantToSelector(mutationList, selector) &&
        this.checkElement(selector)
      ) {
        hasInternalChange = true;
      }
    }

    if (hasElementAppearedChange) this.publish(payload);
    if (hasInternalChange) {
      this.messageBus.publish('element_appeared_internal', payload);
    }
  }

  /**
   * Check if element matching selector is visible in DOM.
   * If found, adds to appearedElements and returns true.
   */
  private checkElement(selector: string): boolean {
    try {
      const elements = this.globalScope.document.querySelectorAll(selector);
      for (const element of Array.from(elements)) {
        const style = this.globalScope.getComputedStyle(element);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          this.state.appearedElements.add(selector);
          return true;
        }
      }
    } catch (e) {
      // Invalid selector, skip
    }
    return false;
  }
}
