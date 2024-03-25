import { Experiment } from '@amplitude/experiment-js-client';

import {
  getGlobalScope,
  getUrlParams,
  isLocalStorageAvailable,
  matchesUrl,
  urlWithoutParamsAndAnchor,
  UUID,
} from './util';

export const initializeExperiment = (apiKey, initialFlags) => {
  const globalScope = getGlobalScope();
  const experimentStorageName = `EXP_${apiKey.slice(0, 10)}`;
  if (isLocalStorageAvailable()) {
    let user = JSON.parse(
      globalScope.localStorage.getItem(experimentStorageName),
    );
    if (!user) {
      user = {};
      user.device_id = UUID();
      globalScope.localStorage.setItem(
        experimentStorageName,
        JSON.stringify(user),
      );
    }
    const urlParams = getUrlParams();
    // if we are in preview mode, overwrite segments in initialFlags
    const parsedFlags = JSON.parse(initialFlags);
    parsedFlags.map((flag) => {
      if (flag.key in urlParams && urlParams[flag.key] in flag.variants) {
        flag.segments = [
          {
            metadata: {
              segmentName: 'All Other Users',
            },
            variant: urlParams[flag.key],
          },
        ];
      }
      return flag;
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
            // if at original url
            if (matchesUrl(urlExactMatch, currentUrl)) {
              if (!matchesUrl([redirectUrl], currentUrl)) {
                globalScope.location.replace(redirectUrl);
              }
              // if no redirect is required
              else {
                globalScope.experiment.exposure(key);
              }
            }
            // if at redirected url
            else if (
              matchesUrl(urlExactMatch, referrerUrl) &&
              matchesUrl([redirectUrl], currentUrl)
            ) {
              globalScope.experiment.exposure(key);
            }
          }
        }
      }
    }
  }
};
