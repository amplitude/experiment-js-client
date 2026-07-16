import { Event, Plugin } from '@amplitude/analytics-types';
import { getGlobalScope } from '@amplitude/experiment-core';

import { consentGate, parseConsentStatus } from './consent/consent-gate';
import { DefaultWebExperimentClient } from './experiment';
import { HttpClient } from './preview/http';
import { SdkPreviewApi } from './preview/preview-api';
import {
  ConsentOptions,
  ConsentStatus,
  InitConfigs,
  WebExperimentConfig,
} from './types';
import { applyAntiFlickerCss, removeAntiFlickerCss } from './util/anti-flicker';
import { isPreviewMode } from './util/url';

const eventBuffer: Array<{
  event_type: string;
  event_properties?: Record<string, unknown>;
}> = [];

/** Cap for events buffered while the client is starting (not consent-deferred). */
const MAX_EVENT_BUFFER_SIZE = 500;

const isConsentDeferred = (): boolean =>
  consentGate.deferredStart !== null && !consentGate.started;

const clearDeferredAnalyticsBuffer = (): void => {
  eventBuffer.length = 0;
};

const bufferAnalyticsEvent = (event: {
  event_type: string;
  event_properties?: Record<string, unknown>;
}): void => {
  if (eventBuffer.length >= MAX_EVENT_BUFFER_SIZE) {
    eventBuffer.shift();
  }
  eventBuffer.push(event);
};

const resolveConsentOptions = (
  config: WebExperimentConfig,
  globalScope: ReturnType<typeof getGlobalScope>,
): ConsentOptions => ({
  ...config.consentOptions,
  ...globalScope?.experimentConfig?.consentOptions, // window wins (existing precedence)
});

// Release a consent-gated start. Both grant paths (a later setConsentStatus or a
// re-init that resolves to granted) funnel through here so they mark started and
// drop the stashed args. If a start was actually parked while consent was
// withheld, also drop the events that buffered during that window (no tracking
// before grant). When consent was granted from the start there was no such
// window, so the buffer is left to replay like the normal (non-consent) path.
const releaseGate = (
  apiKey: string,
  initConfigs: InitConfigs,
  config: WebExperimentConfig,
): void => {
  const hadDeferral = consentGate.deferredStart !== null;
  consentGate.deferredStart = null;
  if (hadDeferral) {
    clearDeferredAnalyticsBuffer();
  }
  launchClient(apiKey, initConfigs, config);
};

/**
 * Updates cookie-consent status. Exposed on `window.webExperiment` (incl. the
 * pre-init stub) so a CMP callback can call it before the client exists.
 * `granted` starts a deferred client once — including after an earlier
 * `denied` (the preference-center re-opt-in flow). Transitions to `pending`
 * are ignored: pending is only meaningful as an initial state. Unknown values
 * are a no-op. A grant recorded before `initialize()` runs is honored on init.
 */
export const setConsentStatus = (status: ConsentStatus): void => {
  const parsed = parseConsentStatus(status);
  if (parsed === null) {
    return;
  }
  consentGate.explicitStatus = true;
  consentGate.manager.setStatus(parsed);
  if (consentGate.manager.getStatus() !== 'granted' && isConsentDeferred()) {
    clearDeferredAnalyticsBuffer();
  }
  if (
    consentGate.manager.getStatus() === 'granted' &&
    consentGate.deferredStart &&
    !consentGate.started
  ) {
    const { apiKey, initConfigs, config } = consentGate.deferredStart;
    releaseGate(apiKey, initConfigs, config);
  }
};

export const initialize = (
  apiKey: string,
  initConfigs: InitConfigs,
  config: WebExperimentConfig,
): void => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    throw new Error('Global scope not available');
  }

  // Expose the plugin factory immediately (unless a real client already exists).
  // The stub carries setConsentStatus so a CMP callback can resolve consent
  // before the client is constructed.
  if (!globalScope.webExperiment) {
    globalScope.webExperiment = {
      plugin: createPlugin,
      isStub: true,
      setConsentStatus,
    };
  }

  // A start already happened (any path — consent-gated or not): don't relaunch.
  // A second initialize() would otherwise re-fetch preview configs, re-run
  // start(), or re-open the consent gate against an already-running client.
  if (consentGate.started) {
    return;
  }

  // Consent gate: while consent is required and not granted, stash the args and
  // return without constructing the client (no storage/eval/tracking/relay).
  // An already-pending deferral keeps the gate closed even if this call resolves
  // consentRequired=false, so a later initialize can't bypass a start that a
  // prior one parked on consent. Denied also stashes — a later grant
  // (preference-center re-opt-in) starts the client in-session with fresh state.
  const consent = resolveConsentOptions(config, globalScope);
  const gated = consent.consentRequired || consentGate.deferredStart !== null;
  if (gated) {
    // A runtime status (setConsentStatus) wins over the declarative config, so
    // only seed the manager from config while no CMP signal has arrived.
    // setConsentStatus no-ops on unknown values; an unrecognized config value
    // warns and falls back to 'pending' (fail closed).
    if (!consentGate.explicitStatus) {
      const configStatus = parseConsentStatus(consent.consentStatus);
      if (consent.consentStatus !== undefined && configStatus === null) {
        console.warn(
          `[experiment-tag] Invalid consentOptions.consentStatus ` +
            `${JSON.stringify(consent.consentStatus)}; expected ` +
            `'granted', 'pending', or 'denied'. Treating as pending.`,
        );
      }
      consentGate.manager.setStatus(configStatus ?? 'pending');
    }
    if (consentGate.manager.getStatus() !== 'granted') {
      consentGate.deferredStart = { apiKey, initConfigs, config };
      clearDeferredAnalyticsBuffer();
      return;
    }
    // Granted: release through the shared path so a prior deferral's stashed
    // args and pre-grant buffered events are cleared, matching setConsentStatus.
    releaseGate(apiKey, initConfigs, config);
    return;
  }

  launchClient(apiKey, initConfigs, config);
};

