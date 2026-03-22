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
  private readonly rules: { [flagKey: string]: BehavioralTargeting };
  private readonly trackedEventsToFlagKeys: {
    [eventType: string]: Set<string>;
  };

  constructor(
    apiKey: string,
    initialRules: { [flagKey: string]: BehavioralTargeting } = {},
    trackedEventsToFlagKeys: { [eventType: string]: Set<string> },
  ) {
    this.rules = initialRules;
    this.trackedEventsToFlagKeys = trackedEventsToFlagKeys;
    this.sessionManager = new SessionManager(apiKey);
    this.eventStorage = new EventStorageManager(
      apiKey,
      this.sessionManager,
      new Set(Object.keys(trackedEventsToFlagKeys)),
    );
    this.evaluator = new BehavioralTargetingEvaluator(this.eventStorage);
  }

  /**
   * Track an event for behavioral targeting evaluation.
   * @param eventType The event type/name
   * @param properties Event properties
   */
  public trackEvent(
    eventType: string,
    properties: Record<string, unknown>,
  ): void {
    this.eventStorage.addEvent(eventType, properties);
  }

  /**
   * Evaluate behavioral targeting rules for a specific flag.
   * @param flagKey The flag key to evaluate
   * @returns true if the rules match, false otherwise
   */
  public evaluateFlag(flagKey: string): boolean {
    const rules = this.rules[flagKey];
    if (!rules) {
      return false;
    }
    return this.evaluator.evaluate(rules);
  }

  /**
   * Evaluate all behavioral targeting rules.
   * @returns Set of flag keys that match their behavioral targeting rules
   */
  public evaluateAll(): { [flagKey: string]: boolean } {
    const result: { [flagKey: string]: boolean } = {};
    for (const flagKey in this.rules) {
      result[flagKey] = this.evaluateFlag(flagKey);
    }
    return result;
  }

  /**
   * Evaluate behavioral targeting rules for a specific event type.
   * @param eventType The event type/name
   * @returns Object with flag keys as keys and boolean values indicating if the rules match
   */
  public evaluateEvent(eventType: string): { [flagKey: string]: boolean } {
    if (!this.trackedEventsToFlagKeys[eventType]) {
      return {};
    }
    const flagKeys = this.trackedEventsToFlagKeys[eventType];
    const result: { [flagKey: string]: boolean } = {};
    for (const flagKey of flagKeys) {
      result[flagKey] = this.evaluateFlag(flagKey);
    }
    return result;
  }

  /**
   * Evaluate behavioral targeting rules directly.
   * @param rules The behavioral targeting rules to evaluate
   * @returns true if the rules match, false otherwise
   */
  public evaluate(rules: BehavioralTargeting): boolean {
    return this.evaluator.evaluate(rules);
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
   * Cleanup method to remove event listeners and flush pending writes.
   * Should be called when BehavioralTargetingManager is no longer needed.
   */
  public cleanup(): void {
    this.eventStorage.cleanup();
  }
}
