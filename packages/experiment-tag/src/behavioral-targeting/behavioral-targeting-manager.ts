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
  private readonly trackedEvents?: Set<string>;

  constructor(
    apiKey: string,
    initialRules: { [flagKey: string]: BehavioralTargeting } = {},
    trackedEvents?: Set<string>,
  ) {
    this.rules = initialRules;
    this.trackedEvents = trackedEvents;
    this.sessionManager = new SessionManager(apiKey);
    this.eventStorage = new EventStorageManager(
      apiKey,
      this.sessionManager,
      trackedEvents,
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
  public evaluateAll(): Set<string> {
    const activeFlags = new Set<string>();
    for (const flagKey in this.rules) {
      if (this.evaluateFlag(flagKey)) {
        activeFlags.add(flagKey);
      }
    }
    return activeFlags;
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
   * Get the set of tracked events.
   * @returns Set of tracked events or undefined if not set
   */
  public getTrackedEvents(): Set<string> | undefined {
    return this.trackedEvents;
  }

  /**
   * Cleanup method to remove event listeners and flush pending writes.
   * Should be called when BehavioralTargetingManager is no longer needed.
   */
  public cleanup(): void {
    this.eventStorage.cleanup();
  }
}
