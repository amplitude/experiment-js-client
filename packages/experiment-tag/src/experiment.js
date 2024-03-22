import { Experiment } from '@amplitude/experiment-js-client';

import { CookieStorage } from './cookieStorage';
import {
  getGlobalScope,
  getUrlParams,
  urlWithoutParamsAndAnchor,
  UUID,
} from './util';

const cookieStorageOptions = {
  expirationDays: 365,
  domain: '',
  secure: false,
  sameSite: 'Lax',
};
export const initializeExperiment = (apiKey, initialFlags) => {
  const globalScope = getGlobalScope();
  const cookieStorage = new CookieStorage(cookieStorageOptions);
  if (cookieStorage.isEnabled()) {
    const experimentCookieName = `EXP_${apiKey.slice(0, 10)}`;
    let user = cookieStorage.get(experimentCookieName);
    if (!user) {
      user = {};
      user.device_id = UUID();
      cookieStorage.set(experimentCookieName, user);
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
            // if at original url
            if (urlExactMatch.includes(currentUrl)) {
              const redirectUrl = action?.data?.url;
              if (redirectUrl !== currentUrl) {
                globalScope.location.replace(redirectUrl);
              }
              // if no redirect is required
              else {
                globalScope.experiment.exposure(key);
              }
            }
            // if at redirected url
            else if (urlExactMatch.includes(referrerUrl)) {
              globalScope.experiment.exposure(key);
            }
          }
        }
      }
    }
  }
};
