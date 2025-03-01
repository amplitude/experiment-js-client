import { AnalyticsConnector } from '@amplitude/analytics-connector';
import {
  EvaluationFlag,
  EvaluationSegment,
  getGlobalScope,
  isLocalStorageAvailable,
} from '@amplitude/experiment-core';
import { safeGlobal } from '@amplitude/experiment-core';
import {
  Experiment,
  Variant,
  Variants,
  AmplitudeIntegrationPlugin,
  ExperimentConfig,
} from '@amplitude/experiment-js-client';
import * as FeatureExperiment from '@amplitude/experiment-js-client';
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

safeGlobal.Experiment = FeatureExperiment;

const appliedInjections: Set<string> = new Set();
const appliedMutations: MutationController[] = [];
let previousUrl: string | undefined;
// Cache to track exposure for the current URL, should be cleared on URL change
let urlExposureCache: { [url: string]: { [key: string]: string | undefined } };

export const initializeExperiment = async (
  apiKey: string,
  initialFlags: string,
  config: ExperimentConfig = {},
) => {
  const globalScope = getGlobalScope();
  if (globalScope?.webExperiment) {
    return;
  }
  WindowMessenger.setup();
  if (!isLocalStorageAvailable() || !globalScope) {
    return;
  }
  previousUrl = undefined;
  urlExposureCache = {};
  const experimentStorageName = `EXP_${apiKey.slice(0, 10)}`;
  let user;
  try {
    user = JSON.parse(
      globalScope.localStorage.getItem(experimentStorageName) || '{}',
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
    globalScope.localStorage.setItem(
      experimentStorageName,
      JSON.stringify(user),
    );
  } else if (user.web_exp_id && user.device_id) {
    delete user.device_id;
    globalScope.localStorage.setItem(
      experimentStorageName,
      JSON.stringify(user),
    );
  }

  const urlParams = getUrlParams();
  // if in visual edit mode, remove the query param
  if (urlParams['VISUAL_EDITOR']) {
    globalScope.history.replaceState(
      {},
      '',
      removeQueryParams(globalScope.location.href, ['VISUAL_EDITOR']),
    );
    return;
  }

  let isRemoteBlocking = false;
  const remoteFlagKeys: Set<string> = new Set();
  const localFlagKeys: Set<string> = new Set();
  const parsedFlags = JSON.parse(initialFlags);

  parsedFlags.forEach((flag: EvaluationFlag) => {
    const { key, variants, segments, metadata = {} } = flag;

    // Force variant if in preview mode
    if (
      urlParams['PREVIEW'] &&
      key in urlParams &&
      urlParams[key] in variants
    ) {
      // Remove preview-related query parameters from the URL
      globalScope.history.replaceState(
        {},
        '',
        removeQueryParams(globalScope.location.href, ['PREVIEW', key]),
      );

      // Retain only page-targeting segments
      const pageTargetingSegments = segments.filter(isPageTargetingSegment);

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
    } else {
      // Add locally evaluable flags to the local flag set
      localFlagKeys.add(key);
    }

    flag.metadata = metadata;
  });

  initialFlags = JSON.stringify(parsedFlags);

  // initialize the experiment
  globalScope.webExperiment = Experiment.initialize(apiKey, {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    internalInstanceNameSuffix: 'web',
    initialFlags: initialFlags,
    // timeout for fetching remote flags
    fetchTimeoutMillis: 1000,
    pollOnStart: false,
    fetchOnStart: false,
    ...config,
  });

  // evaluate variants for page targeting
  const variants: Variants = globalScope.webExperiment.all();

  for (const [key, variant] of Object.entries(variants)) {
    // only apply antiflicker for remote flags active on the page
    if (
      remoteFlagKeys.has(key) &&
      variant.metadata?.blockingEvaluation &&
      variant.metadata?.segmentName !== 'Page not targeted' &&
      variant.metadata?.segmentName !== 'Page is excluded'
    ) {
      isRemoteBlocking = true;
      // Apply anti-flicker CSS to prevent UI flicker
      applyAntiFlickerCss();
    }
  }

  // If no integration has been set, use an amplitude integration.
  if (!globalScope.experimentIntegration) {
    const connector = AnalyticsConnector.getInstance('$default_instance');
    globalScope.experimentIntegration = new AmplitudeIntegrationPlugin(
      apiKey,
      connector,
      0,
    );
  }
  globalScope.experimentIntegration.type = 'integration';
  globalScope.webExperiment.addPlugin(globalScope.experimentIntegration);
  globalScope.webExperiment.setUser(user);

  setUrlChangeListener(new Set([...localFlagKeys, ...remoteFlagKeys]));

  // apply local variants
  applyVariants(globalScope.webExperiment.all(), localFlagKeys);

  if (!isRemoteBlocking) {
    // Remove anti-flicker css if remote flags are not blocking
    globalScope.document.getElementById?.('amp-exp-css')?.remove();
  }

  if (remoteFlagKeys.size === 0) {
    return;
  }

  try {
    await globalScope.webExperiment.doFlags();
  } catch (error) {
    console.warn('Error fetching remote flags:', error);
  }
  // apply remote variants - if fetch is unsuccessful, fallback order: 1. localStorage flags, 2. initial flags
  applyVariants(globalScope.webExperiment.all(), remoteFlagKeys);
};

const applyVariants = (
  variants: Variants,
  flagKeys: Set<string> | undefined = undefined,
) => {
  if (Object.keys(variants).length === 0) {
    return;
  }
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return;
  }
  const currentUrl = urlWithoutParamsAndAnchor(globalScope.location.href);
  // Initialize the cache if on a new URL
  if (!urlExposureCache?.[currentUrl]) {
    urlExposureCache = {};
    urlExposureCache[currentUrl] = {};
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
        exposureWithDedupe(key, variant);
        continue;
      }

      if (payloadIsArray) {
        for (const action of variant.payload) {
          if (action.action === 'redirect') {
            handleRedirect(action, key, variant);
          } else if (action.action === 'mutate') {
            handleMutate(action, key, variant);
          } else if (action.action === 'inject') {
            handleInject(action, key, variant);
          }
        }
      }
    }
  }
};

