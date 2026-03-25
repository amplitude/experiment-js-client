import { TimeOnPagePayload } from '../subscriptions/message-bus';
import { TimeOnPageTriggerValue, PageObject } from '../types';

import { BaseTriggerManager } from './base-trigger-manager';

interface TimeOnPageState {
  timeouts: Map<number, ReturnType<typeof setTimeout>>;
}

/**
 * Manages time_on_page triggers by setting timeouts for each duration.
 */
export class TimeOnPageTriggerManager extends BaseTriggerManager<TimeOnPagePayload> {
  readonly triggerType = 'time_on_page' as const;
  private state!: TimeOnPageState;

  initialize(): void {
    this.state = {
      timeouts: new Map(),
    };

    this.setupTimeouts();
    this.setupVisibilityChangeHandler();
  }

  isActive(page: PageObject, payload?: TimeOnPagePayload): boolean {
    if (!payload) return false;
    const triggerValue = this.getTriggerValue<TimeOnPageTriggerValue>(page);
    return payload.durationMs >= triggerValue.durationMs;
  }

  reset(): void {
    // Clear existing timeouts and restart
    this.clearTimeouts(this.state.timeouts.values());
    this.state.timeouts.clear();
    this.setupTimeouts();
  }

  getSnapshot(): Record<string, any> {
    return {
      activeTimeouts: Array.from(this.state.timeouts.keys()),
    };
  }

  private setupTimeouts(durationsToSetup?: Set<number>): void {
    // If no durations provided, collect from page objects
    let durations = durationsToSetup;
    if (!durations) {
      durations = new Set<number>();
      for (const page of this.pageObjects) {
        const triggerValue = this.getTriggerValue<TimeOnPageTriggerValue>(page);
        durations.add(triggerValue.durationMs);
      }
    }

    // Set up timeouts for each duration
    durations.forEach((durationMs) => {
      const timeout = this.globalScope.setTimeout(() => {
        this.publish({ durationMs });
        this.state.timeouts.delete(durationMs);
      }, durationMs);
      this.state.timeouts.set(durationMs, timeout);
    });
  }

  private setupVisibilityChangeHandler(): void {
    const visibilityChangeHandler = () => {
      if (this.globalScope.document.hidden) {
        // Tab hidden: clear all timeouts
        this.clearTimeouts(this.state.timeouts.values());
      } else {
        // Tab visible: restart only the timers that were active
        const durations = new Set(Array.from(this.state.timeouts.keys()));
        this.setupTimeouts(durations);
      }
    };

    this.globalScope.document.addEventListener(
      'visibilitychange',
      visibilityChangeHandler,
    );
  }
}
