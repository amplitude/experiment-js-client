import {
  BASE_CAMPAIGN,
  type Campaign,
  CampaignParser,
  getStorageKey,
  MKTG,
} from '@amplitude/analytics-core';
import { UTMParameters } from '@amplitude/analytics-core/lib/esm/types/campaign';
import { type ExperimentUser } from '@amplitude/experiment-js-client';

import { isConsentWithheld } from '../consent/consent-gate';

import { readCookieStorageSync } from './cookie';
import { getStorageItem, setStorageItem } from './storage';

/**
 * Enriches the user object's userProperties with UTM parameters based on priority:
 * 1. URL params (highest priority)
 * 2. experiment-tag persisted props (medium priority)
 * 3. analytics-browser persisted props (lowest priority, if using default Amplitude Analytics integration)
 */
export function enrichUserWithCampaignData(
  apiKey: string,
  user: ExperimentUser,
): ExperimentUser {
  const experimentStorageKey = `EXP_${MKTG}_${apiKey.substring(0, 10)}`;
  const [currentCampaign, persistedAmplitudeCampaign] =
    fetchCampaignData(apiKey);
  const persistedExperimentCampaign = getStorageItem<UTMParameters>(
    'localStorage',
    experimentStorageKey,
  );

  // Filter out undefined values and non-UTM parameters
  const utmParams: Partial<UTMParameters> = {};
  const allCampaigns = [
    persistedAmplitudeCampaign, // lowest priority
    persistedExperimentCampaign, // medium prioirty
    currentCampaign, // highest priority
  ];

  for (const campaign of allCampaigns) {
    if (campaign) {
      for (const [key, value] of Object.entries(campaign)) {
        if (key.startsWith('utm_') && value !== undefined) {
          utmParams[key] = value;
        }
      }
    }
  }

  if (Object.keys(utmParams).length > 0) {
    persistUrlParams(apiKey, utmParams);
    return {
      ...user,
      persisted_url_param: utmParams,
    };
  }
  return user;
}

/**
 * Persists UTM parameters from the current URL to experiment-tag storage
 */
export function persistUrlParams(
  apiKey: string,
  campaign: Record<string, string>,
): void {
  const experimentStorageKey = `EXP_${MKTG}_${apiKey.substring(0, 10)}`;
  setStorageItem('localStorage', experimentStorageKey, campaign);
}

function fetchCampaignData(apiKey: string): [Campaign, Campaign | undefined] {
  const storageKey = getStorageKey(apiKey, MKTG);
  // CampaignParser.parse() only reads synchronous browser state (URL + referrer),
  // so its result is assembled here without the async wrapper.
  const parser = new CampaignParser();
  const currentCampaign: Campaign = {
    ...BASE_CAMPAIGN,
    ...parser.getUtmParam(),
    ...parser.getReferrer(),
    ...parser.getClickIds(),
  };
  // Mirror the async consent gate: a withheld visitor's prior campaign cookie
  // reads as absent. The cookie uses analytics-core's base64 wire format.
  const previousCampaign = isConsentWithheld()
    ? undefined
    : readCookieStorageSync<Campaign>(storageKey);
  return [currentCampaign, previousCampaign];
}
