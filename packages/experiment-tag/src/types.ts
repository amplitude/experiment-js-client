import { EvaluationCondition } from '@amplitude/experiment-core';
import {
  ExperimentConfig,
  ExperimentUser,
  ExperimentClient,
  Variants,
} from '@amplitude/experiment-js-client';

import { BehavioralTargeting } from './behavioral-targeting';
import { MessageType } from './subscriptions/message-bus';
import type { DebugState } from './types/debug';

export type ApplyVariantsOptions = {
  /**
   * A list of flag keys to apply.
   */
  flagKeys?: string[];
};

export type RevertVariantsOptions = {
  /**
   * A list of flag keys to revert.
   */
  flagKeys?: string[];
};

export type PreviewVariantsOptions = {
  /**
   * A map of flag keys to variant keys to be previewed.
   */
  keyToVariant?: Record<string, string>;
};

export type PreviewState = {
  previewFlags: Record<string, string>;
};

export interface ElementAppearedTriggerValue {
  selector: string;
}

export interface ElementVisibleTriggerValue {
  selector: string;
  visibilityRatio?: number;
}

export interface ManualTriggerValue {
  name: string;
}

export type UserInteractionType = 'click' | 'hover' | 'focus';

export interface UserInteractionTriggerValue {
  selector: string;
  interactionType: UserInteractionType;
  minThresholdMs?: number;
}

export interface ExitIntentTriggerValue {
  minTimeOnPageMs?: number;
}

export interface TimeOnPageTriggerValue {
  durationMs: number;
}

export interface ScrolledToElementConfig {
  mode: 'element';
  selector: string;
  offsetPx?: number;
}

export interface ScrolledToPercentConfig {
  mode: 'percent';
  percentage: number;
}

export type ScrolledToTriggerValue =
  | ScrolledToElementConfig
  | ScrolledToPercentConfig;

export type AnalyticsEventTriggerValue = EvaluationCondition[][];

export type PageObject = {
  id: string;
  name: string;
  conditions?: EvaluationCondition[][];
  trigger_type: MessageType;
  trigger_value:
    | ElementAppearedTriggerValue
    | ElementVisibleTriggerValue
    | ManualTriggerValue
    | TimeOnPageTriggerValue
    | UserInteractionTriggerValue
    | ExitIntentTriggerValue
    | ScrolledToTriggerValue
    | AnalyticsEventTriggerValue;
};

export type PageObjects = { [flagKey: string]: { [id: string]: PageObject } };

/**
 * Map of behavioral targeting rules per flag key.
 * Each flag has ONE outer OR array for behavioral targeting.
 */
export type BehavioralTargetingRules = {
  [flagKey: string]: { [id: string]: BehavioralTargeting };
};

export interface RedirectConfig {
  /**
   * When true, redirect impression data is stored in a cookie scoped to the root domain,
   * enabling impression tracking across subdomains.
   */
  encodeRedirectInCookie?: boolean;
  /**
   * When true, redirect impression data is base64-encoded as an AMP_REDIRECT query
   * parameter on the destination URL, enabling tracking in cross-domain redirects
   * and cookie-blocked environments.
   */
  encodeRedirectInUrl?: boolean;
}

export type ConsentStatus = 'granted' | 'pending' | 'denied';

export interface ConsentOptions {
  /**
   * When true, the script does not start until consent status is 'granted'.
   * Default false — the consent feature is fully off and behavior is unchanged.
   */
  consentRequired?: boolean;
  /**
   * Initial consent status, set before the script loads. Defaults to
   * 'pending' when consentRequired is true. Values follow Google Consent
   * Mode: 'granted' | 'denied' | 'pending'.
   *
   * A later 'granted' at runtime (via `setConsentStatus`) starts the script —
   * including after 'denied' (the preference-center re-opt-in flow).
   */
  consentStatus?: ConsentStatus;
}

export interface WebExperimentConfig extends ExperimentConfig {
  /**
   * Determines whether the default implementation for handling navigation  will be used
   * If this is set to false, for single-page applications:
   * 1. The variant actions applied will be based on the context (user, page URL) when the web experiment script was loaded
   * 2. Custom handling of navigation {@link setRedirectHandler} should be implemented such that variant actions applied on the site reflect the latest context
   */
  useDefaultNavigationHandler?: boolean;
  redirectConfig?: RedirectConfig;
  /**
   * Rolling inactivity timeout, in milliseconds, after which the behavioral
   * targeting (RTBT) session rotates. Mirrors Amplitude Analytics' session
   * model. Defaults to 30 minutes when unset.
   */
  rtbtSessionTimeout?: number;
  /**
   * Overrides the origin the cross-subdomain RTBT relay iframe is loaded from.
   * Provide a scheme + host (+ optional port), e.g. `https://relay.lvh.me:3036`;
   * the canonical `/script/{apiKey}.relay.html` path is appended automatically.
   * When unset, the relay loads from the Amplitude CDN for the configured server
   * zone. Intended for local/staging testing of the relay serving path.
   */
  relayUrl?: string;
  /**
   * Cookie-consent gating for the web experiment script. When
   * `consentRequired` is true, the script does not start (no storage access,
   * evaluation, variant application, tracking, or relay) until the status is
   * 'granted'. Update status at runtime with
   * `window.webExperiment.setConsentStatus(status)`.
   *
   * `pending` and `denied` defer the start. `granted` starts the client,
   * including after `denied` (preference-center re-opt-in). Analytics events
   * that arrive while the start is deferred are not kept for replay after
   * grant. After the client has started, a later `denied` does not tear down
   * an in-flight start; reload the page to reset.
   */
  consentOptions?: ConsentOptions;
}

export const Defaults: WebExperimentConfig = {
  useDefaultNavigationHandler: true,
  redirectConfig: {
    encodeRedirectInUrl: false,
    encodeRedirectInCookie: true,
  },
};

/**
 * Interface for the Web Experiment client.
 */

export interface WebExperimentClient {
  start(): Promise<void>;

  getExperimentClient(): ExperimentClient;

  applyVariants(options?: ApplyVariantsOptions): void;

  revertVariants(options?: RevertVariantsOptions): void;

  previewVariants(options: PreviewVariantsOptions): void;

  getVariants(): Variants;

  getActiveExperiments(): string[];

  getActivePages(): PageObjects;

  setRedirectHandler(handler: (url: string) => void): void;

  toggleManualPageObject(name: string, isActive?: boolean): void;

  getDebugState(): DebugState;

  addDebugStateSubscriber(
    callback: (state: DebugState) => void,
  ): (() => void) | undefined;

  /**
   * Updates cookie-consent status (also on the pre-init stub). See
   * {@link WebExperimentConfig.consentOptions}.
   */
  setConsentStatus(status: ConsentStatus): void;
}

export type WebExperimentUser = {
  web_exp_id?: string;
  web_exp_id_v2?: string;
} & ExperimentUser;

export type InitConfigs = {
  initialFlags: string;
  pageObjects: string;
  behavioralTargetingRules?: string;
};
