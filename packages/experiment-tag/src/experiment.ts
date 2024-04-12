import {EvaluationFlag} from '@amplitude/experiment-core';
import { Experiment, ExperimentUser } from '@amplitude/experiment-js-client';

import {
  getGlobalScope,
  getUrlParams,
  isLocalStorageAvailable,
  matchesUrl, removeQueryParams,
  urlWithoutParamsAndAnchor,
  UUID,
} from './util';

export const initializeExperiment = (apiKey: string, initialFlags: string) => {
  const globalScope = getGlobalScope();
  const experimentStorageName = `EXP_${apiKey.slice(0, 10)}`;

  if (isLocalStorageAvailable() && globalScope) {
    let user: ExperimentUser = {};
    try {
      user = JSON.parse(
        globalScope?.localStorage.getItem(experimentStorageName) || '{}',
      );
    } catch (error) {
      // catch error
    }

    // create new user if it does not exist, or it does not have device_id
    if (Object.keys(user).length === 0 || !user.device_id) {
      user = {};
      user.device_id = UUID();
      globalScope?.localStorage.setItem(
        experimentStorageName,
        JSON.stringify(user),
      );
    }

    const urlParams = getUrlParams();
    // force variant if in preview mode
    if (urlParams['PREVIEW']) {
      const parsedFlags = JSON.parse(initialFlags);
      parsedFlags.forEach((flag: EvaluationFlag) => {
        if (flag.key in urlParams && urlParams[flag.key] in flag.variants) {
          flag.segments = [
            {
              metadata: {
                segmentName: 'preview',
              },
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

    for (const key in variants) {
      const variant = variants[key];

      if (!Array.isArray(variant?.payload)) {
        continue;
      }
      for (const action of variant.payload) {
        if (action.action === 'redirect') {
          const urlExactMatch = variant?.metadata?.['urlMatch'];
          const currentUrl = urlWithoutParamsAndAnchor(
            globalScope.location.href,
          );
          const referrerUrl = urlWithoutParamsAndAnchor(
            globalScope.document.referrer,
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
              // perform redirection
              globalScope.location.replace(redirectUrl);
            } else {
              // if redirection is not required
              globalScope.experiment.exposure(key);
            }
          } else if (
            // if at the redirected page
            matchesUrl(urlExactMatch, referrerUrl) &&
            (matchesUrl([redirectUrl], currentUrl) ||
              // case when redirected url has query and anchor
              matchesUrl([redirectUrl], globalScope.location.href))
          ) {
            globalScope.experiment.exposure(key);
          }
        }
      }
    }
  }
};
