import { UserInteractionPayload } from '../subscriptions/message-bus';
import {
  UserInteractionTriggerValue,
  PageObject,
  UserInteractionType,
} from '../types';
import { TriggerStateKeys } from '../util/triggers/trigger-state-keys';

import { BaseTriggerManager } from './base-trigger-manager';

interface UserInteractionState {
  firedInteractions: Set<string>;
  clickTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  hoverTimeouts: WeakMap<Element, Map<string, ReturnType<typeof setTimeout>>>;
  focusTimeouts: WeakMap<Element, Map<string, ReturnType<typeof setTimeout>>>;
  abortController: AbortController | null;
}

/**
 * Manages user_interaction triggers (click, hover, focus).
 * Uses event delegation for efficient handling.
 */
export class UserInteractionTriggerManager extends BaseTriggerManager<UserInteractionPayload> {
  readonly triggerType = 'user_interaction' as const;
  private state!: UserInteractionState;

  initialize(): void {
    this.state = {
      firedInteractions: new Set(),
      clickTimeouts: new Map(),
      hoverTimeouts: new WeakMap(),
      focusTimeouts: new WeakMap(),
      abortController: new AbortController(),
    };

    // Group selectors by interaction type
    const clickSelectors = this.getSelectorsForType('click');
    const hoverSelectors = this.getSelectorsForType('hover');
    const focusSelectors = this.getSelectorsForType('focus');

    if (
      clickSelectors.size === 0 &&
      hoverSelectors.size === 0 &&
      focusSelectors.size === 0
    ) {
      return;
    }

    // Set up document-level event delegation for each interaction type
    const { signal } = this.state.abortController!;
    if (clickSelectors.size > 0) {
      this.setupClickDelegation(clickSelectors, signal);
    }
    if (hoverSelectors.size > 0) {
      this.setupHoverDelegation(hoverSelectors, signal);
    }
    if (focusSelectors.size > 0) {
      this.setupFocusDelegation(focusSelectors, signal);
    }
  }

  isActive(page: PageObject): boolean {
    const triggerValue =
      this.getTriggerValue<UserInteractionTriggerValue>(page);
    const key = TriggerStateKeys.userInteraction(
      triggerValue.selector,
      triggerValue.interactionType,
      triggerValue.minThresholdMs || 0,
    );
    return this.state.firedInteractions.has(key);
  }

  reset(): void {
    // Clear fired interactions
    this.state.firedInteractions.clear();
    // Clear pending click timeouts
    this.clearTimeouts(this.state.clickTimeouts.values());
    this.state.clickTimeouts.clear();
  }

  getSnapshot(): Record<string, any> {
    return {
      firedInteractions: Array.from(this.state.firedInteractions),
      pendingClickTimeouts: this.state.clickTimeouts.size,
    };
  }

  private getSelectorsForType(
    type: UserInteractionType,
  ): Map<string, Set<number>> {
    const selectors = new Map<string, Set<number>>();

    for (const page of this.pageObjects) {
      const triggerValue =
        this.getTriggerValue<UserInteractionTriggerValue>(page);
      if (triggerValue.interactionType === type) {
        if (!selectors.has(triggerValue.selector)) {
          selectors.set(triggerValue.selector, new Set());
        }
        selectors
          .get(triggerValue.selector)!
          .add(triggerValue.minThresholdMs || 0);
      }
    }

    return selectors;
  }

  private setupClickDelegation(
    selectors: Map<string, Set<number>>,
    signal: AbortSignal,
  ): void {
    const handler = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target) return;

      for (const [selector, thresholds] of selectors) {
        try {
          if (target.closest(selector)) {
            // Process all thresholds for this selector
            for (const minThresholdMs of thresholds) {
              // Skip if already fired
              if (
                this.state.firedInteractions.has(
                  TriggerStateKeys.userInteraction(
                    selector,
                    'click',
                    minThresholdMs,
                  ),
                )
              ) {
                continue;
              }

              // Skip if timeout is already pending for this interaction
              const interactionKey = TriggerStateKeys.userInteraction(
                selector,
                'click',
                minThresholdMs,
              );
              if (this.state.clickTimeouts.has(interactionKey)) {
                continue;
              }

              const fireTrigger = () => {
                this.state.firedInteractions.add(interactionKey);
                this.publish();
                this.state.clickTimeouts.delete(interactionKey);
              };

              if (minThresholdMs > 0) {
                // Set timeout for delayed firing
                const timeout = this.globalScope.setTimeout(
                  fireTrigger,
                  minThresholdMs,
                );
                this.state.clickTimeouts.set(interactionKey, timeout);
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
  }

  private setupHoverDelegation(
    selectors: Map<string, Set<number>>,
    signal: AbortSignal,
  ): void {
    this.setupThresholdBasedDelegation(selectors, signal, {
      interactionType: 'hover',
      startEvent: 'mouseover',
      endEvent: 'mouseout',
      timeoutStorage: this.state.hoverTimeouts,
    });
  }

  private setupFocusDelegation(
    selectors: Map<string, Set<number>>,
    signal: AbortSignal,
  ): void {
    this.setupThresholdBasedDelegation(selectors, signal, {
      interactionType: 'focus',
      startEvent: 'focusin',
      endEvent: 'focusout',
      timeoutStorage: this.state.focusTimeouts,
    });
  }

  private setupThresholdBasedDelegation(
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
  ): void {
    const startHandler = (event: Event) => {
      const target = event.target as Element;
      if (!target) return;

      for (const [selector, thresholds] of selectors) {
        try {
          const matchedAncestor = target.closest(selector);
          if (matchedAncestor) {
            // Process all thresholds for this selector
            for (const minThresholdMs of thresholds) {
              if (
                this.state.firedInteractions.has(
                  TriggerStateKeys.userInteraction(
                    selector,
                    config.interactionType,
                    minThresholdMs,
                  ),
                )
              ) {
                continue;
              }

              // Get or create timeout map for the matched ancestor (not target)
              let timeoutMap = config.timeoutStorage.get(matchedAncestor);
              if (!timeoutMap) {
                timeoutMap = new Map();
                config.timeoutStorage.set(matchedAncestor, timeoutMap);
              }

              // Only set a timeout if one doesn't already exist
              const timeoutKey = TriggerStateKeys.timeout(
                selector,
                minThresholdMs,
              );
              const existingTimeout = timeoutMap.get(timeoutKey);

              if (!existingTimeout) {
                const fireTrigger = () => {
                  this.state.firedInteractions.add(
                    TriggerStateKeys.userInteraction(
                      selector,
                      config.interactionType,
                      minThresholdMs,
                    ),
                  );
                  this.publish();
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
            if (!relatedTarget || !matchedAncestor.contains(relatedTarget)) {
              const timeoutMap = config.timeoutStorage.get(matchedAncestor);
              if (timeoutMap) {
                // Clear all timeouts for this ancestor
                for (const timeout of timeoutMap.values()) {
                  this.clearTimeout(timeout);
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
  }
}
