import {
  EvaluationFlag,
  EvaluationSegment,
  getGlobalScope,
  isLocalStorageAvailable,
} from '@amplitude/experiment-core';
import {
  Experiment,
  ExperimentUser,
  Variant,
  Variants,
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

const appliedInjections: Set<string> = new Set();
const appliedMutations: MutationController[] = [];
let previousUrl: string | undefined = undefined;

export const initializeExperiment = (apiKey: string, initialFlags: string) => {
  WindowMessenger.setup();
  const experimentStorageName = `EXP_${apiKey.slice(0, 10)}`;
  const globalScope = getGlobalScope();

  if (!isLocalStorageAvailable() || !globalScope) {
    return;
  }
  let user: ExperimentUser;
  try {
    user = JSON.parse(
      globalScope.localStorage.getItem(experimentStorageName) || '{}',
    );
  } catch (error) {
    user = {};
  }

  // create new user if it does not exist, or it does not have device_id
  if (Object.keys(user).length === 0 || !user.device_id) {
    user = {};
    user.device_id = UUID();
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
  // force variant if in preview mode
  if (urlParams['PREVIEW']) {
    const parsedFlags = JSON.parse(initialFlags);
    parsedFlags.forEach((flag: EvaluationFlag) => {
      if (flag.key in urlParams && urlParams[flag.key] in flag.variants) {
        // Strip the preview query param
        globalScope.history.replaceState(
          {},
          '',
          removeQueryParams(globalScope.location.href, ['PREVIEW', flag.key]),
        );

        // Keep page targeting segments
        const pageTargetingSegments = flag.segments.filter((segment) =>
          isPageTargetingSegment(segment),
        );

        // Create or update the preview segment
        const previewSegment = {
          metadata: { segmentName: 'preview' },
          variant: urlParams[flag.key],
        };

        flag.segments = [...pageTargetingSegments, previewSegment];
      }
    });
    initialFlags = JSON.stringify(parsedFlags);
  }

  globalScope.experiment = Experiment.initializeWithAmplitudeAnalytics(apiKey, {
    debug: true,
    fetchOnStart: false,
    initialFlags: initialFlags,
  });

  globalScope.experiment.setUser(user);

  const variants = globalScope.experiment.all();

  setUrlChangeListener();
  applyVariants(variants);
};

const applyVariants = (variants: Variants | undefined) => {
  if (!variants) {
    return;
  }
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return;
  }
  for (const key in variants) {
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
        globalScope.experiment.exposure(key);
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
  const shouldTrackExposure =
    (variant.metadata?.['trackExposure'] as boolean) ?? true;

  // prevent infinite redirection loop
  if (currentUrl === referrerUrl) {
    return;
  }
  const targetUrl = concatenateQueryParamsOf(
    globalScope.location.href,
    redirectUrl,
  );
  shouldTrackExposure && globalScope.experiment.exposure(key);
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
  const shouldTrackExposure =
    (variant.metadata?.['trackExposure'] as boolean) ?? true;
  shouldTrackExposure && globalScope.experiment.exposure(key);
};

const revertMutations = () => {
  while (appliedMutations.length > 0) {
    appliedMutations.pop()?.revert();
  }
};

const inject = (js: string, html, utils, id) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  eval(js, html, utils, id);
};

const handleInject = (action, key: string, variant: Variant) => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return;
  }
  // Check for repeat invocations
  const id = action.data.id;
  if (appliedInjections.has(id)) {
    return;
  }
  // Create CSS
  const rawCss = action.data.css;
  let style: HTMLStyleElement | undefined;
  if (rawCss) {
    style = globalScope.document.createElement('style');
    style.innerHTML = rawCss;
    style.id = `css-${id}`;
    globalScope.document.head.appendChild(style);
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
  const js = action.data.js;
  appliedInjections.add(id);
  try {
    inject(js, html, utils, id);
  } catch (e) {
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
      appliedInjections.delete(id);
    },
  });
  const shouldTrackExposure =
    (variant.metadata?.['trackExposure'] as boolean) ?? true;
  shouldTrackExposure && globalScope.experiment.exposure(key);
};

export const setUrlChangeListener = () => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return;
  }
  // Add URL change listener for back/forward navigation
  globalScope.addEventListener('popstate', () => {
    revertMutations();
    applyVariants(globalScope.experiment.all());
  });

  // Create wrapper functions for pushState and replaceState
  const wrapHistoryMethods = () => {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    // Wrapper for pushState
    history.pushState = function (...args) {
      previousUrl = globalScope.location.href;
      // Call the original pushState
      const result = originalPushState.apply(this, args);
      // Revert mutations and apply variants after pushing state
      revertMutations();
      applyVariants(globalScope.experiment.all());

      return result;
    };

    // Wrapper for replaceState
    history.replaceState = function (...args) {
      previousUrl = globalScope.location.href;
      // Call the original replaceState
      const result = originalReplaceState.apply(this, args);
      // Revert mutations and apply variants after replacing state
      revertMutations();
      applyVariants(globalScope.experiment.all());

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
