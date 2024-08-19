import { EvaluationFlag } from '@amplitude/experiment-core';
import {
  Experiment,
  ExperimentUser,
  Variant,
} from '@amplitude/experiment-js-client';
import mutate, { MutationController } from 'dom-mutator';

import { getInjectUtils } from './inject-utils';
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
const appliedInjections: Set<string> = new Set();
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
            } else if (action.action === 'inject') {
              handleInject(action, key, variant);
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
  const urlExactMatch = variant?.metadata?.['urlMatch'] as string[];
  const currentUrl = urlWithoutParamsAndAnchor(globalScope.location.href);
  if (matchesUrl(urlExactMatch, currentUrl)) {
    // Check for repeat invocations
    const id = action.data.id;
    if (appliedInjections.has(id)) {
      return;
    }
    // Create CSS
    const rawCss = action.data.css;
    let style: HTMLStyleElement | undefined;
    if (rawCss) {
      style = document.createElement('style');
      style.innerHTML = rawCss;
      style.id = `css-${id}`;
      document.head.appendChild(style);
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
    inject(js, html, utils, id);
    // Push mutation to remove CSS and any custom state cleanup set in utils.
    appliedMutations.push({
      revert: () => {
        if (utils.remove) utils.remove();
        style?.remove();
        appliedInjections.delete(id);
      },
    });
    globalScope.experiment.exposure(key);
  }
};

export const setUrlChangeListener = () => {
  const globalScope = getGlobalScope();
  if (globalScope) {
    // add URL change listener
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
        globalScope.dispatchEvent(new Event('popstate'));
        return result;
      };
    })(globalScope.history);
  }
};
