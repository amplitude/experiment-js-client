import { EvaluationCondition } from '@amplitude/experiment-core';

/**
 * Behavioral targeting uses DNF (Disjunctive Normal Form): OR of ANDs
 * Structure: [[ConditionSet, ConditionSet], [ConditionSet]]
 * - Outer array: OR operator between groups
 * - Inner array: AND operator within each group
 * - Each condition can be negated individually
 */
export type BehavioralTargeting = Array<Array<BehavioralConditionSet>>;

/**
 * A condition set with optional negation.
 */
export interface BehavioralConditionSet {
  condition: BehavioralCondition;
  negated?: boolean;
}

/**
 * A behavioral condition
 */
export interface BehavioralCondition {
  type: 'event';
  type_value: string; // Event name
  operator: '>=' | '>' | '=' | '<' | '<=' | '!=' | 'is set' | 'is not set';
  operator_value: number; // Count threshold
  time_type: 'current_session' | 'rolling';
  time_value: number;
  interval?: 'day' | 'hour';
  event_props?: EvaluationCondition[]; // Backend translated to EvaluationEngine format
}
