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

    // Check which types of triggers we have
    for (const page of this.pageObjects) {
      const triggerValue = this.getTriggerValue<ScrolledToTriggerValue>(page);
      if (triggerValue.mode === 'percent') {
        hasPercentTrigger = true;
      } else if (triggerValue.mode === 'element') {
        hasElementTrigger = true;
      }
    }

    // Setup percentage-based scroll listener if needed
    if (hasPercentTrigger) {
      this.setupPercentageListener();
    }

    // Setup IntersectionObserver for element-based triggers
    if (hasElementTrigger) {
      this.setupElementObservers();
    }
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
    // Reset scroll state
    this.state.maxScrollPercentage = 0;
    this.state.elementScrollState.clear();
    // Keep observers active - elements might still be present
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
      const scrollPercentage = this.calculateScrollPercentage();
      // Track maximum scroll percentage reached
      if (scrollPercentage > this.state.maxScrollPercentage) {
        this.state.maxScrollPercentage = scrollPercentage;
        this.publish({});
      }
    };

    const throttledScroll = () => {
      // Cancel any pending animation frame
      if (this.rafId !== null) {
        return;
      }

      // Schedule the handler to run on the next animation frame
      this.rafId = this.globalScope.requestAnimationFrame(() => {
        handleScroll();
        this.rafId = null;
      });
    };

    this.globalScope.addEventListener('scroll', throttledScroll, {
      passive: true,
    });

    // Initial check
    handleScroll();
  }

  private setupElementObservers(): void {
    for (const page of this.pageObjects) {
      const triggerValue = this.getTriggerValue<ScrolledToTriggerValue>(page);

      if (triggerValue.mode === 'element') {
        const selector = triggerValue.selector;
        const offsetPx = triggerValue.offsetPx || 0;
        const observerKey = TriggerStateKeys.scrolledTo(selector, offsetPx);

        // Skip if we already have an observer for this selector + offset
        if (this.state.observers.has(observerKey)) {
          continue;
        }

        // Create root margin based on offset
        const rootMargin = `0px 0px ${offsetPx}px 0px`;

        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              // Trigger when element enters viewport (considering offset)
              if (entry.isIntersecting) {
                this.state.elementScrollState.set(observerKey, true);
                this.publish({});
              }
            });
          },
          {
            rootMargin,
            threshold: 0,
          },
        );

        this.state.observers.set(observerKey, observer);

        // Observe all elements matching the selector
        this.observeElements(selector, observer);
      }
    }

    // Re-check for elements on mutations (in case they appear later)
    this.messageBus.subscribe('element_appeared', (payload) => {
      const { mutationList } = payload;

      for (const [observerKey, observer] of this.state.observers.entries()) {
        const { selector } = TriggerStateKeys.parseScrolledTo(observerKey);

        // Check if mutation is relevant
        const isRelevant =
          mutationList.length === 0 ||
          isMutationRelevantToSelector(mutationList, selector);

        if (isRelevant) {
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
      elements.forEach((element) => {
        observer.observe(element);
      });
    } catch (e) {
      // Ignore invalid selectors
    }
  }

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
}
