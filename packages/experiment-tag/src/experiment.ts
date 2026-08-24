import { AnalyticsConnector } from '@amplitude/analytics-connector';
import { Event, Plugin } from '@amplitude/analytics-types';
import {
  EvaluationFlag,
  FlagEvaluationTrace,
  getGlobalScope,
  type GlobalScope,
  isLocalStorageAvailable,
} from '@amplitude/experiment-core';
import {
  Experiment,
  Variant,
  AmplitudeIntegrationPlugin,
  ExperimentClient,
  MemoryStorage,
  Variants,
} from '@amplitude/experiment-js-client';
import mutate from 'dom-mutator';
import * as domMutatorExports from 'dom-mutator';
// `MutationController` (and the rest of the type definitions) moved out
// of `dom-mutator`'s public entry in canonical PR #28; pull the type from
// the dist subpath so this keeps compiling against the new bb5f4b5 pin.
import type { MutationController } from 'dom-mutator/dist/types';

import { BehavioralTargetingManager } from './behavioral-targeting';
import { getRelayUrl, RelayClient } from './behavioral-targeting/relay-client';
import { clearIfErasedElsewhere } from './consent/clear-data';
import { type SyncCookieStore } from './consent/consent-cookie-storage';
import {
  consentGate,
  isConsentPending,
  isConsentWithheld,
  onConsentDecision,
} from './consent/consent-gate';
import { wrapIntegrationTrack } from './consent/consent-impression-buffer';
import { showPreviewModeModal } from './preview/preview';
import { MessageBus } from './subscriptions/message-bus';
import {
  PageChangeEvent,
  SubscriptionManager,
} from './subscriptions/subscriptions';
import {
  InitConfigs,
  WebExperimentClient,
  WebExperimentConfig,
  WebExperimentUser,
  ApplyVariantsOptions,
  ConsentStatus,
  PageObject,
  PageObjects,
  PreviewVariantsOptions,
  PreviewState,
  RevertVariantsOptions,
  BehavioralTargetingRules,
} from './types';
import type {
  AudienceEvaluationDebugInfo,
  DebugState,
  FlagDependencyDebugInfo,
  FlagDependencyType,
} from './types/debug';
import { applyAntiFlickerCss, removeAntiFlickerCss } from './util/anti-flicker';
import { enrichUserWithCampaignData } from './util/campaign';
import { mergeWithWindowConfig } from './util/config';
import {
  createCookieStorage,
  getTopLevelDomainSync,
  resolveCrossSubdomainObject,
  setMarketingCookie,
} from './util/cookie';
import {
  cspSafeStyleSheet,
  type StyleSheetHandle,
} from './util/csp-safe-stylesheet';
import { DebugRecorder } from './util/debug-recorder';
import { getInjectUtils } from './util/inject-utils';
import { hideLoadingIndicator } from './util/loading-indicator';
import { VISUAL_EDITOR_SESSION_KEY, WindowMessenger } from './util/messenger';
import { isOpenerChannelBroken } from './util/opener-channel';
import { showOpenerSeveredBanner } from './util/opener-severed-banner';
import { patchRemoveChild } from './util/patch';
import { DEVICE_IFRAME_ID, buildShell, isMobileModeActive } from './util/shell';
import { installSpaLinkInterceptor } from './util/spa-link-interceptor';
import {
  getStorageItem,
  setStorageItem,
  removeStorageItem,
} from './util/storage';
import {
  identityCookieKey,
  PREVIEW_MODE_SESSION_KEY,
} from './util/storage-keys';
import {
  getUrlParams,
  removeQueryParams,
  urlWithoutHash,
  urlWithoutParamsAndAnchor,
  urlWithoutQuery,
  concatenateQueryParamsOf,
  matchesUrl,
} from './util/url';
import { UUID } from './util/uuid';
import { convertEvaluationVariantToVariant } from './util/variant';

import {
  flushEventBuffer,
  setConsentStatus as applyConsentStatus,
} from './index';

const MUTATE_ACTION = 'mutate';
export const INJECT_ACTION = 'inject';
const REDIRECT_ACTION = 'redirect';
export const PREVIEW_MODE_PARAM = 'PREVIEW';
export { PREVIEW_MODE_SESSION_KEY };
const VISUAL_EDITOR_PARAM = 'VISUAL_EDITOR';
export const REDIRECT_IMPRESSION_PARAM = 'AMP_REDIRECT';
// User actions that mark the interaction boundary for the redirect stick-detector.
// A user cannot call replaceState; anything they do to leave a page passes through
// one of these, so their presence between a redirect and the next attempt means a
// person — not a self-driving loop — is navigating.
const USER_INTERACTION_EVENTS = ['pointerdown', 'keydown', 'popstate'];

// Per-flag record of the last redirect fired, written just before navigating.
// `distinguishingParams` are the query keys the redirect added on top of the
// source; their disappearance before any user interaction is what identifies a
// param-stripping loop.
type RedirectMarker = {
  from: string;
  target: string;
  distinguishingParams: string[];
  landed?: boolean;
};

/** Query keys the redirect target adds or changes relative to the source URL. */
const distinguishingParams = (fromUrl: string, targetUrl: string): string[] => {
  try {
    const fromParams = new URL(fromUrl).searchParams;
    const targetParams = new URL(targetUrl).searchParams;
    const keys: string[] = [];
    targetParams.forEach((value, key) => {
      if (fromParams.get(key) !== value) {
        keys.push(key);
      }
    });
    return keys;
  } catch {
    return [];
  }
};

type StoredRedirectImpression = {
  redirectUrl: string;
  variantKey: string;
  expKey?: string;
  metadata?: Record<string, unknown>;
};

const moduleScope = getGlobalScope();
if (moduleScope) {
  moduleScope.Experiment = Experiment;
}

/** Classify a dependency by its flag-key convention. */
export const classifyDependency = (depKey: string): FlagDependencyType => {
  if (depKey.startsWith('holdout-')) {
    return 'holdout';
  }
  if (depKey.startsWith('mutex-')) {
    return 'mutex';
  }
  return 'prerequisite';
};

/**
 * Collects the set of dependency (prerequisite/holdout/mutex) flag keys whose
 * result condition failed during evaluation. Dependency conditions select from
 * the evaluation `result` context (selector `['result', <depKey>, ...]`), so a
 * failed one attributes the dependent flag's `off` to that parent. Only
 * available for locally evaluated flags (remote flags carry no per-segment
 * trace).
 *
 * Scanning stops at the first matched step: real evaluation resolves on the
 * first matching segment, so later trace steps are counterfactual (the trace
 * keeps evaluating them for debug visibility) and must not claim blocking.
 */
const collectFailedDependencyKeys = (
  trace: FlagEvaluationTrace | undefined,
): Set<string> => {
  const failed = new Set<string>();
  if (!trace) {
    return failed;
  }
  for (const step of trace.steps) {
    if (step.matched) {
      break;
    }
    for (const conditionGroup of step.conditionResult ?? []) {
      for (const conditionResult of conditionGroup ?? []) {
        const selector = conditionResult.condition?.selector ?? [];
        if (
          !conditionResult.matched &&
          selector[0] === 'result' &&
          typeof selector[1] === 'string'
        ) {
          failed.add(selector[1]);
        }
      }
    }
  }
  return failed;
};

/**
 * Builds the dependency debug list for a flag: each prerequisite/holdout/mutex
 * parent with its resolved variant and whether it blocked this flag.
 */
export const buildFlagDependencyInfo = (
  flagConfig: EvaluationFlag | undefined,
  variants: Variants,
  trace: FlagEvaluationTrace | undefined,
  flagIsOn: boolean,
): FlagDependencyDebugInfo[] | undefined => {
  const deps = flagConfig?.dependencies;
  if (!deps || deps.length === 0) {
    return undefined;
  }
  const failedDepKeys = collectFailedDependencyKeys(trace);
  return deps.map((depKey) => ({
    flagKey: depKey,
    type: classifyDependency(depKey),
    resolvedVariant: variants[depKey]?.key ?? null,
    // Only claim a dependency is blocking when this flag is off and the trace
    // shows its result condition failing; otherwise stay conservative (false).
    blocking: !flagIsOn && failedDepKeys.has(depKey),
  }));
};

/**
 * Produces a human-readable reason a flag did not resolve to a treatment.
 * Returns undefined when the flag is on.
 */
export const computeInactiveReason = (
  flagIsOn: boolean,
  variantKey: string | undefined,
  audienceEvaluation: AudienceEvaluationDebugInfo | undefined,
  dependencies: FlagDependencyDebugInfo[] | undefined,
): string | undefined => {
  if (flagIsOn) {
    return undefined;
  }
  const blockingDep = dependencies?.find((dep) => dep.blocking);
  if (blockingDep) {
    switch (blockingDep.type) {
      case 'holdout':
        return `Held out by "${blockingDep.flagKey}"`;
      case 'mutex':
        return `Mutually excluded by "${blockingDep.flagKey}"`;
      default:
        return `Prerequisite "${blockingDep.flagKey}" = ${
          blockingDep.resolvedVariant ?? 'off'
        }`;
    }
  }
  if (audienceEvaluation && !audienceEvaluation.matched) {
    return 'Audience not matched';
  }
  if (!variantKey || variantKey === 'off') {
    return 'No variant assigned';
  }
  return undefined;
};

