import { AnalyticsConnector } from '@amplitude/analytics-connector';
import {
  EvaluationFlag,
  EvaluationSegment,
  getGlobalScope,
  isLocalStorageAvailable,
  safeGlobal,
} from '@amplitude/experiment-core';
import {
  Experiment,
  Variant,
  AmplitudeIntegrationPlugin,
  ExperimentClient,
  Variants,
} from '@amplitude/experiment-js-client';
import * as FeatureExperiment from '@amplitude/experiment-js-client';
import mutate, { MutationController } from 'dom-mutator';

import { Defaults, WebExperimentConfig } from './config';
import { getInjectUtils } from './inject-utils';
import { WindowMessenger } from './messenger';
import {
  ApplyVariantsOptions,
  PreviewVariantsOptions,
  RevertVariantsOptions,
} from './types';
import {
  convertEvaluationVariantToVariant,
  getUrlParams,
  removeQueryParams,
  urlWithoutParamsAndAnchor,
  UUID,
  concatenateQueryParamsOf,
} from './util';
import { WebExperimentClient } from './web-experiment';

export const PAGE_NOT_TARGETED_SEGMENT_NAME = 'Page not targeted';
export const PAGE_IS_EXCLUDED_SEGMENT_NAME = 'Page is excluded';
export const PREVIEW_SEGMENT_NAME = 'Preview';

safeGlobal.Experiment = FeatureExperiment;

export class DefaultWebExperimentClient implements WebExperimentClient {
  private readonly apiKey: string;
  private readonly initialFlags: [];
  private readonly config: WebExperimentConfig;
  private readonly globalScope: typeof globalThis;
  private readonly experimentClient: ExperimentClient;
  private appliedInjections: Set<string> = new Set();
  private appliedMutations: Record<string, MutationController[]> = {};
  private previousUrl: string | undefined = undefined;
  // Cache to track exposure for the current URL, should be cleared on URL change
  private urlExposureCache: Record<string, Record<string, string | undefined>> =
    {};
  private flagVariantMap: Record<string, Record<string, Variant>> = {};
  private localFlagKeys: string[] = [];
  private remoteFlagKeys: string[] = [];
  private isRemoteBlocking = false;
  private customRedirectHandler: ((url: string) => void) | undefined;
  private isRunning = false;

  constructor(
    apiKey: string,
    initialFlags: string,
    config: WebExperimentConfig = {},
  ) {
    const globalScope = getGlobalScope();
    if (!globalScope || !isLocalStorageAvailable()) {
      throw new Error(
        'Amplitude Web Experiment Client could not be initialized.',
      );
    }
    this.globalScope = globalScope;
    this.apiKey = apiKey;
    this.initialFlags = JSON.parse(initialFlags);
    // merge config with defaults and experimentConfig (if provided)
    this.config = {
      ...Defaults,
      ...config,
      ...(this.globalScope.experimentConfig ?? {}),
    };

    const urlParams = getUrlParams();

    this.initialFlags.forEach((flag: EvaluationFlag) => {
      const { key, variants, segments, metadata = {} } = flag;

      this.flagVariantMap[key] = {};
      Object.keys(variants).forEach((variantKey) => {
        this.flagVariantMap[key][variantKey] =
          convertEvaluationVariantToVariant(variants[variantKey]);
      });

      // Update initialFlags to force variant if in preview mode
      if (
        urlParams['PREVIEW'] &&
        key in urlParams &&
        urlParams[key] in variants
      ) {
        // Remove preview-related query parameters from the URL
        this.globalScope.history.replaceState(
          {},
          '',
          removeQueryParams(this.globalScope.location.href, ['PREVIEW', key]),
        );

        // Retain only page-targeting segments
        const pageTargetingSegments = segments.filter(
          this.isPageTargetingSegment,
        );

        // Add or update the preview segment
        const previewSegment = {
          metadata: { segmentName: PREVIEW_SEGMENT_NAME },
          variant: urlParams[key],
        };

        // Update the flag's segments to include the preview segment
        flag.segments = [...pageTargetingSegments, previewSegment];

        // make all preview flags local
        metadata.evaluationMode = 'local';
      }

      if (metadata.evaluationMode !== 'local') {
        this.remoteFlagKeys.push(key);
      }

      flag.metadata = metadata;
    });

    const initialFlagsString = JSON.stringify(this.initialFlags);

    // initialize the experiment
    this.experimentClient = Experiment.initialize(this.apiKey, {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      internalInstanceNameSuffix: 'web',
      initialFlags: initialFlagsString,
      // timeout for fetching remote flags
      fetchTimeoutMillis: 1000,
      pollOnStart: false,
      fetchOnStart: false,
      automaticExposureTracking: false,
      ...this.config,
    });
    // Get all the locally available flag keys from the SDK.
    const variants = this.experimentClient.all();
    this.localFlagKeys = Object.keys(variants).filter(
      (key) => variants[key]?.metadata?.evaluationMode === 'local',
    );
  }

