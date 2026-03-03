import { ExitIntentPayload } from '../subscriptions/message-bus';
import { ExitIntentTriggerValue, PageObject } from '../types';

import { BaseTriggerManager } from './base-trigger-manager';

interface ExitIntentState {
  pageLoadTime: number;
}

/**
 * Manages exit_intent triggers by detecting mouse leaving viewport.
 */
export class ExitIntentTriggerManager extends BaseTriggerManager<ExitIntentPayload> {
  readonly triggerType = 'exit_intent' as const;
  private state!: ExitIntentState;

  initialize(): void {
    this.state = {
      pageLoadTime: Date.now(),
    };

    // Find minimum time requirement across all exit_intent triggers
    let minTimeOnPageMs = Infinity;
    for (const page of this.pageObjects) {
      const triggerValue = this.getTriggerValue<ExitIntentTriggerValue>(page);
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
      if (event.clientY <= 50 && event.relatedTarget === null) {
        this.publish({
          durationMs: Date.now() - this.state.pageLoadTime,
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
  }

  isActive(page: PageObject, payload?: ExitIntentPayload): boolean {
    if (!payload) return false;
    const triggerValue = this.getTriggerValue<ExitIntentTriggerValue>(page);
    return (
      triggerValue.minTimeOnPageMs === undefined ||
      payload.durationMs >= triggerValue.minTimeOnPageMs
    );
  }

  reset(): void {
    // Update page load time for new page
    this.state.pageLoadTime = Date.now();
  }

  getSnapshot(): Record<string, any> {
    return {
      pageLoadTime: this.state.pageLoadTime,
      timeOnPage: Date.now() - this.state.pageLoadTime,
    };
  }
}
