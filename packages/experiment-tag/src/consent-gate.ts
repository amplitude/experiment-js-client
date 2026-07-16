import { ConsentStatus, InitConfigs, WebExperimentConfig } from './types';

interface DeferredStart {
  apiKey: string;
  initConfigs: InitConfigs;
  config: WebExperimentConfig;
}

interface ConsentGate {
  /** Args stashed by `initialize` while consent is not yet granted. */
  deferredStart: DeferredStart | null;
  /** Latest consent status seen (may be set before `initialize` runs). */
  status: ConsentStatus | undefined;
  /** Whether the client has been (or is being) started. */
  started: boolean;
  /**
   * Whether consent was terminally declined. Once `rejected` is seen (at load or
   * via `setConsentStatus`), the gate latches closed for this page load: later
   * `granted` calls are ignored. Cleared only by a reload (or `reset` in tests).
   */
  rejected: boolean;
  /** Resets the gate. Test-only; kept off the public `index` entry point. */
  reset(): void;
}

/**
 * Module-scoped consent state for the v0 gate. While consent is pending there is
 * no client instance to hold it, so the state lives here instead. This module is
 * intentionally not re-exported from `index.ts`, so `reset` (and the raw state)
 * stay out of the package's public API surface.
 */
export const consentGate: ConsentGate = {
  deferredStart: null,
  status: undefined,
  started: false,
  rejected: false,
  reset() {
    this.deferredStart = null;
    this.status = undefined;
    this.started = false;
    this.rejected = false;
  },
};