const handleRedirect = (action, key: string, variant: Variant) => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return;
  }
  const referrerUrl = urlWithoutParamsAndAnchor(
    previousUrl || globalScope.document.referrer,
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

  exposureWithDedupe(key, variant);

  // set previous url - relevant for SPA if redirect happens before push/replaceState is complete
  previousUrl = globalScope.location.href;
  // perform redirection
  globalScope.location.replace(targetUrl);
};

const handleMutate = (action, key: string, variant: Variant) => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return;
  }
  const mutations = action.data?.mutations;
  mutations.forEach((m) => {
    appliedMutations.push(mutate.declarative(m));
  });
  exposureWithDedupe(key, variant);
};

const revertMutations = () => {
  while (appliedMutations.length > 0) {
    appliedMutations.pop()?.revert();
  }
};

const handleInject = (action, key: string, variant: Variant) => {
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
  if (appliedInjections.has(id)) {
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
  appliedInjections.add(id);
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
  appliedMutations.push({
    revert: () => {
      if (utils.remove) utils.remove();
      style?.remove();
      script?.remove();
      appliedInjections.delete(id);
    },
  });
  exposureWithDedupe(key, variant);
};

export const setUrlChangeListener = (flagKeys: Set<string>) => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return;
  }
  // Add URL change listener for back/forward navigation
  globalScope.addEventListener('popstate', () => {
    revertMutations();
    applyVariants(globalScope.webExperiment.all(), flagKeys);
  });

  // Create wrapper functions for pushState and replaceState
  const wrapHistoryMethods = () => {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    // Wrapper for pushState
    history.pushState = function (...args) {
      // Call the original pushState
      const result = originalPushState.apply(this, args);
      // Revert mutations and apply variants
      revertMutations();
      applyVariants(globalScope.webExperiment.all(), flagKeys);
      previousUrl = globalScope.location.href;
      return result;
    };

    // Wrapper for replaceState
    history.replaceState = function (...args) {
      // Call the original replaceState
      const result = originalReplaceState.apply(this, args);
      // Revert mutations and apply variants
      revertMutations();
      applyVariants(globalScope.webExperiment.all(), flagKeys);
      previousUrl = globalScope.location.href;
      return result;
    };
  };

  // Initialize the wrapper
  wrapHistoryMethods();
};

const isPageTargetingSegment = (segment: EvaluationSegment) => {
  return (
    segment.metadata?.trackExposure === false &&
    (segment.metadata?.segmentName === 'Page not targeted' ||
      segment.metadata?.segmentName === 'Page is excluded')
  );
};

const exposureWithDedupe = (key: string, variant: Variant) => {
  const globalScope = getGlobalScope();
  if (!globalScope) return;

  const shouldTrackVariant = variant.metadata?.['trackExposure'] ?? true;
  const currentUrl = urlWithoutParamsAndAnchor(globalScope.location.href);

  // if on the same base URL, only track exposure if variant has changed or has not been tracked
  const hasTrackedVariant =
    urlExposureCache?.[currentUrl]?.[key] === variant.key;
  const shouldTrackExposure = shouldTrackVariant && !hasTrackedVariant;

  if (shouldTrackExposure) {
    globalScope.webExperiment.exposure(key);
    urlExposureCache[currentUrl][key] = variant.key;
  }
};

const applyAntiFlickerCss = () => {
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
};
