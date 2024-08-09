import { EvaluationFlag } from '@amplitude/experiment-core';
import {
  Experiment,
  ExperimentUser,
  Variant,
} from '@amplitude/experiment-js-client';
import mutate, { MutationController } from 'dom-mutator';

import { WindowMessenger } from './messenger';
import {
  getGlobalScope,
  getUrlParams,
  isLocalStorageAvailable,
  matchesUrl,
  removeQueryParams,
  urlWithoutParamsAndAnchor,
  UUID,
  concatenateQueryParamsOf,
} from './util';

const appliedMutations: MutationController[] = [];
let previousUrl: string | undefined = undefined;

export const initializeExperiment = (apiKey: string, initialFlags: string) => {
  WindowMessenger.setup();
  const experimentStorageName = `EXP_${apiKey.slice(0, 10)}`;
  const globalScope = getGlobalScope();

  if (isLocalStorageAvailable() && globalScope) {
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
          flag.segments = [
            {
              metadata: { segmentName: 'preview' },
              variant: urlParams[flag.key],
            },
          ];
        }
      });
      initialFlags = JSON.stringify(parsedFlags);
    }

    globalScope.experiment = Experiment.initializeWithAmplitudeAnalytics(
      apiKey,
      {
        debug: true,
        fetchOnStart: false,
        initialFlags: initialFlags,
      },
    );

    globalScope.experiment.setUser(user);

    const variants = globalScope.experiment.all();

    setUrlChangeListener();
    applyVariants(variants);
  }
};

const applyVariants = (variants) => {
  const globalScope = getGlobalScope();
  if (globalScope) {
    for (const key in variants) {
      const variant = variants[key];
      const isWebExperimentation = variant.metadata?.deliveryMethod === 'web';
      if (isWebExperimentation) {
        const urlExactMatch = variant.metadata?.['urlMatch'] as string[];
        const currentUrl = urlWithoutParamsAndAnchor(globalScope.location.href);
        // if payload is falsy or empty array, consider it as control variant
        const payloadIsArray = Array.isArray(variant.payload);
        const isControlPayload =
          !variant.payload || (payloadIsArray && variant.payload.length === 0);
        if (matchesUrl(urlExactMatch, currentUrl) && isControlPayload) {
          globalScope.experiment.exposure(key);
          continue;
        }

        if (payloadIsArray) {
          for (const action of variant.payload) {
            if (action.action === 'redirect') {
              handleRedirect(action, key, variant);
            } else if (action.action === 'mutate') {
              handleMutate(action, key, variant);
            }
          }
        }
      }
    }
  }
};

const handleRedirect = (action, key: string, variant: Variant) => {
  const globalScope = getGlobalScope();
  if (globalScope) {
    const urlExactMatch = variant?.metadata?.['urlMatch'] as string[];
    const currentUrl = urlWithoutParamsAndAnchor(globalScope.location.href);
    const referrerUrl = urlWithoutParamsAndAnchor(
      previousUrl || globalScope.document.referrer,
    );
    const redirectUrl = action?.data?.url;
    // if in preview mode, strip query params
    if (variant.metadata?.segmentName === 'preview') {
      globalScope.history.replaceState(
        {},
        '',
        removeQueryParams(globalScope.location.href, ['PREVIEW', key]),
      );
    }
    if (matchesUrl(urlExactMatch, currentUrl)) {
      if (
        !matchesUrl([redirectUrl], currentUrl) &&
        currentUrl !== referrerUrl
      ) {
        const targetUrl = concatenateQueryParamsOf(
          globalScope.location.href,
          redirectUrl,
        );
        // perform redirection
        globalScope.location.replace(targetUrl);
      } else {
        // if redirection is not required
        globalScope.experiment.exposure(key);
      }
    } else if (
      // if at the redirected page
      matchesUrl(urlExactMatch, referrerUrl) &&
      matchesUrl([urlWithoutParamsAndAnchor(redirectUrl)], currentUrl)
    ) {
      globalScope.experiment.exposure(key);
    }
  }
};

const handleMutate = (action, key: string, variant: Variant) => {
  const globalScope = getGlobalScope();
  if (globalScope) {
    const urlExactMatch = variant?.metadata?.['urlMatch'] as string[];
    const currentUrl = urlWithoutParamsAndAnchor(globalScope.location.href);

    if (matchesUrl(urlExactMatch, currentUrl)) {
      const mutations = action.data?.mutations;
      mutations.forEach((m) => {
        appliedMutations.push(mutate.declarative(m));
      });
      globalScope.experiment.exposure(key);
    }
  }
};

const revertMutations = () => {
  while (appliedMutations.length > 0) {
    appliedMutations.pop()?.revert();
  }
};

export const setUrlChangeListener = () => {
  const globalScope = getGlobalScope();
  if (globalScope) {
    // Add URL change listener for back/forward navigation
    globalScope.addEventListener('popstate', () => {
      revertMutations();
      applyVariants(globalScope.experiment.all());
    });

    (function (history) {
      const pushState = history.pushState;
      const replaceState = history.replaceState;

      history.pushState = function (...args) {
        previousUrl = globalScope.location.href;
        const result = pushState.apply(history, args);
        globalScope.dispatchEvent(new Event('popstate'));
        return result;
      };

      history.replaceState = function (...args) {
        previousUrl = globalScope.location.href;
        const result = replaceState.apply(history, args);
        return result;
      };
    })(globalScope.history);
  }
};