  /**
   * Start the web experiment client.
   */
  public async start() {
    if (this.isRunning) {
      return;
    }
    const urlParams = getUrlParams();

    // if in visual edit mode, remove the query param
    if (urlParams['VISUAL_EDITOR']) {
      WindowMessenger.setup();
      this.globalScope.history.replaceState(
        {},
        '',
        removeQueryParams(this.globalScope.location.href, ['VISUAL_EDITOR']),
      );
      return;
    }

    const experimentStorageName = `EXP_${this.apiKey.slice(0, 10)}`;
    let user;
    try {
      user = JSON.parse(
        this.globalScope.localStorage.getItem(experimentStorageName) || '{}',
      );
    } catch (error) {
      user = {};
    }

    // if web_exp_id does not exist:
    // 1. if device_id exists, migrate device_id to web_exp_id and remove device_id
    // 2. if device_id does not exist, create a new web_exp_id
    // 3. if both device_id and web_exp_id exist, remove device_id
    if (!user.web_exp_id) {
      user.web_exp_id = user.device_id || UUID();
      delete user.device_id;
      this.globalScope.localStorage.setItem(
        experimentStorageName,
        JSON.stringify(user),
      );
    } else if (user.web_exp_id && user.device_id) {
      delete user.device_id;
      this.globalScope.localStorage.setItem(
        experimentStorageName,
        JSON.stringify(user),
      );
    }

    // evaluate variants for page targeting
    const variants: Variants = this.getVariants();

    for (const [key, variant] of Object.entries(variants)) {
      // only apply anti-flicker for remote flags active on the page
      if (
        this.remoteFlagKeys.includes(key) &&
        variant.metadata?.blockingEvaluation &&
        variant.metadata?.segmentName !== PAGE_NOT_TARGETED_SEGMENT_NAME &&
        variant.metadata?.segmentName !== PAGE_IS_EXCLUDED_SEGMENT_NAME
      ) {
        this.isRemoteBlocking = true;
        // Apply anti-flicker CSS to prevent UI flicker
        this.applyAntiFlickerCss();
      }
    }

    // If no integration has been set, use an Amplitude integration.
    if (!this.globalScope.experimentIntegration) {
      const connector = AnalyticsConnector.getInstance('$default_instance');
      this.globalScope.experimentIntegration = new AmplitudeIntegrationPlugin(
        this.apiKey,
        connector,
        100,
      );
    }
    this.globalScope.experimentIntegration.type = 'integration';
    this.experimentClient.addPlugin(this.globalScope.experimentIntegration);
    this.experimentClient.setUser(user);

    if (this.config.useDefaultNavigationHandler) {
      this.setDefaultNavigationHandler([
        ...this.localFlagKeys,
        ...this.remoteFlagKeys,
      ]);
    }

    // apply local variants
    this.applyVariants({ flagKeys: this.localFlagKeys });

    if (!this.isRemoteBlocking) {
      // Remove anti-flicker css if remote flags are not blocking
      this.globalScope.document.getElementById?.('amp-exp-css')?.remove();
    }

    if (this.remoteFlagKeys.length === 0) {
      this.isRunning = true;
      return;
    }

    await this.fetchRemoteFlags();
    // apply remote variants - if fetch is unsuccessful, fallback order: 1. localStorage flags, 2. initial flags
    this.applyVariants({ flagKeys: this.remoteFlagKeys });
    this.isRunning = true;
  }

  /**
   * Get singleton of the {@link DefaultWebExperimentClient} if it has already been initialized.
   * If not, initialize the client and return the instance.
   * @param apiKey
   * @param initialFlags
   * @param config
   */
  static getInstance(
    apiKey: string,
    initialFlags: string,
    config: WebExperimentConfig = {},
  ): DefaultWebExperimentClient {
    const globalScope = getGlobalScope();
    if (!globalScope) {
      throw new Error(
        'Amplitude Web Experiment Client could not be initialized.',
      );
    }
    // if the client has already been initialized, return the existing instance
    if (globalScope?.webExperiment) {
      return globalScope.webExperiment;
    }
    const webExperiment = new DefaultWebExperimentClient(
      apiKey,
      initialFlags,
      config,
    );
    globalScope.webExperiment = webExperiment;
    return webExperiment;
  }