// Single launch path used by both initialize() and a deferred consent grant,
// so a grant that arrives after load still gets the preview/extension branch
// (anti-flicker CSS + latest-config fetch) instead of starting directly.
const launchClient = (
  apiKey: string,
  initConfigs: InitConfigs,
  config: WebExperimentConfig,
): void => {
  // Mark the gate started on every launch (consent or not) so a later
  // initialize() early-returns instead of relaunching an already-running client.
  consentGate.started = true;
  const globalScope = getGlobalScope();
  const shouldFetchConfigs =
    isPreviewMode() || globalScope?.WebExperiment?.injectedByExtension;

  if (shouldFetchConfigs) {
    applyAntiFlickerCss();

    // Fetch latest configs and create client. Anti-flicker teardown is delegated
    // to startClient so it stays gated on isRedirecting — a redirect experiment
    // surfaced in preview mode must keep the overlay up while navigation is
    // in-flight, just like the normal path.
    fetchLatestConfigs(apiKey, config.serverZone)
      .then((previewState) => {
        const initialFlags = JSON.stringify(previewState.flags);
        const pageObjects = JSON.stringify(previewState.pageViewObjects);
        const behavioralTargetingRules = JSON.stringify(
          previewState.behavioralTargetingRules,
        );
        return startClient(
          apiKey,
          {
            initialFlags,
            pageObjects,
            behavioralTargetingRules,
          },
          config,
        );
      })
      .catch((error) => {
        console.warn('Failed to fetch latest configs for preview:', error);
        return startClient(apiKey, initConfigs, config);
      });
  } else {
    void startClient(apiKey, initConfigs, config);
  }
};

const startClient = (
  apiKey: string,
  initConfigs: InitConfigs,
  config: WebExperimentConfig,
): Promise<void> => {
  const client = DefaultWebExperimentClient.getInstance(
    apiKey,
    initConfigs,
    config,
  );
  return client.start().finally(() => {
    // Don't tear down anti-flicker while a redirect is in-flight. start()
    // resolves immediately after location.replace() is called, but the browser
    // keeps painting the current page until the destination commits — removing
    // the overlay (including a customer's #amp-exp-css) here would flash the
    // source page during the redirect's network wait.
    if (!client.isRedirecting) {
      removeAntiFlickerCss();
    }
  });
};

const fetchLatestConfigs = async (apiKey: string, serverZone?: string) => {
  const serverUrl =
    serverZone === 'EU'
      ? 'https://api.lab.eu.amplitude.com'
      : 'https://api.lab.amplitude.com';
  const api = new SdkPreviewApi(apiKey, serverUrl, HttpClient);
  return api.getPreviewFlagsAndPageViewObjects();
};

// Plugin factory that can be called before client initialization
export const createPlugin = (): Plugin => ({
  name: '@amplitude/experiment-tag',
  type: 'enrichment',
  execute: async (context: Event): Promise<Event> => {
    const globalScope = getGlobalScope();
    const client = globalScope?.webExperiment as DefaultWebExperimentClient;
    if (
      client &&
      typeof client.trackEvent === 'function' &&
      client.isRunning // Check if client is fully started
    ) {
      // Client ready - forward event directly
      client.trackEvent(
        context.event_type,
        context.event_properties as Record<string, unknown>,
      );
    } else if (isConsentDeferred()) {
      // Consent withheld: do not buffer — pre-grant events are not replayed.
    } else {
      bufferAnalyticsEvent({
        event_type: context.event_type,
        event_properties: context.event_properties as Record<string, unknown>,
      });
    }
    return context;
  },
});

// Internal function to flush buffered events
export const flushEventBuffer = (client: DefaultWebExperimentClient): void => {
  if (eventBuffer.length > 0) {
    eventBuffer.forEach(({ event_type, event_properties }) => {
      client.trackEvent(event_type, event_properties);
    });
    eventBuffer.length = 0;
  }
};

export {
  ApplyVariantsOptions,
  RevertVariantsOptions,
  PreviewVariantsOptions,
  WebExperimentClient,
  WebExperimentConfig,
  ConsentStatus,
  ConsentOptions,
} from './types';

export type {
  DebugState,
  FlagDebugInfo,
  VariantDebugInfo,
  PageObjectDebugInfo,
  TriggerDebugInfo,
  VisualEditorDebugInfo,
  DebugEvent,
  VEMessengerState,
  AudienceEvaluationDebugInfo,
} from './types/debug';
