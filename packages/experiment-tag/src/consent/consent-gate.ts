import { ConsentStatus, InitConfigs, WebExperimentConfig } from '../types';

import { clearAllPersistedData, markIdentityErased } from './clear-data';
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
   * The manager the denial-cleanup listener is attached to, or null before the
   * first gated `initialize` — the listener needs the apiKey that call
   * supplies. Tracking the instance rather than a boolean means a replaced
   * manager (only `reset` does that) re-arms on the next initialize instead of
   * leaving the cleanup wired to a manager nothing transitions any more.
   */
  cleanupArmedManager: ConsentManager | null;
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
  cleanupArmedManager: null,
  reset() {
    // Replacing the manager detaches its listeners with it; the armed-manager
    // comparison in `armDenialCleanup` re-arms against the replacement on its
    // own, so the null here is fresh state, not a correctness requirement.
    this.manager = new ConsentManager();
    this.deferredStart = null;
    this.started = false;
    this.cleanupArmedManager = null;
  },
};

/**
 * Arms the denial cleanup against the current manager, once. Called from
 * `initialize` because the sweep needs the apiKey that call supplies.
 *
 * Ordering matters: the immediate sweep covers a denial that resolved before
 * this point (config value, or a setConsentStatus call against the pre-init
 * stub), and the listener registered after it covers every later revocation.
 * Registering second keeps a single sweep per denial rather than double-firing
 * on the transition that just happened.
 */
export const armDenialCleanup = (
  apiKey: string,
  instanceName?: string,
): void => {
  if (consentGate.cleanupArmedManager === consentGate.manager) {
    return;
  }
  consentGate.cleanupArmedManager = consentGate.manager;
  const clearData = () => {
    clearAllPersistedData(apiKey, instanceName);
    // The sweep is origin-local; the marker is what crosses subdomains.
    markIdentityErased(apiKey);
  };
  if (consentGate.manager.getStatus() === 'denied') {
    clearData();
  }
  consentGate.manager.onChange((status) => {
    if (status === 'denied') {
      clearData();
    }
  });
};