  /**
   * Get the underlying {@link ExperimentClient} instance.
   */
  public getExperimentClient(): ExperimentClient {
    return this.experimentClient;
  }

  /**
   * Apply evaluated variants to the page.
   * @param options
   */
  public applyVariants(options?: ApplyVariantsOptions) {
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
    for (const key in variants) {
      if (flagKeys && !flagKeys.includes(key)) {
        continue;
      }
      const variant = variants[key];
      const isWebExperimentation = variant.metadata?.deliveryMethod === 'web';
      if (isWebExperimentation) {
        const shouldTrackExposure =
          (variant.metadata?.['trackExposure'] as boolean) ?? true;
        // if payload is falsy or empty array, consider it as control variant
        const payloadIsArray = Array.isArray(variant.payload);
        // TODO(bgiori) this will need to change when we introduce control variant mutations
        const isControlPayload =
          !variant.payload || (payloadIsArray && variant.payload.length === 0);
        if (shouldTrackExposure && isControlPayload) {
          this.exposureWithDedupe(key, variant);
          continue;
        }

        if (payloadIsArray) {
          this.handleVariantAction(key, variant);
        }
      }
    }
  }

  /**
   * Revert variant actions applied by the experiment.
   * @param options
   */
  public revertVariants(options?: RevertVariantsOptions) {
    let { flagKeys } = options || {};
    if (!flagKeys) {
      flagKeys = Object.keys(this.appliedMutations);
    }
    for (const key of flagKeys) {
      this.appliedMutations[key]?.forEach((mutationController) => {
        mutationController.revert();
      });
      delete this.appliedMutations[key];
    }
  }

  /**
   * Preview the effect of a variant on the page.
   * @param options
   */
  public previewVariants(options: PreviewVariantsOptions) {
    const { keyToVariant } = options;
    if (!keyToVariant) {
      return;
    }

    this.revertVariants({ flagKeys: Object.keys(keyToVariant) });

    for (const key in keyToVariant) {
      const variant = keyToVariant[key];
      const flag = this.flagVariantMap[key];
      if (!flag) {
        return;
      }
      const variantObject = flag[variant];
      if (!variantObject) {
        return;
      }
      const payload = variantObject.payload;
      if (!payload || !Array.isArray(payload)) {
        return;
      }
      this.handleVariantAction(key, variantObject);
    }
  }

  /**
   * Get all variants for the current web experiment context.
   */
  public getVariants(): Variants {
    const variants: Variants = {};
    for (const key of [...this.localFlagKeys, ...this.remoteFlagKeys]) {
      variants[key] = this.experimentClient.variant(key);
    }
    return variants;
  }

  /**
   * Get the list of experiments that are active on the current page.
   */
  public getActiveExperiments(): string[] {
    const variants = this.getVariants();
    return Object.keys(variants).filter((key) => {
      return (
        variants[key].metadata?.segmentName !==
          PAGE_NOT_TARGETED_SEGMENT_NAME &&
        variants[key].metadata?.segmentName !== PAGE_IS_EXCLUDED_SEGMENT_NAME
      );
    });
  }

