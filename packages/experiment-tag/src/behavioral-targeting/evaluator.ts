import {
  EvaluationCondition,
  EvaluationEngine,
  EvaluationOperator,
} from '@amplitude/experiment-core';

import { EventRecord, EventStorageManager } from './event-storage';
import {
  BehavioralTargeting,
  BehavioralCondition,
  BehavioralConditionSet,
} from './types';

/**
 * Evaluates behavioral targeting rules using stored events.
 */
export class BehavioralTargetingEvaluator {
  private eventStorage: EventStorageManager;
  private evaluationEngine: EvaluationEngine;

  constructor(eventStorage: EventStorageManager) {
    this.eventStorage = eventStorage;
    this.evaluationEngine = new EvaluationEngine();
  }

  /**
   * Evaluates a behavioral targeting rule (DNF structure).
   * Returns true if the user matches the targeting criteria.
   */
  evaluate(rules: BehavioralTargeting): boolean {
    // OR across AND groups
    for (const andGroup of rules) {
      if (this.evaluateAndGroup(andGroup)) {
        return true; // OR: one group matching is enough
      }
    }
    return false;
  }

  /**
   * Evaluates an AND group of conditions.
   */
  private evaluateAndGroup(andGroup: Array<BehavioralConditionSet>): boolean {
    // AND across all conditions
    for (const conditionSet of andGroup) {
      if (!this.evaluateConditionSet(conditionSet)) {
        return false; // AND: all must match
      }
    }
    return true;
  }

  /**
   * Evaluates a single condition set (with optional negation).
   */
  private evaluateConditionSet(conditionSet: BehavioralConditionSet): boolean {
    const result = this.evaluateCondition(conditionSet.condition);

    // Apply negation if specified
    return conditionSet.negated ? !result : result;
  }

  /**
   * Evaluates a single behavioral condition.
   */
  private evaluateCondition(condition: BehavioralCondition): boolean {
    // 1. Get events in time window
    const events = this.eventStorage.getEventsInTimeWindow(
      condition.event_type,
      condition.time_type,
      condition.time_value,
      condition.interval,
    );

    // 2. Filter by property conditions using EvaluationEngine
    const matchingEvents = events.filter((event) =>
      this.evaluatePropertyFilters(event, condition.event_props || []),
    );

    // 3. Check count threshold
    const count = matchingEvents.length;
    return this.evaluateCountOperator(count, condition.op, condition.value);
  }

  /**
   * Evaluates property filters using EvaluationEngine.
   * The backend has already translated property filters to EvaluationCondition format.
   */
  private evaluatePropertyFilters(
    event: EventRecord,
    propertyConditions: EvaluationCondition[], // Backend translated
  ): boolean {
    if (!propertyConditions || propertyConditions.length === 0) {
      return true;
    }

    // Build EvaluationEngine target from event properties
    const target = {
      context: event.properties,
      result: {},
    };

    // Reuse EvaluationEngine's matching logic
    // Property conditions are ANDed together
    return this.evaluationEngine.evaluateConditions(target, [
      propertyConditions,
    ]);
  }

  /**
   * Evaluates count operators.
   */
  private evaluateCountOperator(
    count: number,
    operator: string,
    threshold: number,
  ): boolean {
    switch (operator) {
      case EvaluationOperator.GREATER_THAN_EQUALS:
        return count >= threshold;
      case EvaluationOperator.GREATER_THAN:
        return count > threshold;
      case EvaluationOperator.IS:
        return count === threshold;
      case EvaluationOperator.LESS_THAN:
        return count < threshold;
      case EvaluationOperator.LESS_THAN_EQUALS:
        return count <= threshold;
      case EvaluationOperator.IS_NOT:
        return count !== threshold;
      default:
        return false;
    }
  }
}
