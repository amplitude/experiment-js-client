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

import { WebExperimentConfig } from './config';
import { getInjectUtils } from './inject-utils';
import { WindowMessenger } from './messenger';
import {
  ApplyVariantsOptions,
  PreviewVariantsOptions,
  RevertVariantsOptions,
  WebExperimentContext,
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

safeGlobal.Experiment = FeatureExperiment;

export class DefaultWebExperimentClient implements WebExperimentClient {
  private readonly apiKey: string;
  private readonly initialFlags: [];
  private readonly config: WebExperimentConfig;
  private readonly globalScope = getGlobalScope();
  private readonly experimentClient: ExperimentClient | undefined;
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

  constructor(
    apiKey: string,
    initialFlags: string,
    config: WebExperimentConfig = {},
  ) {
    this.apiKey = apiKey;
    this.config = config;
    this.initialFlags = JSON.parse(initialFlags);
    if (this.globalScope?.webExperiment) {
      return;
    }

    if (!isLocalStorageAvailable() || !this.globalScope) {
      return;
    }

    this.globalScope.webExperiment = this;

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

    this.initialFlags.forEach((flag: EvaluationFlag) => {
      const { key, variants, segments, metadata = {} } = flag;

      this.flagVariantMap[key] = {};
      Object.keys(variants).forEach((variantKey) => {
        this.flagVariantMap[key][variantKey] =
          convertEvaluationVariantToVariant(variants[variantKey]);
      });

      // Force variant if in preview mode
      if (
        urlParams['PREVIEW'] &&
        key in urlParams &&
        urlParams[key] in variants
      ) {
        // Remove preview-related query parameters from the URL
        this.globalScope?.history.replaceState(
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
          metadata: { segmentName: 'preview' },
          variant: urlParams[key],
        };

        // Update the flag's segments to include the preview segment
        flag.segments = [...pageTargetingSegments, previewSegment];

        // make all preview flags local
        metadata.evaluationMode = 'local';
      }

      if (metadata.evaluationMode !== 'local') {
        this.remoteFlagKeys.push(key);

        // allow local evaluation for remote flags
        metadata.evaluationMode = 'local';
      } else {
        // Add locally evaluable flags to the local flag set
        this.localFlagKeys.push(key);
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
      ...this.config,
    });

    // evaluate variants for page targeting
    const variants: Variants = this.experimentClient.all();

    for (const [key, variant] of Object.entries(variants)) {
      // only apply antiflicker for remote flags active on the page
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

    // If no integration has been set, use an amplitude integration.
    if (!this.globalScope.experimentIntegration) {
      const connector = AnalyticsConnector.getInstance('$default_instance');
      this.globalScope.experimentIntegration = new AmplitudeIntegrationPlugin(
        this.apiKey,
        connector,
        0,
      );
    }
    this.globalScope.experimentIntegration.type = 'integration';
    this.experimentClient.addPlugin(this.globalScope.experimentIntegration);
    this.experimentClient.setUser(user);

    // If no integration has been set, use an amplitude integration.
    if (!this.globalScope.experimentIntegration) {
      const connector = AnalyticsConnector.getInstance('$default_instance');
      this.globalScope.experimentIntegration = new AmplitudeIntegrationPlugin(
        apiKey,
        connector,
        0,
      );
    }
  }

  /**
   * Start the experiment.
   */
  public async start() {
    if (!this.experimentClient) {
      return;
    }

    if (this.config.reapplyVariantsOnNavigation) {
      this.setDefaultUrlChangeListener([
        ...this.localFlagKeys,
        ...this.remoteFlagKeys,
      ]);
    }

    // apply local variants
    this.applyVariants({ flagKeys: this.localFlagKeys });

    if (
      !this.isRemoteBlocking ||
      !this.config.applyRemoteExperimentAntiFlicker
    ) {
      // Remove anti-flicker css if remote flags are not blocking
      this.globalScope?.document.getElementById?.('amp-exp-css')?.remove();
    }

    if (this.remoteFlagKeys.length === 0) {
      return;
    }

    await this.fetchRemoteFlags();
    // apply remote variants - if fetch is unsuccessful, fallback order: 1. localStorage flags, 2. initial flags
    this.applyVariants({ flagKeys: this.remoteFlagKeys });
  }

  /**
   * Get the underlying ExperimentClient instance.
   */
  public getExperimentClient(): ExperimentClient | undefined {
    return this.experimentClient;
  }

  /**
   * Set the context for evaluating experiments.
   * If user is undefined, the current user is used.
   * If currentUrl is undefined, the current URL is used.
   * @param webExperimentContext
   */
  public setContext(webExperimentContext: WebExperimentContext) {
    if (this.experimentClient) {
      const existingUser = this.experimentClient?.getUser();
      if (webExperimentContext.user) {
        if (webExperimentContext.currentUrl) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          user.currentUrl = currentUrl;
        }
        this.experimentClient.setUser(webExperimentContext.user);
      } else {
        this.experimentClient.setUser({
          ...existingUser,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          currentUrl: webExperimentContext.currentUrl,
        });
      }
    }
  }

  /**
   * Set the previous URL for tracking back/forward navigation. Set previous URL to prevent infinite redirection loop
   * in single-page applications.
   * @param url
   */
  public setPreviousUrl(url: string) {
    this.previousUrl = url;
  }

  /**
   * Apply evaluated variants to the page.
   * @param applyVariantsOption
   */
  public applyVariants(applyVariantsOption?: ApplyVariantsOptions) {
    const { flagKeys } = applyVariantsOption || {};
    const variants = this.experimentClient?.all() || {};
    if (Object.keys(variants).length === 0) {
      return;
    }
    if (!this.globalScope) {
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
   * Revert mutations applied by the experiment.
   * @param revertVariantsOptions
   */
  public revertVariants(revertVariantsOptions?: RevertVariantsOptions) {
    let { flagKeys } = revertVariantsOptions || {};
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

  //
  // /**
  //  * Get redirect URLs for flags.
  //  * @param flagKeys
  //  */
  // public getRedirectUrls(
  //   flagKeys?: string[],
  // ): Record<string, Record<string, string>> {
  //   const redirectUrlMap: Record<string, Record<string, string>> = {};
  //   if (!flagKeys) {
  //     flagKeys = Object.keys(this.flagVariantMap);
  //   }
  //   for (const key of flagKeys) {
  //     if (this.flagVariantMap[key] === undefined) {
  //       continue;
  //     }
  //     const variants = this.flagVariantMap[key];
  //     const redirectUrls = {};
  //     Object.keys(variants).forEach((variantKey) => {
  //       const variant = variants[variantKey];
  //       const payload = variant.payload;
  //       if (payload && Array.isArray(payload)) {
  //         for (const action of variant.payload) {
  //           if (action.action === 'redirect') {
  //             const url = action.data?.url;
  //             if (url) {
  //               redirectUrls[variantKey] = action.data.url;
  //             }
  //           }
  //         }
  //       }
  //     });
  //     if (Object.keys(redirectUrls).length > 0) {
  //       redirectUrlMap[key] = redirectUrls;
  //     }
  //   }
  //   return redirectUrlMap;
  // }

  /**
   * Preview the effect of a variant on the page.
   * @param key
   * @param variant
   */
  public previewVariants(previewVariantsOptions: PreviewVariantsOptions) {
    const { keyToVariant } = previewVariantsOptions;
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
   * Get all variants for a given WebExperimentContext.
   * If user is undefined, the current user is used.
   * If currentUrl is undefined, the current URL is used.
   * If flagKeys is undefined, all variants are returned.
   * @param webExperimentContext
   * @param flagKeys
   */
  public getVariants(
    webExperimentContext?: WebExperimentContext,
    flagKeys?: string[],
  ): Variants {
    if (!this.experimentClient) return {};

    const existingContext = { user: this.experimentClient.getUser() };
    if (webExperimentContext) this.setContext(webExperimentContext);

    const allVariants = this.experimentClient.all();

    const isRelevantKey = (key: string) =>
      !flagKeys ||
      flagKeys.includes(key) ||
      this.localFlagKeys.includes(key) ||
      this.remoteFlagKeys.includes(key);

    const variants = Object.keys(allVariants).reduce<Record<string, any>>(
      (acc, key) => {
        if (isRelevantKey(key)) acc[key] = allVariants[key];
        return acc;
      },
      {},
    );

    this.setContext(existingContext);

    return flagKeys?.length
      ? flagKeys.reduce<Record<string, any>>((acc, key) => {
          if (key in variants) acc[key] = variants[key];
          return acc;
        }, {})
      : variants;
  }

  /**
   * Fetch remote flags based on the current user context.
   */
  public async fetchRemoteFlags() {
    if (!this.experimentClient) {
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await this.experimentClient.doFlags();
    } catch (error) {
      console.warn('Error fetching remote flags:', error);
    }
  }

  public getActiveExperimentsOnPage(currentUrl?: string): string[] {
    const variants = this.getVariants({ currentUrl: currentUrl });
    return Object.keys(variants).filter((key) => {
      return (
        variants[key].metadata?.segmentName !==
          PAGE_NOT_TARGETED_SEGMENT_NAME &&
        variants[key].metadata?.segmentName !== PAGE_IS_EXCLUDED_SEGMENT_NAME
      );
    });
  }

  public setRefreshVariantsListener(eventType: string) {
    this.globalScope?.addEventListener(eventType, () => {
      this.revertVariants();
      this.applyVariants();
    });
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
    if (!this.globalScope) {
      return;
    }
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
    this.globalScope.location.replace(targetUrl);
  }

  private handleMutate(action, key: string, variant: Variant) {
    if (!this.globalScope) {
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
    if (!this.globalScope) {
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
    if (!this.globalScope) return;

    const shouldTrackVariant = variant.metadata?.['trackExposure'] ?? true;
    const currentUrl = urlWithoutParamsAndAnchor(
      this.globalScope.location.href,
    );

    // if on the same base URL, only track exposure if variant has changed or has not been tracked
    const hasTrackedVariant =
      this.urlExposureCache?.[currentUrl]?.[key] === variant.key;
    const shouldTrackExposure = shouldTrackVariant && !hasTrackedVariant;

    if (shouldTrackExposure) {
      this.experimentClient?.exposure(key);
      this.urlExposureCache[currentUrl][key] = variant.key;
    }
  }

  private applyAntiFlickerCss() {
    if (!this.globalScope) return;
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

  private setDefaultUrlChangeListener(flagKeys: string[]) {
    if (!this.globalScope) {
      return;
    }
    // Add URL change listener for back/forward navigation
    this.globalScope?.addEventListener('popstate', () => {
      this.revertVariants();
      this.applyVariants({ flagKeys: flagKeys });
    });

    const handleUrlChange = () => {
      this.revertVariants();
      this.applyVariants({ flagKeys: flagKeys });
      this.previousUrl = this.globalScope?.location.href;
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
