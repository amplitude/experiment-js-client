import { Event, Plugin } from '@amplitude/analytics-types';
import { getGlobalScope } from '@amplitude/experiment-core';

import { armDenialCleanup } from './consent/clear-data';
import { consentGate, parseConsentStatus } from './consent/consent-gate';
import { DefaultWebExperimentClient } from './experiment';
import { HttpClient } from './preview/http';
import { SdkPreviewApi } from './preview/preview-api';
import { ConsentStatus, InitConfigs, WebExperimentConfig } from './types';
import { applyAntiFlickerCss, removeAntiFlickerCss } from './util/anti-flicker';
import { mergeWithWindowConfig } from './util/config';
import { discardRedirectImpressionParam, isPreviewMode } from './util/url';

const eventBuffer: Array<{
  event_type: string;
  event_properties?: Record<string, unknown>;
}> = [];

/** Cap for events buffered while the client is starting (not consent-deferred). */
const MAX_EVENT_BUFFER_SIZE = 500;

const isConsentDeferred = (): boolean =>
  consentGate.deferredStart !== null && !consentGate.started;

const bufferAnalyticsEvent = (event: {
  event_type: string;
  event_properties?: Record<string, unknown>;
}): void => {
  if (eventBuffer.length >= MAX_EVENT_BUFFER_SIZE) {
    eventBuffer.shift();
  }
  eventBuffer.push(event);
};

/**
 * Updates cookie-consent status. Exposed on `window.webExperiment` (including
 * the pre-init stub) so a CMP callback can call it before the client exists.
 * `granted` starts a client deferred by an at-load denial, or — for a client
 * already running under pending — flushes buffered storage, replays buffered
 * impressions, and injects the relay iframe. Transitions to `pending` and
 * unknown values are ignored.
 */
export const setConsentStatus = (status: ConsentStatus): void => {
  const parsed = parseConsentStatus(status);
  if (parsed === null) {
    // CMP callbacks are untyped JS, so a typo here isn't caught at compile time.
    // Keep the last known status rather than downgrading to 'pending' — a bad
    // call shouldn't revoke a grant the CMP already made.
    console.warn(
      `[experiment-tag] Invalid setConsentStatus ` +
        `${JSON.stringify(status)}; expected ` +
        `'granted', 'pending', or 'denied'. Ignoring.`,
    );
    return;
  }
  consentGate.manager.setStatus(parsed);
  const deferred = consentGate.deferredStart;
  if (
    consentGate.manager.getStatus() === 'granted' &&
    deferred &&
    !consentGate.started
  ) {
    consentGate.deferredStart = null;
    launchClient(deferred.apiKey, deferred.initConfigs, deferred.config);
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

  // Consent gate: only a denial defers the start. Under pending the client
  // runs normally — the storage/cookie/impression/relay layers below hold
  // everything in memory, so experiments apply without flicker while nothing
  // lands on the device or leaves for a third-party origin. An existing
  // denied deferral keeps the gate closed even if this call resolves
  // consentRequired=false; a later grant starts the deferred client.
  const effectiveConfig = mergeWithWindowConfig(config, globalScope);
  const consent = effectiveConfig.consentOptions;
  const gated = consent.consentRequired || consentGate.deferredStart !== null;
  // Publish the decision before the client exists, so the persistence gates
  // (which run deep inside client construction) can see it. Latched, so a
  // second initialize can't reopen storage that a first one closed.
  consentGate.required = consentGate.required || gated;
  if (gated) {
    // A runtime status (setConsentStatus) wins over the declarative config.
    // An unrecognized config value warns and falls back to 'pending' (fail
    // closed).
    if (!consentGate.manager.hasExplicitStatus()) {
      const configStatus = parseConsentStatus(consent.consentStatus);
      if (consent.consentStatus !== undefined && configStatus === null) {
        console.warn(
          `[experiment-tag] Invalid consentOptions.consentStatus ` +
            `${JSON.stringify(consent.consentStatus)}; expected ` +
            `'granted', 'pending', or 'denied'. Treating as pending.`,
        );
      }
      consentGate.manager.seedFromConfig(configStatus ?? 'pending');
    }
    armDenialCleanup(apiKey, effectiveConfig.instanceName);
    if (consentGate.manager.getStatus() === 'denied') {
      consentGate.deferredStart = { apiKey, initConfigs, config };
      // Drop denied-era events: clear anything already buffered (the plugin's
      // execute() refuses to buffer while the deferral lasts).
      eventBuffer.length = 0;
      // Also strip a redirect-impression URL param a pending source page put
      // on this URL, so it can't replay through the deferred start later.
      discardRedirectImpressionParam();
      return;
    }
    consentGate.deferredStart = null;
    launchClient(apiKey, initConfigs, config);
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
      // Start deferred on denied consent: do not buffer — events tracked
      // while denied are never replayed. (A pending client runs; its events
      // flow through and are gated at the storage layer instead.)
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
