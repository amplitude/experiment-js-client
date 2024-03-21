import { Experiment } from '@amplitude/experiment-js-client';

import { CookieStorage } from './cookieStorage';
import {
  getFlagToVariantsMapping,
  getGlobalScope,
  getUrlParams,
  urlWithoutParams,
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
    // prioritize the experiment cookie over the analytics cookie
    let user = cookieStorage.get(experimentCookieName);
    if (!user) {
      user = {};
      user.deviceId = UUID();
      cookieStorage.set(experimentCookieName, user);
    }

    // Proceed with initializing and using the Experiment SDK
    const urlParams = getUrlParams();
    const forcedVariantKey = urlParams['variant'];
    const forcedFlagKey = urlParams['flag'];
    // if we are in preview mode, overwrite segments in initialFlags
    if (
      getFlagToVariantsMapping(initialFlags)?.[forcedFlagKey]?.[
        forcedVariantKey
      ]
    ) {
      const parsedFlags = JSON.parse(initialFlags);
      parsedFlags.map((flag) => {
        if (flag.key === forcedFlagKey) {
          flag.segments = [
            {
              metadata: {
                segmentName: 'All Other Users',
              },
              variant: forcedVariantKey,
            },
          ];
        }
        return flag;
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
      if (Array.isArray(variant?.payload)) {
        for (const action of variant.payload) {
          if (action.action === 'redirect') {
            const urlExactMatch = variant?.metadata?.['urlMatch'];
            const currentUrl = urlWithoutParams(globalScope.location.href);
            const referrerUrl = urlWithoutParams(globalScope.document.referrer);
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
