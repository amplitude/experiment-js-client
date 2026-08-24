import { ConsentStatus, InitConfigs, WebExperimentConfig } from '../types';
import type { ConsentDebugInfo } from '../types/debug';

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
  /**
   * Whether the customer enabled consent gating. The manager starts at
   * 'pending' for everyone, so gates must check this (via
   * {@link isConsentPending}), never the status alone. Sticky once true, so a
   * later `initialize` resolving `consentRequired: false` cannot reopen
   * storage a prior one closed.
   */
  required: boolean;
  /** Args stashed by `initialize` while consent is not yet granted. */
  deferredStart: DeferredStart | null;
  /** Whether the client has been (or is being) started. */
  started: boolean;
  /**
   * The manager the denial-cleanup listener is attached to (see
   * `armDenialCleanup` in `clear-data.ts`). The test-only `reset()` replaces
   * the manager, stranding listeners on the old instance; comparing instances
   * lets the next initialize re-arm against the live one.
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
  required: false,
  deferredStart: null,
  started: false,
  cleanupArmedManager: null,
  reset() {
    this.manager = new ConsentManager();
    this.required = false;
    this.deferredStart = null;
    this.started = false;
    this.cleanupArmedManager = null;
  },
};

/**
 * Read-only snapshot of the gate for `getDebugState()`. `impressionBuffers`
 * is composed in by the recorder — the buffer module imports this one, so the
 * dependency cannot point the other way.
 */
export const getConsentDebugState = (): Omit<
  ConsentDebugInfo,
  'impressionBuffers'
> => ({
  status: consentGate.manager.getStatus(),
  required: consentGate.required,
  started: consentGate.started,
  startDeferred: consentGate.deferredStart !== null,
});

/**
 * Runs `handler` on the first status transition and unsubscribes. A buffer
 * armed while pending is settled by that one transition: flushed on grant,
 * dropped on refusal. The one-shot also stops data gathered before a refusal
 * from being written out by a later same-page re-opt-in.
 */
export const onConsentDecision = (
  handler: (granted: boolean) => void,
): void => {
  const unsubscribe = consentGate.manager.onChange((status) => {
    unsubscribe();
    handler(status === 'granted');
  });
};

/**
 * True while gating is active and the visitor has yet to decide — the
 * condition under which writes are buffered in memory (consent may still
 * arrive). Always false when the feature is off.
 */
export const isConsentPending = (): boolean =>
  consentGate.required && consentGate.manager.getStatus() === 'pending';

/**
 * True while gating is active and consent is not in hand (pending or denied) —
 * the condition for keeping data off the device. Denial must suppress
 * persistence, not just trigger cleanup: a client already running after a
 * mid-session revocation would otherwise write the data straight back.
 */
export const isConsentWithheld = (): boolean =>
  consentGate.required && consentGate.manager.getStatus() !== 'granted';
