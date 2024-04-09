import { Experiment } from '@amplitude/experiment-js-client';

import {
  getGlobalScope,
  getUrlParams,
  isLocalStorageAvailable,
  matchesUrl,
  urlWithoutParamsAndAnchor,
  UUID,
} from './util';

export const initializeExperiment = (apiKey: string, initialFlags: string) => {
  const globalScope = getGlobalScope();
  const experimentStorageName = `EXP_${apiKey.slice(0, 10)}`;

  if (isLocalStorageAvailable()) {
    let user = undefined;
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
    const parsedFlags = JSON.parse(initialFlags);

    parsedFlags.forEach((flag) => {
      if (flag.key in urlParams && urlParams[flag.key] in flag.variants) {
        flag.segments = [
          {
            metadata: {
              segmentName: 'All Other Users',
              previewMode: true,
            },
            variant: urlParams[flag.key],
          },
        ];
      }
    });

    initialFlags = JSON.stringify(parsedFlags);

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

      if (Array.isArray(variant?.payload)) {
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
            if (variant.metadata?.previewMode) {
              globalScope.history.pushState({}, '', currentUrl);
            }
            if (matchesUrl(urlExactMatch, currentUrl)) {
              if (
                !matchesUrl([redirectUrl], currentUrl) &&
                currentUrl !== referrerUrl
              ) {
                globalScope.location.replace(redirectUrl);
              } else {
                // if in preview mode, strip query params
                if (variant.metadata?.previewMode) {
                  globalScope.history.pushState({}, '', currentUrl);
                }
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
  }
};