export class DefaultWebExperimentClient implements WebExperimentClient {
  private readonly apiKey: string;
  private readonly initialFlags: [];
  private readonly config: WebExperimentConfig;
  private readonly globalScope: GlobalScope;
  private readonly experimentClient: ExperimentClient;
  private appliedInjections: Set<string> = new Set();
  appliedMutations: {
    [experiment: string]: {
      [variantKey: string]: {
        [actionType: string]: {
          [id: string]: MutationController;
        };
      };
    };
  } = {};
  private previousUrl: string | undefined = undefined;
  // Cache to track exposure for the current URL, should be cleared on URL change
  private urlExposureCache: {
    [url: string]: {
      [flagKey: string]: string | undefined; // variant
    };
  } = {};
  // Also used by chrome extension
  private flagVariantMap: {
    [flagKey: string]: {
      [variantKey: string]: Variant;
    };
  } = {};
  private readonly localFlagKeys: string[] = [];
  private remoteFlagKeys: string[] = [];
  private isRemoteBlocking = false;
  // Public so the bootstrap (index.ts) can avoid removing anti-flicker CSS while
  // a redirect is in-flight — location.replace() doesn't suspend painting, so
  // tearing the overlay down before the navigation commits flashes the source page.
  public isRedirecting = false;
  private customRedirectHandler: ((url: string) => void) | undefined;
  public isRunning = false;
  private readonly messageBus: MessageBus;
  private pageObjects: PageObjects;
  private activePages: PageObjects = {};
  private readonly behavioralTargetingRules: BehavioralTargetingRules = {};
  public readonly behavioralTargetingManager:
    | BehavioralTargetingManager
    | undefined;
  private relayClient: RelayClient | null = null;
  private subscriptionManager: SubscriptionManager | undefined;
  private isVisualEditorMode = false;
  private isDebugActive = false;
  // Preview mode is set by url params, postMessage or session storage, not chrome extension
  isPreviewMode = false;
  previewFlags: Record<string, string> = {};
  /** Redirect impressions parsed from AMP_REDIRECT before the first url_change. */
  private preloadedUrlRedirectImpressions: Record<
    string,
    StoredRedirectImpression
  > | null = null;
  /**
   * Settles once the post-grant identity refresh finishes (immediately on
   * refusal). Armed only by a pending start(); the deferred relay sync awaits
   * it so the relay binds to the durable identity, not an ephemeral mint.
   */
  private identityRefreshOnGrant: Promise<void> | null = null;

  constructor(
    apiKey: string,
    initConfigs: InitConfigs,
    config: WebExperimentConfig = {},
  ) {
    const globalScope = getGlobalScope();
    // While consent is withheld, skip the localStorage availability probe —
    // it writes a throwaway key. Storage is gated to memory until a grant, and
    // every post-grant path degrades gracefully if storage turns out unusable.
    if (!globalScope || (!isConsentWithheld() && !isLocalStorageAvailable())) {
      throw new Error(
        'Amplitude Web Experiment Client could not be initialized.',
      );
    }
    this.globalScope = globalScope;
    this.apiKey = apiKey;
    this.initialFlags = JSON.parse(initConfigs.initialFlags);
    this.pageObjects = JSON.parse(initConfigs.pageObjects);
    this.behavioralTargetingRules = initConfigs.behavioralTargetingRules
      ? JSON.parse(initConfigs.behavioralTargetingRules)
      : {};

    this.config = mergeWithWindowConfig(config, this.globalScope);

    // Ahead of the hydration below, and of start()'s identity resolution — see
    // clearIfErasedElsewhere.
    clearIfErasedElsewhere(this.apiKey, this.config.instanceName);

    // Initialize behavioral targeting infrastructure only if there are rules
    if (Object.keys(this.behavioralTargetingRules).length > 0) {
      this.behavioralTargetingManager = new BehavioralTargetingManager(
        this.apiKey,
        this.behavioralTargetingRules,
        this.config.rtbtSessionTimeout,
      );
    }

    this.initialFlags.forEach((flag: EvaluationFlag) => {
      const { key, variants, metadata = {} } = flag;

      this.flagVariantMap[key] = {};
      Object.keys(variants).forEach((variantKey) => {
        this.flagVariantMap[key][variantKey] =
          convertEvaluationVariantToVariant(variants[variantKey]);
        this.flagVariantMap[key][variantKey].metadata = {
          deliveryMethod: 'web',
        };
      });

      if (metadata.evaluationMode !== 'local') {
        this.remoteFlagKeys.push(key);
      }
    });

    // Flags that depend on at least one remote flag are also considered remote.
    // Iterate to fixed point to handle transitive dependencies.
    // Track which keys were promoted so we can exclude only those from
    // localFlagKeys — flags that are directly 'remote' but cached in session
    // storage as 'local' should still be applied locally (fast-path rendering).
    const transitivelyPromotedKeys = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      this.initialFlags.forEach((flag: EvaluationFlag) => {
        if (
          !this.remoteFlagKeys.includes(flag.key) &&
          flag.dependencies?.some((dep) => this.remoteFlagKeys.includes(dep))
        ) {
          this.remoteFlagKeys.push(flag.key);
          transitivelyPromotedKeys.add(flag.key);
          changed = true;
        }
      });
    }

    const initialFlagsString = JSON.stringify(this.initialFlags);

