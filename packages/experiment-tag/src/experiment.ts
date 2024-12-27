import { AnalyticsConnector } from '@amplitude/analytics-connector';
import {
  EvaluationFlag,
  EvaluationSegment,
  getGlobalScope,
  isLocalStorageAvailable,
} from '@amplitude/experiment-core';
import {
  Experiment,
  Variant,
  Variants,
  AmplitudeIntegrationPlugin,
  ExperimentConfig,
  ExperimentClient,
} from '@amplitude/experiment-js-client';
import mutate, { MutationController } from 'dom-mutator';

import { getInjectUtils } from './inject-utils';
import { WindowMessenger } from './messenger';
import {
  getUrlParams,
  removeQueryParams,
  urlWithoutParamsAndAnchor,
  UUID,
  concatenateQueryParamsOf,
} from './util';

export class WebExperiment {
  private readonly apiKey: string;
  private initialFlags: string;
  private readonly config: ExperimentConfig;
  private readonly globalScope = getGlobalScope();
  private appliedInjections: Set<string> = new Set();
  private appliedMutations: MutationController[] = [];
  private previousUrl: string | undefined;
  // Cache to track exposure for the current URL, should be cleared on URL change
  private urlExposureCache: {
    [url: string]: { [key: string]: string | undefined };
  } = {};
  private experimentClient: ExperimentClient | undefined;

  constructor(
    apiKey: string,
    initialFlags: string,
    config: ExperimentConfig = {},
  ) {
    this.apiKey = apiKey;
    this.initialFlags = initialFlags;
    this.config = config;
  }

  public async initializeExperiment() {
    if (this.globalScope?.webExperiment) {
      return;
    }

    WindowMessenger.setup();
    if (!isLocalStorageAvailable() || !this.globalScope) {
      return;
    }

    this.globalScope.webExperiment = this;
    this.previousUrl = undefined;
    this.urlExposureCache = {};
    const experimentStorageName = `EXP_${this.apiKey.slice(0, 10)}`;
    let user;
    try {
      user = JSON.parse(
        this.globalScope.localStorage.getItem(experimentStorageName) || '{}',
      );
    } catch (error) {
      user = {};
    }

    // create new user if it does not exist, or it does not have device_id or web_exp_id
    if (Object.keys(user).length === 0 || !user.device_id || !user.web_exp_id) {
      if (!user.device_id || !user.web_exp_id) {
        // if user has device_id, migrate it to web_exp_id
        if (user.device_id) {
          user.web_exp_id = user.device_id;
        } else {
          const uuid = UUID();
          // both IDs are set for backwards compatibility, to be removed in future update
          user = { device_id: uuid, web_exp_id: uuid };
        }
        this.globalScope.localStorage.setItem(
          experimentStorageName,
          JSON.stringify(user),
        );
      }
    }

    const urlParams = getUrlParams();
    // if in visual edit mode, remove the query param
    if (urlParams['VISUAL_EDITOR']) {
      this.globalScope.history.replaceState(
        {},
        '',
        removeQueryParams(this.globalScope.location.href, ['VISUAL_EDITOR']),
      );
      return;
    }

    let isRemoteBlocking = false;
    const remoteFlagKeys: Set<string> = new Set();
    const localFlagKeys: Set<string> = new Set();
    const parsedFlags = JSON.parse(this.initialFlags);

    parsedFlags.forEach((flag: EvaluationFlag) => {
      const { key, variants, segments, metadata = {} } = flag;

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
        remoteFlagKeys.add(key);

        // allow local evaluation for remote flags
        metadata.evaluationMode = 'local';

        // Check if any remote flags are blocking
        if (!isRemoteBlocking && metadata.blockingEvaluation) {
          isRemoteBlocking = true;

          // Apply anti-flicker CSS to prevent UI flicker
          this.applyAntiFlickerCss();
        }
      } else {
        // Add locally evaluable flags to the local flag set
        localFlagKeys.add(key);
      }

      flag.metadata = metadata;
    });

    this.initialFlags = JSON.stringify(parsedFlags);

    // initialize the experiment
    this.experimentClient = Experiment.initialize(this.apiKey, {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      internalInstanceNameSuffix: 'web',
      initialFlags: this.initialFlags,
      // timeout for fetching remote flags
      fetchTimeoutMillis: 1000,
      pollOnStart: false,
      fetchOnStart: false,
      ...this.config,
    });

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

    this.setUrlChangeListener(new Set([...localFlagKeys, ...remoteFlagKeys]));

    // apply local variants
    this.applyVariants(this.experimentClient.all(), localFlagKeys);

    if (!isRemoteBlocking) {
      // Remove anti-flicker css if remote flags are not blocking
      this.globalScope.document.getElementById?.('amp-exp-css')?.remove();
    }

