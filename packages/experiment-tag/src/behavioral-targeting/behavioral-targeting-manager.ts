import { BehavioralTargetingEvaluator } from './evaluator';
import { EventStorageManager } from './event-storage';
import { SessionManager } from './session-manager';
import { BehavioralTargeting } from './types';

/**
 * Manages all behavioral targeting functionality including event storage,
 * session management, and rule evaluation.
 */
export class BehavioralTargetingManager {
  private sessionManager: SessionManager;
  private eventStorage: EventStorageManager;
  private evaluator: BehavioralTargetingEvaluator;

  constructor(persistedEvents?: Set<string>) {
    this.sessionManager = new SessionManager();
    this.eventStorage = new EventStorageManager(
      this.sessionManager,
      persistedEvents,
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
   * Evaluate behavioral targeting rules.
   * @param rules The behavioral targeting rules to evaluate
   * @returns true if the rules match, false otherwise
   */
  public evaluate(rules: BehavioralTargeting): boolean {
    return this.evaluator.evaluate(rules);
  }
}
