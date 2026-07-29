import { ConsentStatus, InitConfigs, WebExperimentConfig } from '../types';

import { ConsentManager } from './consent-manager';

/** Returns a known status, or `null` if the value is not recognized. */
export const parseConsentStatus = (value: unknown): ConsentStatus | null => {
  if (value === 'granted' || value === 'pending' || value === 'denied') {
    return value;
  }
  return null;
};

interface DeferredStart {
  apiKey: string;
  initConfigs: InitConfigs;
  config: WebExperimentConfig;
}

interface ConsentGate {
  /** Tri-state status owner; `index.ts` reads and transitions through it. */
  manager: ConsentManager;
  /** Args stashed by `initialize` while consent is not yet granted. */
  deferredStart: DeferredStart | null;
  /** Whether the client has been (or is being) started. */
  started: boolean;
  /**
   * Unsubscribes the denial-cleanup listener. Also marks that the listener is
   * registered — it can only be attached once `initialize` supplies the apiKey
   * the cleanup needs.
   */
  cleanupListener: (() => void) | null;
  /** Test-only reset; kept off the public `index` entry point. */
  reset(): void;
}

/**
 * Module-scoped consent state — while consent is unresolved there is no client
 * instance to hold it. Not re-exported from `index.ts`, so `reset` and the raw
 * state stay out of the package's public API.
 */
export const consentGate: ConsentGate = {
  manager: new ConsentManager(),
  deferredStart: null,
  started: false,
  cleanupListener: null,
  reset() {
    this.manager = new ConsentManager();
    this.deferredStart = null;
    this.started = false;
    // The replacement manager carries no listeners, so dropping the reference
    // is enough to detach the old one.
    this.cleanupListener = null;
  },
};
