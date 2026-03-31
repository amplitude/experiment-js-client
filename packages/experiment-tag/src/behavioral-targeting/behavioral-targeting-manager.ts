import { BehavioralTargetingRules } from '../types';

import { BehavioralTargetingEvaluator } from './evaluator';
import { EventStorageManager } from './event-storage';
import { SessionManager } from './session-manager';
import { BehavioralTargeting } from './types';

/**
 * Manages all behavioral targeting functionality including event storage,
 * session management, and rule evaluation.
 */
export class BehavioralTargetingManager {
  private readonly sessionManager: SessionManager;
  private readonly eventStorage: EventStorageManager;
  private evaluator: BehavioralTargetingEvaluator;
  private readonly rules: BehavioralTargetingRules;
  private readonly matchedBehaviors: Map<string, Set<string>> = new Map();
  private readonly eventToBehaviors: Map<
    string,
    Array<{ id: string; flagKey: string }>
  > = new Map();

  constructor(
    apiKey: string,
    initialRules: BehavioralTargetingRules = {},
    trackedEventsToFlagKeys: Map<string, Set<string>> = new Map(),
  ) {
    this.rules = initialRules;
    this.sessionManager = new SessionManager(apiKey);
    this.eventStorage = new EventStorageManager(
      apiKey,
      this.sessionManager,
      new Set(trackedEventsToFlagKeys.keys()),
    );
    this.evaluator = new BehavioralTargetingEvaluator(this.eventStorage);

    // Build event-to-behavior mapping for efficient lookups
    this.buildEventToBehaviorsMap();

    // Initialize active behavior state on startup
    this.evaluateAll();
  }

  /**
   * Track an event for behavioral targeting evaluation.
   * Automatically updates the active behavior state for affected flags.
   * @param eventType The event type/name
   * @param properties Event properties
   */
  public trackEvent(
    eventType: string,
    properties: Record<string, unknown>,
  ): void {
    this.eventStorage.addEvent(eventType, properties);
    // Update active behavior state for flags affected by this event
    this.evaluateEvent(eventType);
  }

  /**
   * Check if a flag has behavioral targeting rules.
   * @param flagKey The flag key to check
   * @returns true if the flag has behavioral targeting rules
   */
  public hasRules(flagKey: string): boolean {
    return !!this.rules[flagKey];
  }

  /**
   * Get the currently matched behavioral targeting rules.
   * @returns Map of flag keys to sets of matched behavior IDs
   */
  public getMatchedBehaviors(): Map<string, Set<string>> {
    return this.matchedBehaviors;
  }

  /**
   * Cleanup method to remove event listeners and flush pending writes.
   * Should be called when BehavioralTargetingManager is no longer needed.
   */
  public cleanup(): void {
    this.eventStorage.cleanup();
  }

  /**
   * Build a map of event types to the behavior IDs and flag keys that reference them.
   * This allows efficient lookup of which specific behaviors need re-evaluation when an event is tracked.
   */
  private buildEventToBehaviorsMap(): void {
    for (const flagKey in this.rules) {
      const rulesByIds = this.rules[flagKey];
      for (const [behaviorId, rules] of Object.entries(rulesByIds)) {
        // Scan the rules to find which event types this behavior references
        const eventTypes = this.extractEventTypes(rules);
        for (const eventType of eventTypes) {
          let behaviors = this.eventToBehaviors.get(eventType);
          if (!behaviors) {
            behaviors = [];
            this.eventToBehaviors.set(eventType, behaviors);
          }
          behaviors.push({ id: behaviorId, flagKey });
        }
      }
    }
  }

  /**
   * Extract all event types referenced in behavioral targeting rules.
   * @param rules The behavioral targeting rules to scan
   * @returns Set of event types referenced in the rules
   */
  private extractEventTypes(rules: BehavioralTargeting): Set<string> {
    const eventTypes = new Set<string>();
    for (const andGroup of rules) {
      for (const conditionSet of andGroup) {
        if (conditionSet.condition.type === 'event') {
          eventTypes.add(conditionSet.condition.type_value);
        }
      }
    }
    return eventTypes;
  }

  /**
   * Evaluate all behavioral targeting rules.
   * Directly updates the matchedBehaviors state for all flags.
   */
  private evaluateAll(): void {
    for (const flagKey in this.rules) {
      this.evaluateFlag(flagKey);
    }
  }

  /**
   * Evaluate behavioral targeting rules for a specific event type.
   * Only re-evaluates the specific behavior IDs that reference this event type.
   * Directly updates the matchedBehaviors state for affected flags.
   * @param eventType The event type/name
   */
  private evaluateEvent(eventType: string): void {
    const behaviors = this.eventToBehaviors.get(eventType);
    if (!behaviors) {
      return;
    }

    // Evaluate only the specific behavior IDs that reference this event
    for (const { id, flagKey } of behaviors) {
      this.evaluateBehaviorId(flagKey, id);
    }
  }

  /**
   * Evaluate behavioral targeting rules for a specific flag.
   * Directly updates the matchedBehaviors state with all matching behavior IDs.
   * @param flagKey The flag key to evaluate
   */
  private evaluateFlag(flagKey: string): void {
    const rulesByIds = this.rules[flagKey];
    if (!rulesByIds) {
      this.matchedBehaviors.delete(flagKey);
      return;
    }

    const matchedIds = new Set<string>();
    for (const [id, rules] of Object.entries(rulesByIds)) {
      if (this.evaluator.evaluate(rules)) {
        matchedIds.add(id);
      }
    }

    if (matchedIds.size > 0) {
      this.matchedBehaviors.set(flagKey, matchedIds);
    } else {
      this.matchedBehaviors.delete(flagKey);
    }
  }

  /**
   * Evaluate a specific behavior ID for a flag.
   * Updates only the specified behavior ID in the matchedBehaviors state.
   * @param flagKey The flag key to evaluate
   * @param behaviorId The specific behavior ID to evaluate
   */
  private evaluateBehaviorId(flagKey: string, behaviorId: string): void {
    const rulesByIds = this.rules[flagKey];
    if (!rulesByIds || !rulesByIds[behaviorId]) {
      return;
    }

    const currentMatches =
      this.matchedBehaviors.get(flagKey) || new Set<string>();
    const rules = rulesByIds[behaviorId];

    if (this.evaluator.evaluate(rules)) {
      currentMatches.add(behaviorId);
    } else {
      currentMatches.delete(behaviorId);
    }

    // Update or remove the flag's matched rules
    if (currentMatches.size > 0) {
      this.matchedBehaviors.set(flagKey, currentMatches);
    } else {
      this.matchedBehaviors.delete(flagKey);
    }
  }
}