    if (remoteFlagKeys.size === 0) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await this.experimentClient.doFlags();
    } catch (error) {
      console.warn('Error fetching remote flags:', error);
    }
    // apply remote variants - if fetch is unsuccessful, fallback order: 1. localStorage flags, 2. initial flags
    this.applyVariants(this.experimentClient.all(), remoteFlagKeys);
  }

  public applyVariants(
    variants: Variants,
    flagKeys: Set<string> | undefined = undefined,
  ) {
    if (Object.keys(variants).length === 0) {
      return;
    }
    const globalScope = getGlobalScope();
    if (!globalScope) {
      return;
    }
    const currentUrl = urlWithoutParamsAndAnchor(globalScope.location.href);
    // Initialize the cache if on a new URL
    if (!this.urlExposureCache?.[currentUrl]) {
      this.urlExposureCache = {};
      this.urlExposureCache[currentUrl] = {};
    }
    for (const key in variants) {
      if (flagKeys && !flagKeys.has(key)) {
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
      }
    }
  }

  private handleRedirect(action, key: string, variant: Variant) {
    const globalScope = getGlobalScope();
    if (!globalScope) {
      return;
    }
    const referrerUrl = urlWithoutParamsAndAnchor(
      this.previousUrl || globalScope.document.referrer,
    );
    const redirectUrl = action?.data?.url;

    const currentUrl = urlWithoutParamsAndAnchor(globalScope.location.href);

    // prevent infinite redirection loop
    if (currentUrl === referrerUrl) {
      return;
    }

    const targetUrl = concatenateQueryParamsOf(
      globalScope.location.href,
      redirectUrl,
    );

    this.exposureWithDedupe(key, variant);

    // set previous url - relevant for SPA if redirect happens before push/replaceState is complete
    this.previousUrl = globalScope.location.href;
    // perform redirection
    globalScope.location.replace(targetUrl);
  }

  private handleMutate(action, key: string, variant: Variant) {
    const globalScope = getGlobalScope();
    if (!globalScope) {
      return;
    }
    const mutations = action.data?.mutations;
    mutations.forEach((m) => {
      this.appliedMutations.push(mutate.declarative(m));
    });
    this.exposureWithDedupe(key, variant);
  }

  public revertMutations() {
    while (this.appliedMutations.length > 0) {
      this.appliedMutations.pop()?.revert();
    }
  }

  private handleInject(action, key: string, variant: Variant) {
    const globalScope = getGlobalScope();
    if (!globalScope) {
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
      script = globalScope.document.createElement('script');
      if (script) {
        script.innerHTML = `function ${id}(html, utils, id){${rawJs}};`;
        script.id = `js-${id}`;
        globalScope.document.head.appendChild(script);
      }
    }
    // Create CSS
    const rawCss = action.data.css;
    let style: HTMLStyleElement | undefined;
    if (rawCss) {
      style = globalScope.document.createElement('style');
      if (style) {
        style.innerHTML = rawCss;
        style.id = `css-${id}`;
        globalScope.document.head.appendChild(style);
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
      const fn = globalScope[id];
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
    this.appliedMutations.push({
      revert: () => {
        if (utils.remove) utils.remove();
        style?.remove();
        script?.remove();
        this.appliedInjections.delete(id);
      },
    });
    this.exposureWithDedupe(key, variant);
  }

  public setUrlChangeListener(flagKeys: Set<string>) {
    const globalScope = getGlobalScope();
    if (!globalScope) {
      return;
    }
    // Add URL change listener for back/forward navigation
    globalScope.addEventListener('popstate', () => {
      this.revertMutations();
      this.applyVariants(this.experimentClient?.all() || {}, flagKeys);
    });

    const handleUrlChange = () => {
      this.revertMutations();
      this.applyVariants(this.experimentClient?.all() || {}, flagKeys);
      this.previousUrl = globalScope.location.href;
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

  private isPageTargetingSegment(segment: EvaluationSegment) {
    return (
      segment.metadata?.trackExposure === false &&
      (segment.metadata?.segmentName === 'Page not targeted' ||
        segment.metadata?.segmentName === 'Page is excluded')
    );
  }

  private exposureWithDedupe(key: string, variant: Variant) {
    const globalScope = getGlobalScope();
    if (!globalScope) return;

    const shouldTrackVariant = variant.metadata?.['trackExposure'] ?? true;
    const currentUrl = urlWithoutParamsAndAnchor(globalScope.location.href);

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
    const globalScope = getGlobalScope();
    if (!globalScope) return;
    if (!globalScope.document.getElementById('amp-exp-css')) {
      const id = 'amp-exp-css';
      const s = document.createElement('style');
      s.id = id;
      s.innerText =
        '* { visibility: hidden !important; background-image: none !important; }';
      document.head.appendChild(s);
      globalScope.window.setTimeout(function () {
        s.remove();
      }, 1000);
    }
  }
}
