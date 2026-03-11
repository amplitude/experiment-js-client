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
      const { selector, visibilityRatio = 0 } =
        this.getTriggerValue<ElementVisibleTriggerValue>(page);
      const key = TriggerStateKeys.visibility(selector, visibilityRatio);

      // Skip if we already have an observer for this combination
      if (this.state.observers.has(key)) continue;

      // Create IntersectionObserver
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const isVisible = entry.intersectionRatio >= visibilityRatio;
            this.state.visibilityState.set(key, isVisible);
            if (isVisible) this.publish();
          }
        },
        { threshold: visibilityRatio },
      );

      this.state.observers.set(key, observer);
      this.observeElements(selector, observer);
    }

    // Re-check for elements when they appear in the DOM
    this.messageBus.subscribe('element_appeared_internal', (payload) => {
      for (const [key, observer] of this.state.observers) {
        const { selector } = TriggerStateKeys.parseVisibility(key);
        if (
          payload.mutationList.length === 0 ||
          isMutationRelevantToSelector(payload.mutationList, selector)
        ) {
          this.observeElements(selector, observer);
        }
      }
    });
  }

  isActive(page: PageObject): boolean {
    const { selector, visibilityRatio = 0 } =
      this.getTriggerValue<ElementVisibleTriggerValue>(page);
    const key = TriggerStateKeys.visibility(selector, visibilityRatio);
    return this.state.visibilityState.get(key) ?? false;
  }

  reset(): void {
    this.state.visibilityState.clear();
  }

  getSnapshot(): Record<string, any> {
    return {
      observerCount: this.state.observers.size,
      visibilityState: Object.fromEntries(this.state.visibilityState),
    };
  }

  private observeElements(
    selector: string,
    observer: IntersectionObserver,
  ): void {
    try {
      const elements = this.globalScope.document.querySelectorAll(selector);
      elements.forEach((el) => observer.observe(el));
    } catch (e) {
      // Invalid selector, skip
    }
  }
}
