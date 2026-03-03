import { ScrolledToPayload } from '../subscriptions/message-bus';
import { ScrolledToTriggerValue, PageObject } from '../types';
import { isMutationRelevantToSelector } from '../util/triggers/mutation';
import { TriggerStateKeys } from '../util/triggers/trigger-state-keys';

import { BaseTriggerManager } from './base-trigger-manager';

interface ScrolledToState {
  maxScrollPercentage: number;
  elementScrollState: Map<string, boolean>;
  observers: Map<string, IntersectionObserver>;
}

/**
 * Manages scrolled_to triggers for both percentage and element-based scrolling.
 */
export class ScrolledToTriggerManager extends BaseTriggerManager<ScrolledToPayload> {
  readonly triggerType = 'scrolled_to' as const;
  private state!: ScrolledToState;
  private rafId: number | null = null;

  initialize(): void {
    this.state = {
      maxScrollPercentage: 0,
      elementScrollState: new Map(),
      observers: new Map(),
    };

    let hasPercentTrigger = false;
    let hasElementTrigger = false;

    // Determine which types of triggers we have
    for (const page of this.pageObjects) {
      const { mode } = this.getTriggerValue<ScrolledToTriggerValue>(page);
      if (mode === 'percent') hasPercentTrigger = true;
      if (mode === 'element') hasElementTrigger = true;
    }

    if (hasPercentTrigger) this.setupPercentageListener();
    if (hasElementTrigger) this.setupElementObservers();
  }

  isActive(page: PageObject): boolean {
    const triggerValue = this.getTriggerValue<ScrolledToTriggerValue>(page);

    if (triggerValue.mode === 'percent') {
      return this.state.maxScrollPercentage >= triggerValue.percentage;
    } else if (triggerValue.mode === 'element') {
      const key = TriggerStateKeys.scrolledTo(
        triggerValue.selector,
        triggerValue.offsetPx || 0,
      );
      return this.state.elementScrollState.get(key) ?? false;
    }

    return false;
  }

  reset(): void {
    this.state.maxScrollPercentage = 0;
    this.state.elementScrollState.clear();
  }

  getSnapshot(): Record<string, any> {
    return {
      maxScrollPercentage: this.state.maxScrollPercentage,
      elementScrollState: Object.fromEntries(this.state.elementScrollState),
      observerCount: this.state.observers.size,
    };
  }

  private setupPercentageListener(): void {
    const handleScroll = () => {
      const windowHeight = this.globalScope.innerHeight;
      const documentHeight =
        this.globalScope.document.documentElement.scrollHeight;
      const scrollTop = this.globalScope.scrollY;
      const scrollableHeight = documentHeight - windowHeight;

      if (scrollableHeight <= 0) return;

      const scrollPercentage = (scrollTop / scrollableHeight) * 100;

      if (scrollPercentage > this.state.maxScrollPercentage) {
        this.state.maxScrollPercentage = scrollPercentage;
        this.publish({});
      }
    };

    const throttledScroll = () => {
      if (this.rafId !== null) return;

      this.rafId = this.globalScope.requestAnimationFrame(() => {
        handleScroll();
        this.rafId = null;
      });
    };

    this.globalScope.addEventListener('scroll', throttledScroll, {
      passive: true,
    });
    handleScroll(); // Initial check
  }

  private setupElementObservers(): void {
    for (const page of this.pageObjects) {
      const triggerValue = this.getTriggerValue<ScrolledToTriggerValue>(page);
      if (triggerValue.mode !== 'element') continue;

      const { selector, offsetPx = 0 } = triggerValue;
      const key = TriggerStateKeys.scrolledTo(selector, offsetPx);

      if (this.state.observers.has(key)) continue;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.state.elementScrollState.set(key, true);
              this.publish({});
            }
          }
        },
        {
          rootMargin: `0px 0px ${offsetPx}px 0px`,
          threshold: 0,
        },
      );

      this.state.observers.set(key, observer);
      this.observeElements(selector, observer);
    }

    // Re-observe elements when they appear in the DOM
    this.messageBus.subscribe('element_appeared_internal', (payload) => {
      for (const [key, observer] of this.state.observers) {
        const { selector } = TriggerStateKeys.parseScrolledTo(key);
        if (
          payload.mutationList.length === 0 ||
          isMutationRelevantToSelector(payload.mutationList, selector)
        ) {
          this.observeElements(selector, observer);
        }
      }
    });
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
