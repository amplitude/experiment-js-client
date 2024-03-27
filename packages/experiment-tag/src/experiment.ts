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
    let user = JSON.parse(
      globalScope.localStorage.getItem(experimentStorageName) || '{}',
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
    const parsedFlags = JSON.parse(initialFlags) as any[];

    parsedFlags.forEach((flag) => {
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

            if (matchesUrl(urlExactMatch, currentUrl)) {
              if (
                !matchesUrl([redirectUrl], currentUrl) &&
                currentUrl !== referrerUrl
              ) {
                globalScope.location.replace(redirectUrl);
              } else {
                globalScope.experiment.exposure(key);
              }
            } else if (
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
