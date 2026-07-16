import { Event, Plugin } from '@amplitude/analytics-types';
import { getGlobalScope } from '@amplitude/experiment-core';

import { consentGate } from './consent-gate';
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

const resolveConsentOptions = (
  config: WebExperimentConfig,
  globalScope: NonNullable<ReturnType<typeof getGlobalScope>>,
): ConsentOptions => ({
  ...config.consentOptions,
  ...globalScope.experimentConfig?.consentOptions, // window wins (existing precedence)
});

/**
 * Updates cookie-consent status. Exposed on `window.webExperiment` (including
 * the pre-init stub) so a CMP callback can call it before the client exists.
 *
 * In v0:
 * - `granted` starts the client once (with the args stashed by `initialize`); a
 *   grant that arrives before `initialize()` is recorded so `initialize()`
 *   starts immediately when it runs.
 * - `rejected` is terminal for this page load: it latches the gate closed and
 *   drops any stashed start, so subsequent `granted` calls are ignored until the
 *   next reload.
 * - `pending` is a no-op (nothing has run).
 */
export const setConsentStatus = (status: ConsentStatus): void => {
  // Terminal decline: latch closed and discard any stashed start so a later
  // grant cannot resume it. Reload is required to reset.
  if (status === 'rejected') {
    consentGate.status = 'rejected';
    consentGate.rejected = true;
    consentGate.deferredStart = null;
    return;
  }

  // Once rejected, ignore any further status changes (including 'granted').
  if (consentGate.rejected) {
    return;
  }

  consentGate.status = status;
  if (
    status === 'granted' &&
    consentGate.deferredStart &&
    !consentGate.started
  ) {
    consentGate.started = true;
    const { apiKey, initConfigs, config } = consentGate.deferredStart;
    consentGate.deferredStart = null;
    // Clear buffered pre-grant events so they aren't replayed into behavioral
    // targeting after a clean, consent-triggered start.
    eventBuffer.length = 0;
    void startClient(apiKey, initConfigs, config);
  }
  // 'pending' -> no-op (nothing was ever written).
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

  // Expose plugin factory immediately (only if not already a real client
  // instance). The stub carries setConsentStatus so a CMP callback can resolve
  // consent before the client is constructed.
  if (!globalScope.webExperiment) {
    globalScope.webExperiment = {
      plugin: createPlugin,
      isStub: true,
      setConsentStatus,
    };
  }

  // Consent gate: while consent is required and not yet granted, stash the args
  // and return without constructing the client. Because nothing is built, no
  // storage/evaluation/tracking/relay runs. setConsentStatus('granted') later
  // starts it. This must sit before both start paths below.
  const consent = resolveConsentOptions(config, globalScope);
  if (consent.consentRequired && !consentGate.started) {
    const status = consentGate.status ?? consent.consentStatus ?? 'pending';
    if (status === 'rejected') {
      // Terminal decline at load: latch closed and never start this page load.
      consentGate.rejected = true;
      consentGate.deferredStart = null;
      return;
    }
    if (status !== 'granted') {
      consentGate.deferredStart = { apiKey, initConfigs, config };
      return;
    }
    consentGate.started = true;
  }

  const shouldFetchConfigs =
    isPreviewMode() || globalScope.WebExperiment?.injectedByExtension;

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
  // getInstance replaces the stub on globalScope.webExperiment with the real
  // client. Keep the consent entry point available so a CMP callback that fires
  // after start still resolves (idempotent grant).
  (
    client as unknown as { setConsentStatus?: typeof setConsentStatus }
  ).setConsentStatus = setConsentStatus;
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
    } else {
      // Client not ready - buffer event
      eventBuffer.push({
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
