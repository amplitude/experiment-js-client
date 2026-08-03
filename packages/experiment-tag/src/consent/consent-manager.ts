import { ConsentStatus } from '../types';

export type ConsentChangeListener = (
  status: ConsentStatus,
  previousStatus: ConsentStatus,
) => void;

/**
 * Tri-state consent state machine.
 *
 * Valid transitions: pending -> granted, pending -> denied,
 * granted -> denied (revocation), denied -> granted (preference-center
 * re-opt-in). 'pending' is only meaningful as an initial state, so any
 * transition to 'pending' is ignored.
 */
export class ConsentManager {
  private currentStatus: ConsentStatus;
  private explicitlySet = false;
  private readonly listeners = new Set<ConsentChangeListener>();

  constructor(initialStatus: ConsentStatus = 'pending') {
    this.currentStatus = initialStatus;
  }

  getStatus(): ConsentStatus {
    return this.currentStatus;
  }

  /** True once a runtime signal has arrived through {@link setStatus}. */
  hasExplicitStatus(): boolean {
    return this.explicitlySet;
  }

  /**
   * Applies a runtime (CMP) status transition and notifies listeners. Returns
   * true when the transition was applied; no-op transitions (same status, or
   * any -> 'pending') return false.
   *
   * Records the status as explicitly set even when the transition itself is a
   * no-op, so a later {@link seedFromConfig} cannot overwrite a decision the
   * caller already made.
   */
  setStatus(status: ConsentStatus): boolean {
    this.explicitlySet = true;
    return this.applyTransition(status);
  }

  /**
   * Seeds the status from declarative config. Ignored once a runtime signal has
   * arrived, so an explicit CMP decision always wins over a build-time default.
   */
  seedFromConfig(status: ConsentStatus): boolean {
    if (this.explicitlySet) {
      return false;
    }
    return this.applyTransition(status);
  }

  /** Subscribes to applied transitions. Returns an unsubscribe function. */
  onChange(listener: ConsentChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private applyTransition(status: ConsentStatus): boolean {
    if (status === this.currentStatus) {
      return false;
    }
    if (status === 'pending') {
      console.warn(
        `Ignoring consent transition ${this.currentStatus} -> pending: 'pending' is only valid as an initial state`,
      );
      return false;
    }
    const previous = this.currentStatus;
    this.currentStatus = status;
    // Snapshot before notifying: a listener can arm another listener while
    // this loop runs (the relay teardown is armed inside the pending-grant
    // deferral), and live Set iteration would visit — and, for a one-shot,
    // spend — the new listener on the very transition it was armed during,
    // instead of the next one.
    for (const listener of [...this.listeners]) {
      try {
        listener(status, previous);
      } catch (error) {
        console.error('Consent status listener failed:', error);
      }
    }
    return true;
  }
}
