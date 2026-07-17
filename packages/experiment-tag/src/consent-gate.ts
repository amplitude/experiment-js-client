import { ConsentStatus, InitConfigs, WebExperimentConfig } from './types';

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
  /** Args stashed by `initialize` while consent is not yet granted. */
  deferredStart: DeferredStart | null;
  /**
   * Latest consent status seen (may be set before `initialize` runs).
   * 'pending' and 'denied' both defer the start; a later 'granted'
   * (including a 'denied → granted' re-opt-in) starts the client.
   */
  status: ConsentStatus | undefined;
  /** Whether the client has been (or is being) started. */
  started: boolean;
  /** Test-only reset; kept off the public `index` entry point. */
  reset(): void;
}

/**
 * Module-scoped consent gate state. While consent is pending there is no client
 * instance to hold it. Not re-exported from `index.ts`, so `reset` and the raw
 * state stay out of the package's public API.
 */
export const consentGate: ConsentGate = {
  deferredStart: null,
  status: undefined,
  started: false,
  reset() {
    this.deferredStart = null;
    this.status = undefined;
    this.started = false;
  },
};