    // initialize the experiment
    this.experimentClient = Experiment.initialize(this.apiKey, {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      internalInstanceNameSuffix: 'web',
      // The SDK's own direct-to-device writers — DefaultUserProvider
      // (landing_url/first_seen) and the unsent-exposure queue — sit below
      // this tag's gated storage helpers, so they get the gate as a callback.
      // Checked per call: a mid-session grant reopens persistence
      // immediately, and when gating was never enabled this always allows.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      internalPersistenceAllowed: () => !isConsentWithheld(),
      initialFlags: initialFlagsString,
      // timeout for fetching remote flags
      fetchTimeoutMillis: 1000,
      pollOnStart: false,
      fetchOnStart: false,
      automaticExposureTracking: false,
      ...this.config,
      // While consent is withheld, keep the amp-exp-* variant/flag caches in
      // memory instead of sessionStorage. Chosen once, here: after a
      // mid-session grant the cache stays in memory for this page and reverts
      // to sessionStorage on the next load — fine for a cache that
      // repopulates on every fetch.
      ...(isConsentWithheld() && {
        internalCacheStorage: new MemoryStorage(),
      }),
    });
    // Get all the locally available flag keys from the SDK.
    // Exclude flags promoted to remoteFlagKeys via the dependency loop above —
    // their remote dependencies must be fetched first or mutex/holdout bucketing
    // will run against stale parent-flag state and assign the wrong variant.
    const variants = this.experimentClient.all();
    this.localFlagKeys = Object.keys(variants).filter(
      (key) =>
        variants[key]?.metadata?.evaluationMode === 'local' &&
        !transitivelyPromotedKeys.has(key),
    );
    this.messageBus = new MessageBus();
  }

  /**
   * Start the web experiment client.
   */
  public async start() {
    if (this.isRunning) {
      return;
    }
    patchRemoveChild();
    installSpaLinkInterceptor();
    const urlParams = getUrlParams();

    // When running inside the mobile-shell iframe (i.e. the iframe that
    // buildShell created on the parent page), skip overlay loading and expose
    // dom-mutator on the window so the overlay in the parent frame can apply
    // and control mutations against this document.
    let isInsideDeviceIframe = false;
    try {
      isInsideDeviceIframe =
        this.globalScope.frameElement?.id === DEVICE_IFRAME_ID;
    } catch {
      isInsideDeviceIframe = false;
    }
    if (isInsideDeviceIframe && isMobileModeActive()) {
      (this.globalScope as any).ampDomMutator = domMutatorExports;
      this.isRunning = true;
      return;
    }

    this.isVisualEditorMode =
      urlParams[VISUAL_EDITOR_PARAM] === 'true' ||
      getStorageItem('sessionStorage', VISUAL_EDITOR_SESSION_KEY) !== null;
    DebugRecorder.init(this.globalScope);
    this.isDebugActive = DebugRecorder.isActive();
    this.subscriptionManager = new SubscriptionManager(
      this,
      this.messageBus,
      this.pageObjects,
      this.behavioralTargetingManager,
      {
        ...this.config,
        isVisualEditorMode: this.isVisualEditorMode,
        isDebugActive: this.isDebugActive,
      },
      this.globalScope,
    );
    this.setupPreviewMode(urlParams);
    this.subscriptionManager.initSubscriptions();
    // Redirect stick-detector: settle any marker left by a prior redirect against
    // this fresh load, then watch for the user interaction that ends its window.
    this.reconcileRedirectMarkersOnLoad();
    this.setupRedirectInteractionReset();

    // Register debug state provider so DebugRecorder can assemble full snapshots
    DebugRecorder.registerStateProvider(() => ({
      flags: this.buildFlagDebugInfo(),
      visualEditor: {
        isActive: this.isVisualEditorMode,
        source: this.isVisualEditorMode
          ? getStorageItem('sessionStorage', VISUAL_EDITOR_SESSION_KEY) !== null
            ? ('session_storage' as const)
            : ('url_param' as const)
          : null,
      },
      currentUrl: this.globalScope.location.href,
    }));

    // if in visual edit mode, remove the query param
    if (this.isVisualEditorMode) {
      const veSource =
        urlParams[VISUAL_EDITOR_PARAM] === 'true'
          ? 'url_param'
          : 'session_storage';
      DebugRecorder.push('ve_mode_detected', `source=${veSource}`);

      // The overlay is loaded by skylab postMessaging OpenOverlay through the
      // window.opener channel. If it's broken (COOP, or explicit
      // window.opener = null), that message never arrives and the editor
      // never loads — show a banner instead.
      if (isOpenerChannelBroken()) {
        DebugRecorder.push(
          'opener_check',
          'FAIL: window.opener is null, closed, or inaccessible',
        );
        DebugRecorder.setMessengerState('error');
        showOpenerSeveredBanner();
        this.globalScope.history.replaceState(
          {},
          '',
          removeQueryParams(this.globalScope.location.href, [
            VISUAL_EDITOR_PARAM,
          ]),
        );
        // Prevent re-initialization; the SDK won't load in this session.
        this.isRunning = true;
        return;
      }
      DebugRecorder.push('opener_check', 'PASS');

      if (isMobileModeActive()) {
        // In mobile mode, build the shell first and load the overlay after.
        // The overlay must render into the already-built shell to avoid a
        // race where buildShell restructures the DOM while the overlay's
        // React 18 concurrent render is in-flight.
        await buildShell(this.globalScope);
      }
      WindowMessenger.setup();
      this.globalScope.history.replaceState(
        {},
        '',
        removeQueryParams(this.globalScope.location.href, [
          VISUAL_EDITOR_PARAM,
        ]),
      );
      DebugRecorder.push(
        'url_param_removed',
        `cleaned URL: ${this.globalScope.location.href}`,
      );
      // fire url_change upon landing on page, set updateActivePagesOnly to not trigger variant actions
      this.subscriptionManager.markUrlAsPublished(
        this.globalScope.location.href,
      );
      this.messageBus.publish('url_change', { updateActivePages: true });
      this.isRunning = true;
      flushEventBuffer(this);
      return;
    }

    this.consumeRedirectParamFromUrl(urlParams);

    // fire url_change upon landing on page, set updateActivePagesOnly to not trigger variant actions
    this.subscriptionManager.markUrlAsPublished(this.globalScope.location.href);
    this.messageBus.publish('url_change', { updateActivePages: true });

    // Cross-subdomain cookies (identity, redirect, RTBT) resolve the domain
    // lazily via getTopLevelDomainSync at write time so a pending-time guess is
    // not pinned before consent lands.

    const experimentStorageName = `EXP_${this.apiKey.slice(0, 10)}`;
    const user =
      getStorageItem<WebExperimentUser>(
        'localStorage',
        experimentStorageName,
      ) || {};

    // if web_exp_id does not exist:
    // 1. if device_id exists, migrate device_id to web_exp_id and remove device_id
    // 2. if device_id does not exist, create a new web_exp_id
    // 3. if both device_id and web_exp_id exist, remove device_id
    if (!user.web_exp_id) {
      user.web_exp_id = user.device_id || UUID();
      delete user.device_id;
      setStorageItem('localStorage', experimentStorageName, user);
    } else if (user.web_exp_id && user.device_id) {
      delete user.device_id;
      setStorageItem('localStorage', experimentStorageName, user);
    }

    // Resolve web_exp_id_v2 and first_seen from the shared root-domain cookie
    // before getVariants(), so local evaluation uses the cross-subdomain
    // first_seen rather than a subdomain-local mint. The cookie domain is
    // resolved when the storage first reaches real cookies (post-grant for a
    // pending start), so it is never pinned to an unprobed guess.
    const crossSubdomainCookieStorage = createCookieStorage<string>(() => {
      const domain = getTopLevelDomainSync(this.globalScope.location.hostname);
      return {
        ...(domain && { domain }),
        sameSite: 'Lax',
        expirationDays: 365,
      };
    });

    const defaultUserProviderStorageKey = `${experimentStorageName}_DEFAULT_USER_PROVIDER`;
    const defaultUserProviderData =
      getStorageItem<{ first_seen?: string }>(
        'localStorage',
        defaultUserProviderStorageKey,
      ) || {};

    // web_exp_id is guaranteed above; seed v2 from it when no cookie/local v2 exists.
    const identity = resolveCrossSubdomainObject(
      crossSubdomainCookieStorage,
      identityCookieKey(this.apiKey),
      {
        web_exp_id_v2: user.web_exp_id_v2 ?? user.web_exp_id,
        first_seen: defaultUserProviderData.first_seen,
      },
      {
        web_exp_id_v2: UUID,
        first_seen: () => (Date.now() / 1000).toString(),
      },
    );

    user.web_exp_id_v2 = identity.web_exp_id_v2;
    setStorageItem('localStorage', experimentStorageName, user);

    if (identity.first_seen !== defaultUserProviderData.first_seen) {
      defaultUserProviderData.first_seen = identity.first_seen;
      setStorageItem(
        'localStorage',
        defaultUserProviderStorageKey,
        defaultUserProviderData,
      );
    }
    user.first_seen = identity.first_seen;

    // Under pending, the gated reads above hid any durable identity already on
    // disk, so the ids resolved here may be an ephemeral mint. The grant flush
    // reconciles the disk state; on grant, re-read it and move the running
    // client onto the durable identity — otherwise this page would keep the
    // ephemeral ids, fragmenting bucketing and behavioral data across the
    // grant boundary. Variants already painted stay as applied; no mid-page
    // repaint.
    if (isConsentPending()) {
      // Snapshot the pending-time values. After the flush, a cookie field
      // still equal to one of these is this page's own buffered write, and a
      // durable value from disk should win over it.
      const pendingWebExpIdV2 = user.web_exp_id_v2;
      const pendingFirstSeen = user.first_seen;
      this.identityRefreshOnGrant = new Promise<void>((resolve) => {
        onConsentDecision((granted) => {
          if (!granted) {
            resolve();
            return;
          }
          try {
            // The localStorage gate has already flushed (its listener was
            // armed first); the cookie read below joins the cookie flush.
            const durableUser =
              getStorageItem<WebExperimentUser>(
                'localStorage',
                experimentStorageName,
              ) || {};
            const durableProvider =
              getStorageItem<{ first_seen?: string }>(
                'localStorage',
                defaultUserProviderStorageKey,
              ) || {};
            const refreshed = resolveCrossSubdomainObject(
              crossSubdomainCookieStorage,
              identityCookieKey(this.apiKey),
              {
                web_exp_id_v2: durableUser.web_exp_id_v2 ?? user.web_exp_id_v2,
                first_seen: durableProvider.first_seen ?? user.first_seen,
              },
              {
                web_exp_id_v2: UUID,
                first_seen: () => (Date.now() / 1000).toString(),
              },
            );
            // If no durable cookie existed, the flush wrote this page's mint
            // into it. Restore durable localStorage values over any field
            // still at its pending-time value and rewrite the cookie — the
            // same outcome an ungated start() would have produced.
            const restored = { ...refreshed };
            if (
              durableUser.web_exp_id_v2 &&
              refreshed.web_exp_id_v2 === pendingWebExpIdV2 &&
              durableUser.web_exp_id_v2 !== pendingWebExpIdV2
            ) {
              restored.web_exp_id_v2 = durableUser.web_exp_id_v2;
            }
            if (
              durableProvider.first_seen &&
              refreshed.first_seen === pendingFirstSeen &&
              durableProvider.first_seen !== pendingFirstSeen
            ) {
              restored.first_seen = durableProvider.first_seen;
            }
            if (
              restored.web_exp_id_v2 !== refreshed.web_exp_id_v2 ||
              restored.first_seen !== refreshed.first_seen
            ) {
              try {
                crossSubdomainCookieStorage.set(
                  identityCookieKey(this.apiKey),
                  JSON.stringify(restored),
                );
              } catch {
                /* write blocked: carry the restored values in memory only */
              }
            }
            user.web_exp_id = durableUser.web_exp_id ?? user.web_exp_id;
            user.web_exp_id_v2 = restored.web_exp_id_v2;
            user.first_seen = restored.first_seen;
            const refreshedUser: WebExperimentUser = {
              ...((this.experimentClient.getUser() ?? {}) as WebExperimentUser),
              web_exp_id: user.web_exp_id,
              web_exp_id_v2: user.web_exp_id_v2,
              first_seen: user.first_seen,
            };
            this.experimentClient.setUser(refreshedUser);
          } catch {
            // A failed refresh keeps the ephemeral identity — the same state
            // the page was already in; the next load reads the durable one.
          } finally {
            resolve();
          }
        });
      });
    }

    this.experimentClient.setUser(user);

    // evaluate variants for page targeting
    const variants: Variants = this.getVariants();

    for (const [flagKey, variant] of Object.entries(variants)) {
      // only apply anti-flicker for remote flags active on the page
      if (
        this.remoteFlagKeys.includes(flagKey) &&
        variant.metadata?.blockingEvaluation &&
        Object.keys(this.activePages).includes(flagKey) &&
        !this.remoteFlagKeys.every((key) =>
          Object.keys(this.previewFlags).includes(key),
        )
      ) {
        this.isRemoteBlocking = true;
        // Apply anti-flicker CSS to prevent UI flicker
        applyAntiFlickerCss();
      }
    }

    const enrichedUser = enrichUserWithCampaignData(this.apiKey, user);

    // If no integration has been set, use an Amplitude integration.
    if (!this.globalScope.experimentIntegration) {
      const connector = AnalyticsConnector.getInstance('$default_instance');
      this.globalScope.experimentIntegration = new AmplitudeIntegrationPlugin(
        this.apiKey,
        connector,
        1000,
      );
    }
    this.globalScope.experimentIntegration.type = 'integration';
    if (consentGate.required) {
      // Must precede addPlugin: the integration manager binds `track` as it
      // takes the plugin on, so a later wrap would never be seen.
      wrapIntegrationTrack(this.globalScope.experimentIntegration);
    }
    this.experimentClient.addPlugin(this.globalScope.experimentIntegration);
    this.experimentClient.setUser(enrichedUser);
    this.updateUserWithBehaviors();

    // fire stored redirect impressions upon startup (must run before applyVariants
    // so the current URL is checked before any redirect changes location.href)
    try {
      this.fireStoredRedirectImpressions();
    } catch {
      // do nothing
    }
    // Subscribe directly to url_change events to fire redirect impressions
    this.messageBus.subscribe('url_change', () => {
      // A custom-redirect-handler (SPA soft nav) keeps this JS context alive, so
      // isRedirecting would otherwise leak true forever — suppressing anti-flicker
      // teardown and remote-flag handling on the destination route. url_change is
      // the SDK's own post-navigation signal, so the first one after a redirect
      // marks it committed: clear the flag and tear down the overlay. A hard
      // location.replace() unloads the page before this fires, so it is a no-op
      // there (which is correct — that path needs no reset).
      if (this.isRedirecting) {
        this.isRedirecting = false;
        removeAntiFlickerCss();
      }
      try {
        this.fireStoredRedirectImpressions();
      } catch {
        // do nothing
      }
    });

    // Holdout/mutex bucketing requires user identity (user_id,
    // device_id) — wait for the integration's setup() only when present.
    const hasHoldoutOrMutex = this.initialFlags.some(
      (flag: EvaluationFlag) =>
        flag.key.startsWith('holdout-') || flag.key.startsWith('mutex-'),
    );
    if (hasHoldoutOrMutex) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await this.experimentClient.integrationManager.ready();
    }

    // apply local variants
    await this.applyVariants({ flagKeys: this.localFlagKeys });
    await this.previewVariants({
      keyToVariant: this.previewFlags,
    });

    if (!this.isRemoteBlocking && !this.isRedirecting) {
      removeAntiFlickerCss();
    }

    if (
      this.isRedirecting ||
      // do not fetch remote flags if all remote flags are in preview mode
      this.remoteFlagKeys.every((key) =>
        Object.keys(this.previewFlags).includes(key),
      )
    ) {
      this.scheduleRelaySync(enrichedUser);
      this.isRunning = true;
      flushEventBuffer(this);
      return;
    }

    await this.fetchRemoteFlags();
    // apply remote variants - if fetch is unsuccessful, fallback order: 1. localStorage flags, 2. initial flags
    await this.applyVariants({ flagKeys: this.remoteFlagKeys });
    this.scheduleRelaySync(enrichedUser);
    this.isRunning = true;
    flushEventBuffer(this);
  }

  /**
   * Get singleton of the {@link DefaultWebExperimentClient} if it has already been initialized.
   * If not, initialize the client and return the instance.
   * @param apiKey
   * @param initConfigs
   * @param config
   */
  static getInstance(
    apiKey: string,
    initConfigs: InitConfigs,
    config: WebExperimentConfig = {},
  ): DefaultWebExperimentClient {
    const globalScope = getGlobalScope();
    if (!globalScope) {
      throw new Error(
        'Amplitude Web Experiment Client could not be initialized.',
      );
    }
    // if the client has already been initialized not a stub, return the
    // existing instance
    if (globalScope.webExperiment && !globalScope.webExperiment.isStub) {
      const existingClient =
        globalScope.webExperiment as DefaultWebExperimentClient;
      // Flush any events that may have been buffered since last initialization
      if (existingClient.isRunning) {
        flushEventBuffer(existingClient);
      }
      return existingClient;
    }
    const webExperiment = new DefaultWebExperimentClient(
      apiKey,
      initConfigs,
      config,
    );
    // Set the real client instance
    globalScope.webExperiment = webExperiment;

    // Note: Don't flush buffer here - wait until start() completes and isRunning = true
    // The buffer will be flushed when isRunning becomes true

    return webExperiment;
  }

  /**
   * Get the underlying {@link ExperimentClient} instance.
   */
  public getExperimentClient(): ExperimentClient {
    return this.experimentClient;
  }

  /**
   * Hide the visual editor loading indicator.
   * Called by experiment-overlay when it's ready to render.
   */
  public hideLoadingIndicator(): void {
    hideLoadingIndicator();
  }

  /**
   * Apply evaluated variants to the page.
   * @param options
   */
  public async applyVariants(options?: ApplyVariantsOptions) {
    const { flagKeys } = options || {};
    const variants = this.getVariants();
    if (Object.keys(variants).length === 0) {
      return;
    }
    const currentUrl = urlWithoutParamsAndAnchor(
      this.globalScope.location.href,
    );
    // Initialize the cache if on a new URL
    if (!this.urlExposureCache?.[currentUrl]) {
      this.urlExposureCache = {};
      this.urlExposureCache[currentUrl] = {};
    }

    try {
      this.fireStoredRedirectImpressions();
    } catch {
      // do nothing
    }

    for (const key in variants) {
      // preview actions are handled by previewVariants
      if ((flagKeys && !flagKeys.includes(key)) || this.previewFlags[key]) {
        continue;
      }
      const variant = variants[key];
      const variantKey = variant.key || '';

      // Check if the variant key has changed for this experiment
      // If so, revert all mutations for this experiment
      if (this.appliedMutations[key]) {
        const appliedVariantKeys = Object.keys(this.appliedMutations[key]);
        if (
          appliedVariantKeys.length > 0 &&
          !appliedVariantKeys.includes(variantKey)
        ) {
          // Variant key has changed, revert all mutations for this experiment
          this.revertVariants({ flagKeys: [key] });
          // Clean up the applied mutations for this experiment
          delete this.appliedMutations[key];
        }
      }

      const isWebExperimentation = variant.metadata?.deliveryMethod === 'web';
      if (isWebExperimentation) {
        const payloadIsArray = Array.isArray(variant.payload);
        // TODO: update to handle impression tracking when control variant redirect is supported
        if (variant.key === 'off' || variant.key === 'control') {
          if (this.isActionActiveOnPage(key, undefined)) {
            this.exposureWithDedupe(key, variant);
          }
          if (variant.key === 'off') {
            // revert all applied mutations and injections
            this.revertVariants({ flagKeys: [key] });
            continue;
          }
        }

        if (payloadIsArray) {
          await this.handleVariantAction(key, variant);
        }
      }
    }
  }

  /**
   * Revert variant actions applied by the experiment.
   * @param options
   */
  public revertVariants(options?: RevertVariantsOptions) {
    if (!this.appliedMutations) return;

    let { flagKeys } = options || {};
    if (!flagKeys) {
      flagKeys = Object.keys(this.appliedMutations);
    }

    for (const key of flagKeys) {
      const variantMap = this.appliedMutations[key];
      if (!variantMap) continue;

      for (const variantKey in variantMap) {
        const typeMap = variantMap[variantKey];
        if (!typeMap) continue;

        for (const actionType in typeMap) {
          for (const id in typeMap[actionType]) {
            typeMap[actionType][id]?.revert?.();
          }
        }
      }
      delete this.appliedMutations[key];
    }
  }

  /**
   * Preview the effect of a variant on the page.
   * @param options
   */
  public async previewVariants(options: PreviewVariantsOptions) {
    const { keyToVariant } = options;
    if (!keyToVariant) {
      return;
    }

    this.revertVariants({ flagKeys: Object.keys(keyToVariant) });

    for (const key in keyToVariant) {
      const variant = keyToVariant[key];
      const flag = this.flagVariantMap[key];
      if (!flag) {
        continue;
      }
      const variantObject = flag[variant];
      if (!variantObject) {
        continue;
      }
      if (this.isPreviewMode) {
        showPreviewModeModal({
          flags: this.previewFlags,
        });
      }
      const payload = variantObject.payload;
      if (!payload || !Array.isArray(payload)) {
        if (this.isActionActiveOnPage(key, undefined)) {
          this.exposureWithDedupe(key, variantObject);
        }
        continue;
      }
      await this.handleVariantAction(key, variantObject);
    }
  }

  /**
   * Get all variants for the current web experiment user context.
   */
  public getVariants(): Variants {
    const variants: Variants = {};
    for (const key of [...this.localFlagKeys, ...this.remoteFlagKeys]) {
      variants[key] = this.experimentClient.variant(key);
    }
    return variants;
  }

  /**
   * Get the list of experiments with active mutations or injects on the current page.
   */
  public getActiveExperiments(): string[] {
    return Object.keys(this.appliedMutations);
  }

  /**
   * Get a map of active page view objects.
   */
  public getActivePages(): PageObjects {
    return this.activePages;
  }

  /**
   * Add a subscriber to the page change event.
   * @param callback
   * @returns An unsubscribe function to remove the subscriber.
   */

  public addPageChangeSubscriber(
    callback: (event: PageChangeEvent) => void,
  ): (() => void) | undefined {
    if (this.subscriptionManager) {
      return this.subscriptionManager.addPageChangeSubscriber(callback);
    }
  }

  /**
   * Behavioral targeting evaluates in two phases at startup:
   *
   *  1. start() evaluates and applies variants from this origin's own local
   *     event store (already done by the time we get here).
   *  2. Relay sync (this method): a hidden CDN iframe pulls the shared
   *     cross-subdomain event store, merges it into local storage, and
   *     re-evaluates behavioral targeting. If matched behaviors changed,
   *     {@link reapplyVariantsAfterRelaySync} re-applies the affected variants.
   *
   * Non-blocking: the iframe init and merge run after anti-flicker is removed,
   * so a relay-driven change repaints rather than delaying first paint.
   */
  private scheduleRelaySync(user: WebExperimentUser): void {
    // Relay sync still runs in preview mode: a page can preview one flag while
    // other behavioral-targeting flags evaluate normally and need the merge.
    // Previewed flags are excluded from the relay re-apply
    // (reapplyVariantsAfterRelaySync) and from applyVariants directly, so
    // forced preview variants are never clobbered.
    if (!this.behavioralTargetingManager || this.isVisualEditorMode) {
      return;
    }

    const webExpIdV2 = user.web_exp_id_v2 ?? user.web_exp_id;
    if (!webExpIdV2) {
      return;
    }

    // The relay iframe stores events in the CDN origin's localStorage, so it
    // must not exist before consent. Deferred rather than skipped: a grant
    // re-runs this after the storage flush and identity refresh (their
    // listeners were armed earlier, so they fire first), and re-reads the
    // client's user so the relay binds to the durable identity rather than a
    // pending-time mint. On refusal — including one that already landed —
    // nothing is armed and the relay stays out for the rest of the page; a
    // later re-opt-in gets it on the next load.
    if (isConsentWithheld()) {
      if (isConsentPending()) {
        onConsentDecision((granted) => {
          if (granted) {
            void (async () => {
              await this.identityRefreshOnGrant;
              this.scheduleRelaySync({
                ...user,
                ...(this.experimentClient.getUser() as WebExperimentUser),
              });
            })();
          }
        });
      }
      return;
    }

    // Single-shot: scheduleRelaySync runs exactly once per start() (the two
    // call sites are mutually exclusive; the consent deferral above re-enters
    // at most once). If a future change needs to re-run this, add ownership
    // tracking that also covers reapplyVariantsAfterRelaySync's awaits.
    const relayClient = new RelayClient(
      this.apiKey,
      webExpIdV2,
      getRelayUrl(this.apiKey, this.config.serverZone, this.config.relayUrl),
    );
    this.relayClient = relayClient;

    if (consentGate.required) {
      // Revocation must stop requests to the third-party CDN origin, not just
      // ignore responses: destroy the iframe and detach the dual-write. Armed
      // here because a relay only comes into being while consent is granted,
      // so the next transition can only be a revocation.
      onConsentDecision((granted) => {
        if (!granted) {
          this.teardownRelay(relayClient);
        }
      });
    }

    void this.behavioralTargetingManager
      .beginRelaySync(relayClient)
      .then((result) => {
        if (
          result.status === 'unavailable' ||
          result.status === 'sync_failed'
        ) {
          this.teardownRelay(relayClient);
          return;
        }
        // Sync succeeded: attach the relay client for ongoing dual-write.
        this.behavioralTargetingManager?.setRelayClient(relayClient);
        if (result.status === 'behaviors_changed') {
          return this.reapplyVariantsAfterRelaySync(true).catch(
            (reapplyError) => {
              console.warn(
                'Experiment relay variant re-apply failed:',
                reapplyError,
              );
            },
          );
        }
      })
      .catch(() => {
        this.teardownRelay(relayClient);
      });
  }

  private teardownRelay(relayClient: RelayClient): void {
    relayClient.destroy();
    this.relayClient = null;
    this.behavioralTargetingManager?.setRelayClient(null);
  }

  /**
   * Re-apply variants when a relay sync changed the matched behaviors
   * (phase 2 of the startup described on {@link scheduleRelaySync}).
   */
  private async reapplyVariantsAfterRelaySync(
    behaviorsChanged: boolean,
  ): Promise<void> {
    if (!behaviorsChanged || !this.behavioralTargetingManager) {
      return;
    }

    this.updateUserWithBehaviors();

    // Exclude previewed flags: their variants are forced and must not be
    // re-applied/re-fetched here (also avoids a pointless fetchRemoteFlags when
    // every behavioral remote flag is previewed).
    const flagKeys = Object.keys(this.behavioralTargetingRules).filter(
      (key) => !this.previewFlags[key],
    );
    const localKeys = flagKeys.filter((key) =>
      this.localFlagKeys.includes(key),
    );
    const remoteKeys = flagKeys.filter((key) =>
      this.remoteFlagKeys.includes(key),
    );

    if (localKeys.length > 0) {
      await this.applyVariants({ flagKeys: localKeys });
    }
    if (remoteKeys.length > 0) {
      await this.fetchRemoteFlags();
      await this.applyVariants({ flagKeys: remoteKeys });
    }
  }

  /**
   * Update the user with matched behavioral targeting IDs.
   * Sets the user property `behavioral_targeting` to an array of all matched behavior IDs.
   */
  public updateUserWithBehaviors(): void {
    // Extract all behavior IDs from the map
    if (!this.behavioralTargetingManager) {
      return;
    }
    const behaviorIds: string[] = [];
    for (const behaviorSet of this.behavioralTargetingManager
      .getMatchedBehaviors()
      .values()) {
      behaviorIds.push(...behaviorSet);
    }

    // Get the current user from the experiment client
    const currentUser = this.experimentClient.getUser();

    // Update user with behavioral_targeting property directly on the user object
    const updatedUser = {
      ...currentUser,
      behavioral_targeting: behaviorIds,
    };

    // Set the updated user
    this.experimentClient.setUser(updatedUser);
  }

  /**
   * When in visual editor mode, update the current page objects and reinitialize subscriptions and active pages.
   *
   * @param {PageObjects} pageObjects - The new set of page objects to be set.
   */

  public setPageObjects(pageObjects: PageObjects) {
    if (this.isVisualEditorMode) {
      this.pageObjects = pageObjects;
      this.subscriptionManager?.setPageObjects(pageObjects);
      this.activePages = {};
      this.messageBus.unsubscribeAll();
      this.subscriptionManager?.initSubscriptions();
      // update active pages
      this.messageBus.publish('url_change', { updateActivePages: true });
    }
  }

  /**
   * Set a custom redirect handler.
   */
  public setRedirectHandler(handler: (url: string) => void) {
    this.customRedirectHandler = handler;
  }

  /**
   * Manually activate a page trigger with the specified name.
   * @param name The name of the manual trigger to activate
   * @param isActive Whether the trigger should be activated or deactivated
   */
  public toggleManualPageObject(name: string, isActive = true) {
    this.subscriptionManager?.toggleManualPageObject(name, isActive);
  }

  /**
   * Returns a snapshot of the current debug state for all flags,
   * including per-page-object trigger introspection.
   */
  public getDebugState(): DebugState {
    return DebugRecorder.getDebugState();
  }

  private buildFlagDebugInfo(): DebugState['flags'] {
    const flags: DebugState['flags'] = {};
    const variants = this.getVariants();
    const debugPageObjects =
      this.subscriptionManager?.getDebugPageObjects() ?? {};

    // Index flag config by key so we can surface dependencies + metadata that
    // are not carried in the evaluation variants themselves.
    const flagConfigByKey: Record<string, EvaluationFlag> = {};
    for (const flag of this.initialFlags as EvaluationFlag[]) {
      flagConfigByKey[flag.key] = flag;
    }

    const traces: Record<string, FlagEvaluationTrace> | undefined =
      this.localFlagKeys.length > 0
        ? this.experimentClient.getEvaluationTraces(this.localFlagKeys)
        : undefined;

    for (const flagKey of [...this.localFlagKeys, ...this.remoteFlagKeys]) {
      const variant = variants[flagKey];
      const activePagesForFlag = this.activePages[flagKey];
      const flagConfig = flagConfigByKey[flagKey];

      let audienceEvaluation: AudienceEvaluationDebugInfo | undefined;
      const trace = traces?.[flagKey];
      // Local flags: full per-segment traces from the evaluation engine
      if (trace) {
        audienceEvaluation = {
          matched: trace.matched,
          matchedSegment: trace.matchedSegment,
          steps: trace.steps,
        };
      }
      // Remote flags: server-side evaluation, only matched segment name available from variant metadata
      else if (variant?.metadata?.segmentName) {
        audienceEvaluation = {
          matched: true,
          matchedSegment: variant.metadata.segmentName as string,
          steps: [],
        };
      }

      // A flag counts as "on" when it resolves to a real (non-off) variant.
      const flagIsOn = !!variant?.key && variant.key !== 'off';
      const dependencies = buildFlagDependencyInfo(
        flagConfig,
        variants,
        trace,
        flagIsOn,
      );
      const inactiveReason = computeInactiveReason(
        flagIsOn,
        variant?.key,
        audienceEvaluation,
        dependencies,
      );

      flags[flagKey] = {
        flagKey,
        variant: variant?.key
          ? {
              key: variant.key,
              value: variant.value,
              metadata: variant.metadata,
            }
          : null,
        isActive:
          !!activePagesForFlag && Object.keys(activePagesForFlag).length > 0,
        audienceEvaluation,
        pageObjects: debugPageObjects[flagKey] ?? [],
        flagMetadata: flagConfig?.metadata,
        dependencies,
        inactiveReason,
      };
    }

    return flags;
  }

  /**
   * Subscribe to debug state changes. Fires debounced (~100 ms) on page change events.
   * @returns An unsubscribe function, or undefined if subscriptions are not initialized.
   */
  public addDebugStateSubscriber(
    callback: (state: DebugState) => void,
  ): (() => void) | undefined {
    if (this.subscriptionManager) {
      return this.subscriptionManager.addDebugStateSubscriber(callback);
    }
  }

  public setConsentStatus(status: ConsentStatus): void {
    applyConsentStatus(status);
  }

  /**
   * Returns an Amplitude plugin that forwards analytics events to trigger page objects.
   * @returns An Amplitude Plugin that intercepts analytics events
   */
  public plugin(): Plugin {
    return {
      name: '@amplitude/experiment-tag',
      type: 'enrichment',

      setup: async (): Promise<void> => {
        // No setup required
      },

      execute: async (context: Event): Promise<Event> => {
        this.trackEvent(
          context.event_type,
          context.event_properties as Record<string, unknown>,
        );

        return context;
      },
    };
  }

  /**
   * Track an analytics event that can trigger page objects and behavioral targeting.
   * @param event_type The event type/name
   * @param event_properties Optional event properties
   */
  public trackEvent(
    event_type: string,
    event_properties?: Record<string, unknown>,
  ) {
    // Store event in behavioral targeting storage
    this.behavioralTargetingManager?.trackEvent(
      event_type,
      event_properties || {},
    );

    // Publish to message bus for page object triggers
    this.messageBus.publish('analytics_event', {
      event: event_type,
      properties: event_properties || {},
    });
  }

  private async fetchRemoteFlags() {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await this.experimentClient.doFlags();
    } catch (error) {
      console.warn('Error fetching remote flags:', error);
    }
  }

  private async handleVariantAction(key: string, variant: Variant) {
    for (const action of variant.payload) {
      if (action.action === REDIRECT_ACTION) {
        await this.handleRedirect(action, key, variant);
      } else if (action.action === MUTATE_ACTION) {
        this.handleMutate(action, key, variant);
      } else if (action.action === INJECT_ACTION) {
        this.handleInject(action, key, variant);
      }
    }
  }

  private async handleRedirect(action, flagKey: string, variant: Variant) {
    // In-flight redirect: block re-entrant applyVariants on the source page
    // before navigation commits (replaces the old referrer-equality guard).
    if (this.isRedirecting) {
      return;
    }

    // A prior strip loop for this flag was detected this session; stay put.
    if (this.isRedirectSuppressed(flagKey)) {
      return;
    }

    if (!this.isActionActiveOnPage(flagKey, action?.data?.metadata?.scope)) {
      return;
    }

    const redirectUrl = action?.data?.url;

    let targetUrl = concatenateQueryParamsOf(
      this.globalScope.location.href,
      redirectUrl,
    );

    // Destination guard: already at the target, nothing to do. The hash counts
    // only when the redirect names one — hash-router sites route on it, while a
    // redirect that ignores the hash must not treat an in-page anchor as a
    // different destination and bounce the user back to the top of the page.
    if (this.isAtDestination(targetUrl)) {
      return;
    }

    // Soft-nav channel of the stick-detector: a pending marker that puts us back
    // at the source with the redirect's params gone, and no user interaction
    // since (interaction clears markers), means the app moved us here itself.
    // Re-firing would loop, so suppress this flag for the session.
    const marker = this.getRedirectMarkers()[flagKey];
    if (
      marker &&
      this.markerBackAtSource(this.globalScope.location.href, marker)
    ) {
      this.suppressRedirect(
        flagKey,
        `channel=soft from=${marker.from} to=${marker.target}`,
      );
      this.clearRedirectMarker(flagKey);
      return;
    }

    // Clean target before the AMP_REDIRECT param is layered on; the marker's
    // loop predicate keys off the redirect's real params, not the impression blob.
    const cleanTarget = targetUrl;

    // Commit before any await so a re-entrant evaluation cannot start another
    // redirect while impressions / cookies are being written.
    this.isRedirecting = true;

    const isCrossSubdomain = (() => {
      try {
        return (
          new URL(targetUrl).hostname !== this.globalScope.location.hostname
        );
      } catch {
        return false;
      }
    })();

    await this.storeRedirectImpressions(
      flagKey,
      variant,
      redirectUrl,
      isCrossSubdomain,
    );

    // While consent is pending the sessionStorage/cookie copies written above
    // are buffered in memory and die with this page, so the URL param is the
    // only transport that survives the navigation (and it stores nothing on
    // the device). Pending-only: after a mid-session revocation the redirect
    // impression is dropped, like every other post-denial event.
    if (
      (this.config.redirectConfig?.encodeRedirectInUrl && isCrossSubdomain) ||
      isConsentPending()
    ) {
      // Embed impression data in redirect URL for cross-domain and
      // cookie-blocked environments. Merge with any existing param in case
      // multiple redirect experiments fire in sequence.
      const targetUrlObj = new URL(targetUrl);
      let urlPayload: Record<string, StoredRedirectImpression> = {};
      const existingEncoded = targetUrlObj.searchParams.get(
        REDIRECT_IMPRESSION_PARAM,
      );
      if (existingEncoded) {
        try {
          urlPayload = JSON.parse(atob(existingEncoded));
        } catch (error) {
          console.error('Failed to decode existing AMP_REDIRECT param:', error);
        }
      }
      urlPayload[flagKey] = {
        redirectUrl,
        variantKey: variant.key || '',
        ...(variant.expKey !== undefined ? { expKey: variant.expKey } : {}),
        ...(variant.metadata !== undefined
          ? { metadata: variant.metadata }
          : {}),
      };
      targetUrlObj.searchParams.set(
        REDIRECT_IMPRESSION_PARAM,
        btoa(JSON.stringify(urlPayload)),
      );
      targetUrl = targetUrlObj.toString();
    }

    // Record the marker just before navigating: source, clean target, and the
    // query keys the redirect added. The stick-detector reads these on the next
    // evaluation (soft nav) or the next document load (hard nav).
    const from = this.globalScope.location.href;
    this.writeRedirectMarker(flagKey, {
      from,
      target: cleanTarget,
      distinguishingParams: distinguishingParams(from, cleanTarget),
      landed: false,
    });

    // set previous url - relevant for SPA if redirect happens before push/replaceState is complete
    this.previousUrl = from;
    try {
      setMarketingCookie(this.apiKey, this.globalScope.location.hostname);
      // perform redirection
      if (this.customRedirectHandler) {
        this.customRedirectHandler(targetUrl);
        return;
      }
      this.globalScope.location.replace(targetUrl);
    } catch (error) {
      // Navigation never started, so the marker would read as a loop on the
      // next evaluation and suppress the flag for the rest of the session.
      this.clearRedirectMarker(flagKey);
      this.isRedirecting = false;
      throw error;
    }
  }

  private isAtDestination(targetUrl: string): boolean {
    const currentUrl = this.globalScope.location.href;
    if (currentUrl === targetUrl) {
      return true;
    }
    try {
      if (new URL(targetUrl).hash) {
        return false;
      }
    } catch {
      return false;
    }
    return urlWithoutHash(currentUrl) === urlWithoutHash(targetUrl);
  }

  private redirectMarkerStorageKey(): string {
    return `EXP_${this.apiKey.slice(0, 10)}_REDIRECT_MARKER`;
  }

  private redirectSuppressStorageKey(): string {
    return `EXP_${this.apiKey.slice(0, 10)}_REDIRECT_SUPPRESSED`;
  }

  private getRedirectMarkers(): Record<string, RedirectMarker> {
    return (
      getStorageItem<Record<string, RedirectMarker>>(
        'sessionStorage',
        this.redirectMarkerStorageKey(),
      ) || {}
    );
  }

  private writeRedirectMarker(flagKey: string, marker: RedirectMarker): void {
    const markers = this.getRedirectMarkers();
    markers[flagKey] = marker;
    setStorageItem('sessionStorage', this.redirectMarkerStorageKey(), markers);
  }

  private clearRedirectMarker(flagKey: string): void {
    const markers = this.getRedirectMarkers();
    if (flagKey in markers) {
      delete markers[flagKey];
      setStorageItem(
        'sessionStorage',
        this.redirectMarkerStorageKey(),
        markers,
      );
    }
  }

  private isRedirectSuppressed(flagKey: string): boolean {
    const suppressed =
      getStorageItem<string[]>(
        'sessionStorage',
        this.redirectSuppressStorageKey(),
      ) || [];
    return suppressed.includes(flagKey);
  }

  private suppressRedirect(flagKey: string, reason: string): void {
    const suppressed =
      getStorageItem<string[]>(
        'sessionStorage',
        this.redirectSuppressStorageKey(),
      ) || [];
    if (!suppressed.includes(flagKey)) {
      suppressed.push(flagKey);
      setStorageItem(
        'sessionStorage',
        this.redirectSuppressStorageKey(),
        suppressed,
      );
    }
    const detail = `flag=${flagKey} ${reason}`;
    console.warn(
      `[Experiment] redirect loop detected, suppressing for session: ${detail}`,
    );
    DebugRecorder.push('redirect_loop_detected', detail);
  }

  /**
   * Current URL is the redirect's target with its distinguishing params intact.
   * Path+hash compared exactly (hash-aware, matching the destination guard);
   * extra params the destination or SDK adds — e.g. `AMP_REDIRECT` — are ignored,
   * only the params the redirect itself contributed must still be present.
   */
  private markerMatchesTarget(
    current: string,
    marker: RedirectMarker,
  ): boolean {
    try {
      if (urlWithoutQuery(current) !== urlWithoutQuery(marker.target)) {
        return false;
      }
      const currentParams = new URL(current).searchParams;
      const targetParams = new URL(marker.target).searchParams;
      return marker.distinguishingParams.every(
        (key) => currentParams.get(key) === targetParams.get(key),
      );
    } catch {
      return false;
    }
  }

  /**
   * Current URL is back at the source (path+hash) with a distinguishing param
   * dropped. Path+hash compared exactly so a hash-router route change is not
   * mistaken for a return to the source.
   */
  private markerBackAtSource(current: string, marker: RedirectMarker): boolean {
    try {
      if (urlWithoutQuery(current) !== urlWithoutQuery(marker.from)) {
        return false;
      }
      if (marker.distinguishingParams.length === 0) {
        return true;
      }
      const currentParams = new URL(current).searchParams;
      const targetParams = new URL(marker.target).searchParams;
      return marker.distinguishingParams.some(
        (key) => currentParams.get(key) !== targetParams.get(key),
      );
    } catch {
      return false;
    }
  }

  /**
   * Hard-nav channel of the stick-detector, run once per document load before
   * variants apply. A redirect uses a full navigation; a user cannot act between
   * `location.replace(target)` and its landing, so what the fresh document shows
   * is deterministic:
   * - at the target → the redirect stuck; mark it landed and keep the marker so
   *   this document's soft-nav channel can still catch a later client-side strip.
   *   If it was already landed, this is a user revisiting the target — drop it.
   * - back at the source without ever having landed → the navigation to target
   *   was rewritten (server 302 / redirect chain); suppress the flag this session.
   * - back at the source after having landed → the user left the target and
   *   returned; not a strip, drop it.
   */
  private reconcileRedirectMarkersOnLoad(): void {
    const markers = this.getRedirectMarkers();
    if (Object.keys(markers).length === 0) {
      return;
    }
    const current = this.globalScope.location.href;
    for (const flagKey of Object.keys(markers)) {
      const marker = markers[flagKey];
      if (this.markerMatchesTarget(current, marker)) {
        if (marker.landed) {
          delete markers[flagKey];
        } else {
          marker.landed = true;
        }
      } else if (this.markerBackAtSource(current, marker)) {
        if (!marker.landed) {
          this.suppressRedirect(
            flagKey,
            `channel=hard from=${marker.from} to=${marker.target}`,
          );
        }
        delete markers[flagKey];
      } else {
        delete markers[flagKey];
      }
    }
    setStorageItem('sessionStorage', this.redirectMarkerStorageKey(), markers);
  }

  /**
   * The interaction boundary. A user cannot call `replaceState`; anything they do
   * to leave a page is a pointer/key/history event first. Observing one means a
   * person is driving, so pending markers are cleared and no later navigation is
   * mistaken for a strip loop. Captured + passive so it never interferes.
   */
  private setupRedirectInteractionReset(): void {
    if (typeof this.globalScope?.addEventListener !== 'function') {
      return;
    }
    const clearMarkers = () =>
      setStorageItem('sessionStorage', this.redirectMarkerStorageKey(), {});
    for (const event of USER_INTERACTION_EVENTS) {
      this.globalScope.addEventListener(event, clearMarkers, {
        capture: true,
        passive: true,
      });
    }
  }

  private handleMutate(action, flagKey: string, variant: Variant) {
    const mutations = action.data?.mutations || [];
    const variantKey = variant.key || '';

    if (mutations.length === 0) {
      return;
    }

    const mutationControllers: Record<number, MutationController> = {};

    mutations.forEach((m, index) => {
      // Check if mutation is scoped to page
      if (!this.isActionActiveOnPage(flagKey, m?.metadata?.scope)) {
        // Revert and delete the mutation if it exists
        if (
          this.appliedMutations[flagKey]?.[variantKey]?.[MUTATE_ACTION]?.[index]
        ) {
          this.appliedMutations[flagKey]?.[variantKey]?.[MUTATE_ACTION]?.[
            index
          ]?.revert();
          delete this.appliedMutations[flagKey][variantKey][MUTATE_ACTION][
            index
          ];
        }
      } else {
        // always track exposure if mutation is active
        this.exposureWithDedupe(flagKey, variant);
        // Check if mutation has already been applied
        if (
          !this.appliedMutations[flagKey]?.[variantKey]?.[MUTATE_ACTION]?.[
            index
          ]
        ) {
          // Apply mutation
          mutationControllers[index] = mutate.declarative(m);
        }
      }
    });

    this.appliedMutations[flagKey] ??= {};
    this.appliedMutations[flagKey][variantKey] ??= {};
    // Merge instead of overwriting if there are existing mutations
    this.appliedMutations[flagKey][variantKey][MUTATE_ACTION] = {
      ...this.appliedMutations[flagKey][variantKey][MUTATE_ACTION],
      ...mutationControllers,
    };

    // Delete empty objects safely
    if (
      Object.keys(
        this.appliedMutations[flagKey][variantKey][MUTATE_ACTION] || {},
      ).length === 0
    ) {
      delete this.appliedMutations[flagKey][variantKey][MUTATE_ACTION];
    }
    if (
      Object.keys(this.appliedMutations[flagKey][variantKey] || {}).length === 0
    ) {
      delete this.appliedMutations[flagKey];
    }
  }

  private handleInject(action, flagKey: string, variant: Variant) {
    const variantKey = variant.key || '';

    if (!this.isActionActiveOnPage(flagKey, action?.data?.scope)) {
      this.appliedMutations[flagKey]?.[variantKey]?.[
        INJECT_ACTION
      ]?.[0]?.revert();
      return;
    }
    // Validate and transform ID
    const rawId = action.data.id;
    if (!rawId || typeof rawId !== 'string' || rawId.length === 0) {
      return;
    }
    // Replace the `-` characters in the UUID to support function name
    const id = rawId.replace(/-/g, '');
    // Check for repeat invocations
    if (this.appliedInjections.has(id)) {
      return;
    }
    // Create JS
    const rawJs = action.data.js;
    let script: HTMLScriptElement | undefined;
    if (rawJs) {
      script = this.globalScope.document.createElement('script');
      if (script) {
        // rawJs is variant JS source embedded verbatim; not a template interpolation value
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- injected script body
        const source = `function ${id}(html, utils, id){${rawJs}};`;
        script.textContent = source;
        script.id = `js-${id}`;
        this.globalScope.document.head.appendChild(script);
      }
    }
    // Adopt CSS as a constructable stylesheet (CSP-safe; works on strict
    // style-src customer pages where <style> elements would be blocked)
    const rawCss = action.data.css;
    let sheetHandle: StyleSheetHandle | undefined;
    if (rawCss) {
      sheetHandle = cspSafeStyleSheet(this.globalScope.document, rawCss);
    }
    // Create HTML
    const rawHtml = action.data.html;
    let html: Element | undefined;
    if (rawHtml) {
      html =
        new DOMParser().parseFromString(rawHtml, 'text/html').body
          .firstElementChild ?? undefined;
    }
    // Inject
    const state = { cancelled: false }; // individual state per injection
    const utils = getInjectUtils(state);
    this.appliedInjections.add(id);
    try {
      const fn = this.globalScope[id];
      if (fn && typeof fn === 'function') {
        fn(html, utils, id);
      }
    } catch (e) {
      script?.remove();
      console.error(
        `Experiment inject failed for ${flagKey} variant ${
          variant.key ?? ''
        }. Reason:`,
        e,
      );
    }
    // Push mutation to remove CSS and any custom state cleanup set in utils.
    this.appliedMutations[flagKey] ??= {};
    this.appliedMutations[flagKey][variantKey] ??= {};
    this.appliedMutations[flagKey][variantKey][INJECT_ACTION] ??= {};

    // Push the mutation
    this.appliedMutations[flagKey][variantKey][INJECT_ACTION][id] = {
      revert: () => {
        state.cancelled = true;
        utils.remove?.();
        sheetHandle?.revert();
        script?.remove();
        this.appliedInjections.delete(id);
      },
    };
    this.exposureWithDedupe(flagKey, variant);
  }

  private exposureWithDedupe(
    key: string,
    variant: Variant,
    forceVariant?: boolean,
  ) {
    const currentUrl = urlWithoutParamsAndAnchor(
      this.globalScope.location.href,
    );

    // if on the same base URL, only track exposure if variant has changed or has not been tracked
    const hasTrackedVariant =
      this.urlExposureCache?.[currentUrl]?.[key] === variant.key;

    if (!hasTrackedVariant) {
      if (forceVariant || !!this.previewFlags[key]) {
        const variantAndSource = {
          variant: variant,
          source: 'local-evaluation',
          hasDefaultVariant: false,
        };
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.experimentClient.exposureInternal(key, variantAndSource);
      } else {
        this.experimentClient.exposure(key);
      }
      (this.urlExposureCache[currentUrl] ??= {})[key] = variant.key;
    }
  }

  // Also used by chrome extension
  updateActivePages(flagKey: string, page: PageObject, isActive: boolean) {
    if (!this.activePages[flagKey]) {
      this.activePages[flagKey] = {};
    }
    if (isActive) {
      this.activePages[flagKey][page.id] = page;
    } else {
      delete this.activePages[flagKey][page.id];
      if (Object.keys(this.activePages[flagKey]).length === 0) {
        delete this.activePages[flagKey];
      }
    }
  }

  private isActionActiveOnPage(
    flagKey: string,
    scope: string[] | undefined,
  ): boolean {
    const flagPages = this.activePages[flagKey];

    // If no scope is provided, assume variant is active if the flag has any active pages
    if (!scope) {
      return !!flagPages && Object.values(flagPages).some(Boolean);
    }

    // If scope is provided, check if any scoped page is active
    return scope.some((pageId) => flagPages?.[pageId] ?? false);
  }

  private async storeRedirectImpressions(
    flagKey: string,
    variant: Variant,
    redirectUrl: string,
    isCrossSubdomain: boolean,
  ) {
    const storageKey = `EXP_${this.apiKey.slice(0, 10)}_REDIRECT`;
    const impression: StoredRedirectImpression = {
      redirectUrl,
      variantKey: variant.key || '',
      ...(variant.expKey !== undefined ? { expKey: variant.expKey } : {}),
      ...(variant.metadata !== undefined ? { metadata: variant.metadata } : {}),
    };

    // Always write to sessionStorage
    const stored =
      getStorageItem<Record<string, StoredRedirectImpression>>(
        'sessionStorage',
        storageKey,
      ) || {};
    stored[flagKey] = impression;
    setStorageItem('sessionStorage', storageKey, stored);

    // Also write to cookie when opted in and redirect crosses subdomains
    if (
      this.config.redirectConfig?.encodeRedirectInCookie &&
      isCrossSubdomain
    ) {
      const storage = createCookieStorage<
        Record<string, StoredRedirectImpression>
      >(() => {
        const domain = getTopLevelDomainSync(
          this.globalScope.location.hostname,
        );
        return {
          ...(domain && { domain }),
          sameSite: 'Lax',
          expirationDays: 1 / 1440, // 1 minute
        };
      });

      try {
        const redirects = storage.get(storageKey) || {};
        redirects[flagKey] = impression;
        storage.set(storageKey, redirects);
      } catch (error) {
        console.error(
          `Failed to store redirect impression in cookie for ${flagKey}:`,
          error,
        );
      }
    }
  }

  private consumeRedirectParamFromUrl(urlParams: Record<string, string>): void {
    const encoded = urlParams[REDIRECT_IMPRESSION_PARAM];
    if (!encoded) {
      return;
    }
    if (
      !this.config.redirectConfig?.encodeRedirectInUrl &&
      !consentGate.required
    ) {
      return;
    }
    try {
      this.preloadedUrlRedirectImpressions = JSON.parse(atob(encoded));
    } catch {
      this.preloadedUrlRedirectImpressions = {};
    }
    const cleanedUrl = removeQueryParams(this.globalScope.location.href, [
      REDIRECT_IMPRESSION_PARAM,
    ]);
    this.subscriptionManager?.markUrlAsPublished(cleanedUrl);
    this.globalScope.history.replaceState({}, '', cleanedUrl);
  }

  private fireStoredRedirectImpressions() {
    const storageKey = `EXP_${this.apiKey.slice(0, 10)}_REDIRECT`;

    // Read URL param impressions (highest priority). A pending source page
    // forces the URL transport (see handleRedirect), so a consent-gated
    // destination must consume the param — and clean the URL — even when the
    // customer never opted into encodeRedirectInUrl. When start() already
    // consumed the param for page targeting, use that snapshot here.
    let urlImpressions: Record<string, StoredRedirectImpression> =
      this.preloadedUrlRedirectImpressions ?? {};
    this.preloadedUrlRedirectImpressions = null;
    if (
      Object.keys(urlImpressions).length === 0 &&
      (this.config.redirectConfig?.encodeRedirectInUrl || consentGate.required)
    ) {
      const urlParams = getUrlParams();
      const encoded = urlParams[REDIRECT_IMPRESSION_PARAM];
      if (encoded) {
        try {
          urlImpressions = JSON.parse(atob(encoded));
        } catch {} // eslint-disable-line no-empty
        const cleanedUrl = removeQueryParams(this.globalScope.location.href, [
          REDIRECT_IMPRESSION_PARAM,
        ]);
        // Pre-register the cleaned URL so the replaceState wrapper doesn't
        // publish a spurious url_change (which would reset urlExposureCache
        // and cause duplicate impression events).
        this.subscriptionManager?.markUrlAsPublished(cleanedUrl);
        this.globalScope.history.replaceState({}, '', cleanedUrl);
      }
    }

    // Read sessionStorage impressions
    const sessionImpressions =
      getStorageItem<Record<string, StoredRedirectImpression>>(
        'sessionStorage',
        storageKey,
      ) || {};

    // Read cookie impressions (lowest priority) when opted in
    let cookieImpressions: Record<string, StoredRedirectImpression> = {};
    let cookieStorage:
      | SyncCookieStore<Record<string, StoredRedirectImpression>>
      | undefined;
    if (this.config.redirectConfig?.encodeRedirectInCookie) {
      cookieStorage = createCookieStorage<
        Record<string, StoredRedirectImpression>
      >(() => {
        const domain = getTopLevelDomainSync(
          this.globalScope.location.hostname,
        );
        return {
          ...(domain && { domain }),
          sameSite: 'Lax',
        };
      });
      try {
        cookieImpressions = cookieStorage.get(storageKey) || {};
      } catch (error) {
        console.error(
          `Failed to retrieve redirect impressions from cookie ${storageKey}:`,
          error,
        );
      }
    }

    // Merge with priority: url > session > cookie
    const merged: Record<string, StoredRedirectImpression> = {
      ...cookieImpressions,
      ...sessionImpressions,
      ...urlImpressions,
    };

    if (Object.keys(merged).length === 0) {
      return;
    }

    const currentUrl = urlWithoutParamsAndAnchor(
      this.globalScope.location.href,
    );

    for (const flagKey in merged) {
      const { redirectUrl, variantKey, expKey, metadata } = merged[flagKey];
      if (matchesUrl([currentUrl], urlWithoutParamsAndAnchor(redirectUrl))) {
        this.exposureWithDedupe(
          flagKey,
          { key: variantKey, expKey, metadata },
          true,
        );
        delete merged[flagKey];
      }
    }

    const cleanup = () => {
      removeStorageItem('sessionStorage', storageKey);
      if (cookieStorage) {
        try {
          cookieStorage.remove(storageKey);
        } catch (error) {
          console.error(
            `Failed to remove redirect impressions from cookie ${storageKey}:`,
            error,
          );
        }
      }
    };

    if (Object.keys(merged).length > 0) {
      this.globalScope.setTimeout(() => {
        for (const flagKey in merged) {
          const { variantKey, expKey, metadata } = merged[flagKey];
          this.exposureWithDedupe(
            flagKey,
            { key: variantKey, expKey, metadata },
            true,
          );
        }
        cleanup();
      }, 500);
    } else {
      cleanup();
    }
  }

  private setupPreviewMode(urlParams: Record<string, string>) {
    // explicit URL params takes precedence over session storage
    if (urlParams[PREVIEW_MODE_PARAM] === 'true') {
      Object.keys(urlParams).forEach((key) => {
        if (key !== PREVIEW_MODE_PARAM && urlParams[key]) {
          this.previewFlags[key] = urlParams[key];
        }
      });

      setStorageItem('sessionStorage', PREVIEW_MODE_SESSION_KEY, {
        previewFlags: this.previewFlags,
      });
      const previewParamsToRemove = [
        ...Object.keys(this.previewFlags),
        PREVIEW_MODE_PARAM,
      ];
      this.globalScope.history.replaceState(
        {},
        '',
        removeQueryParams(
          this.globalScope.location.href,
          previewParamsToRemove,
        ),
      );
      // if in preview mode, listen for ForceVariant messages
      WindowMessenger.setup();
    } else {
      const previewState: PreviewState | null = getStorageItem(
        'sessionStorage',
        PREVIEW_MODE_SESSION_KEY,
      );
      if (previewState) {
        this.previewFlags = previewState.previewFlags;
      }
    }

    if (Object.keys(this.previewFlags).length > 0) {
      this.isPreviewMode = true;
    } else {
      return;
    }
  }
}
