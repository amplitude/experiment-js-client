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
  private readonly listeners = new Set<ConsentChangeListener>();

  constructor(initialStatus: ConsentStatus = 'pending') {
    this.currentStatus = initialStatus;
  }

  getStatus(): ConsentStatus {
    return this.currentStatus;
  }

  /**
   * Applies a status transition and notifies listeners. Returns true when the
   * transition was applied; no-op transitions (same status, or any ->
   * 'pending') return false.
   */
  setStatus(status: ConsentStatus): boolean {
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
    for (const listener of this.listeners) {
      try {
        listener(status, previous);
      } catch (error) {
        console.error('Consent status listener failed:', error);
      }
    }
    return true;
  }

  /** Subscribes to applied transitions. Returns an unsubscribe function. */
  onChange(listener: ConsentChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
