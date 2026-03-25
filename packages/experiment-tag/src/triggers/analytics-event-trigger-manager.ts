import { EvaluationEngine } from '@amplitude/experiment-core';

import { AnalyticsEventPayload } from '../subscriptions/message-bus';
import { AnalyticsEventTriggerValue, PageObject } from '../types';

import { BaseTriggerManager } from './base-trigger-manager';

interface AnalyticsEventState {
  firedEvents: Set<string>; // pageId -> has fired
}

const evaluationEngine = new EvaluationEngine();

/**
 * Manages analytics_event triggers by evaluating events against conditions.
 */
export class AnalyticsEventTriggerManager extends BaseTriggerManager<AnalyticsEventPayload> {
  readonly triggerType = 'analytics_event' as const;
  private state!: AnalyticsEventState;

  initialize(): void {
    this.state = {
      firedEvents: new Set(),
    };
  }

  isActive(page: PageObject, payload?: AnalyticsEventPayload): boolean {
    const pageId = page.id;

    // If already fired, return true
    if (this.state.firedEvents.has(pageId)) {
      return true;
    }

    // If no payload, can't evaluate
    if (!payload) {
      return false;
    }

    const triggerValue = this.getTriggerValue<AnalyticsEventTriggerValue>(page);

    // Build event context for evaluation
    const eventContext = {
      type: 'analytics_event',
      data: {
        event: payload.event,
        properties: payload.properties,
      },
    };

    // Evaluate conditions
    const match = evaluationEngine.evaluateConditions(
      {
        context: eventContext,
        result: {},
      },
      triggerValue,
    );

    // If matched, mark as fired
    if (match) {
      this.state.firedEvents.add(pageId);
    }

    return match;
  }

  reset(): void {
    // Clear fired events
    this.state.firedEvents.clear();
  }

  getSnapshot(): Record<string, any> {
    return {
      firedEvents: Array.from(this.state.firedEvents),
    };
  }
}