  /**
   * Set a custom redirect handler.
   */
  public setRedirectHandler(handler: (url: string) => void) {
    this.customRedirectHandler = handler;
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

  private handleVariantAction(key: string, variant: Variant) {
    for (const action of variant.payload) {
      if (action.action === 'redirect') {
        this.handleRedirect(action, key, variant);
      } else if (action.action === 'mutate') {
        this.handleMutate(action, key, variant);
      } else if (action.action === 'inject') {
        this.handleInject(action, key, variant);
      }
    }
  }

  private handleRedirect(action, key: string, variant: Variant) {
    const referrerUrl = urlWithoutParamsAndAnchor(
      this.previousUrl || this.globalScope.document.referrer,
    );
    const redirectUrl = action?.data?.url;

    const currentUrl = urlWithoutParamsAndAnchor(
      this.globalScope.location.href,
    );

    // prevent infinite redirection loop
    if (currentUrl === referrerUrl) {
      return;
    }

    const targetUrl = concatenateQueryParamsOf(
      this.globalScope.location.href,
      redirectUrl,
    );

    this.exposureWithDedupe(key, variant);

    // set previous url - relevant for SPA if redirect happens before push/replaceState is complete
    this.previousUrl = this.globalScope.location.href;
    // perform redirection

    if (this.customRedirectHandler) {
      this.customRedirectHandler(targetUrl);
      return;
    }
    this.globalScope.location.replace(targetUrl);
  }

  private handleMutate(action, key: string, variant: Variant) {
    // Check for repeat invocations
    if (this.appliedMutations[key]) {
      return;
    }
    const mutations = action.data?.mutations;
    const mutationControllers: MutationController[] = [];
    mutations.forEach((m) => {
      mutationControllers.push(mutate.declarative(m));
    });
    this.appliedMutations[key] = mutationControllers;
    this.exposureWithDedupe(key, variant);
  }

  private handleInject(action, key: string, variant: Variant) {
    // Check for repeat invocations
    if (this.appliedMutations[key]) {
      return;
    }
    // Validate and transform ID
    let id = action.data.id;
    if (!id || typeof id !== 'string' || id.length === 0) {
      return;
    }
    // Replace the `-` characters in the UUID to support function name
    id = id.replace(/-/g, '');
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
        script.innerHTML = `function ${id}(html, utils, id){${rawJs}};`;
        script.id = `js-${id}`;
        this.globalScope.document.head.appendChild(script);
      }
    }
    // Create CSS
    const rawCss = action.data.css;
    let style: HTMLStyleElement | undefined;
    if (rawCss) {
      style = this.globalScope.document.createElement('style');
      if (style) {
        style.innerHTML = rawCss;
        style.id = `css-${id}`;
        this.globalScope.document.head.appendChild(style);
      }
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
    const utils = getInjectUtils();
    this.appliedInjections.add(id);
    try {
      const fn = this.globalScope[id];
      if (fn && typeof fn === 'function') {
        fn(html, utils, id);
      }
    } catch (e) {
      script?.remove();
      console.error(
        `Experiment inject failed for ${key} variant ${variant.key}. Reason:`,
        e,
      );
    }
    // Push mutation to remove CSS and any custom state cleanup set in utils.
    this.appliedMutations[key] = [
      {
        revert: () => {
          if (utils.remove) utils.remove();
          style?.remove();
          script?.remove();
          this.appliedInjections.delete(id);
        },
      },
    ];
    this.exposureWithDedupe(key, variant);
  }

  private isPageTargetingSegment(segment: EvaluationSegment) {
    return (
      segment.metadata?.trackExposure === false &&
      (segment.metadata?.segmentName === PAGE_NOT_TARGETED_SEGMENT_NAME ||
        segment.metadata?.segmentName === PAGE_IS_EXCLUDED_SEGMENT_NAME)
    );
  }

  private exposureWithDedupe(key: string, variant: Variant) {
    const shouldTrackVariant = variant.metadata?.['trackExposure'] ?? true;
    const currentUrl = urlWithoutParamsAndAnchor(
      this.globalScope.location.href,
    );

    // if on the same base URL, only track exposure if variant has changed or has not been tracked
    const hasTrackedVariant =
      this.urlExposureCache?.[currentUrl]?.[key] === variant.key;
    const shouldTrackExposure = shouldTrackVariant && !hasTrackedVariant;

    if (shouldTrackExposure) {
      this.experimentClient.exposure(key);
      this.urlExposureCache[currentUrl][key] = variant.key;
    }
  }

  private applyAntiFlickerCss() {
    if (!this.globalScope.document.getElementById('amp-exp-css')) {
      const id = 'amp-exp-css';
      const s = document.createElement('style');
      s.id = id;
      s.innerText =
        '* { visibility: hidden !important; background-image: none !important; }';
      document.head.appendChild(s);
      this.globalScope.window.setTimeout(function () {
        s.remove();
      }, 1000);
    }
  }

  private setDefaultNavigationHandler(flagKeys: string[]) {
    // Add URL change listener for back/forward navigation
    this.globalScope.addEventListener('popstate', () => {
      this.revertVariants();
      this.applyVariants({ flagKeys: flagKeys });
    });

    const handleUrlChange = () => {
      this.revertVariants();
      this.applyVariants({ flagKeys: flagKeys });
      this.previousUrl = this.globalScope.location.href;
    };

    // Create wrapper functions for pushState and replaceState
    const wrapHistoryMethods = () => {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      // Wrapper for pushState
      history.pushState = function (...args) {
        // Call the original pushState
        const result = originalPushState.apply(this, args);
        // Revert mutations and apply variants
        handleUrlChange();
        return result;
      };

      // Wrapper for replaceState
      history.replaceState = function (...args) {
        // Call the original replaceState
        const result = originalReplaceState.apply(this, args);
        // Revert mutations and apply variants
        handleUrlChange();
        return result;
      };
    };

    // Initialize the wrapper
    wrapHistoryMethods();
  }
}
