import { ElementVisiblePayload } from '../subscriptions/message-bus';
import { ElementVisibleTriggerValue, PageObject } from '../types';
import { isMutationRelevantToSelector } from '../util/triggers/mutation';
import { TriggerStateKeys } from '../util/triggers/trigger-state-keys';

import { BaseTriggerManager } from './base-trigger-manager';

interface ElementVisibleState {
  observers: Map<string, IntersectionObserver>;
  visibilityState: Map<string, boolean>;
}

/**
 * Manages element_visible triggers using IntersectionObserver.
 * Tracks when elements become visible at specified visibility ratios.
 */
export class ElementVisibleTriggerManager extends BaseTriggerManager<ElementVisiblePayload> {
  readonly triggerType = 'element_visible' as const;
  private state!: ElementVisibleState;

  initialize(): void {
    this.state = {
      observers: new Map(),
      visibilityState: new Map(),
    };

    // Set up IntersectionObservers for each unique selector + ratio combination
    for (const page of this.pageObjects) {
      const triggerValue =
        this.getTriggerValue<ElementVisibleTriggerValue>(page);
      const selector = triggerValue.selector;
      const visibilityRatio = triggerValue.visibilityRatio ?? 0;
      const observerKey = TriggerStateKeys.visibility(
        selector,
        visibilityRatio,
      );

      // Skip if we already have an observer for this combination
      if (this.state.observers.has(observerKey)) {
        continue;
      }

      // Create IntersectionObserver for this threshold
      const observer = new IntersectionObserver(
        (entries) => {
          this.handleIntersection(entries, selector, visibilityRatio);
        },
        {
          threshold: visibilityRatio,
        },
      );

      this.state.observers.set(observerKey, observer);

      // Observe all matching elements
      this.observeElements(selector, observer);
    }

    // Re-check for elements when they appear in the DOM
    this.messageBus.subscribe('element_appeared', (payload) => {
      this.reobserveElements(payload.mutationList);
    });
  }

  isActive(page: PageObject): boolean {
    const triggerValue = this.getTriggerValue<ElementVisibleTriggerValue>(page);
    const selector = triggerValue.selector;
    const visibilityRatio = triggerValue.visibilityRatio ?? 0;
    const key = TriggerStateKeys.visibility(selector, visibilityRatio);
    return this.state.visibilityState.get(key) ?? false;
  }

  reset(): void {
    // Clear visibility state but keep observers active
    // (elements might still be present on new page)
    this.state.visibilityState.clear();
  }

  getSnapshot(): Record<string, any> {
    return {
      observerCount: this.state.observers.size,
      visibilityState: Object.fromEntries(this.state.visibilityState),
    };
  }

  private handleIntersection(
    entries: IntersectionObserverEntry[],
    selector: string,
    visibilityRatio: number,
  ): void {
    const key = TriggerStateKeys.visibility(selector, visibilityRatio);

    entries.forEach((entry) => {
      const isVisible = entry.intersectionRatio >= visibilityRatio;

      // Update visibility state
      this.state.visibilityState.set(key, isVisible);

      // Publish event when element becomes visible
      // Observer continues running; state check prevents duplicate firing
      if (isVisible) {
        this.publish();
      }
    });
  }

  private observeElements(
    selector: string,
    observer: IntersectionObserver,
  ): void {
    try {
      const elements = this.globalScope.document.querySelectorAll(selector);
      elements.forEach((element) => {
        observer.observe(element);
      });
    } catch (e) {
      // Invalid selector, skip
    }
  }

  private reobserveElements(mutationList: MutationRecord[]): void {
    for (const [observerKey, observer] of this.state.observers.entries()) {
      const { selector } = TriggerStateKeys.parseVisibility(observerKey);

      // Check if mutation is relevant (or if it's the initial check with empty list)
      const isRelevant =
        mutationList.length === 0 ||
        isMutationRelevantToSelector(mutationList, selector);

      if (isRelevant) {
        this.observeElements(selector, observer);
      }
    }
  }
}
