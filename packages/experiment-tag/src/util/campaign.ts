import {
  Campaign,
  CampaignParser,
  CookieStorage,
  getStorageKey,
  MKTG,
} from '@amplitude/analytics-core';
import { ExperimentUser } from '@amplitude/experiment-js-client';

import { getStorageItem, setStorageItem } from './storage';

type UTMParams = Record<string, string>;

/**
 * Enriches the user object's userProperties with UTM parameters based on priority:
 * 1. URL params (highest priority)
 * 2. experiment-tag persisted props (medium priority)
 * 3. analytics-browser persisted props (lowest priority, if using default Amplitude Analytics integration)
 */
export async function enrichUserWithCampaignData(
  apiKey: string,
  user: ExperimentUser,
): Promise<ExperimentUser> {
  const experimentStorageKey = `EXP_${MKTG}_${apiKey.substring(0, 10)}`;
  const [currentCampaign, persistedAmplitudeCampaign] = await fetchCampaignData(
    apiKey,
  );
  const persistedExperimentCampaign = getStorageItem<UTMParams>(
    'localStorage',
    experimentStorageKey,
  );

  // Filter out undefined values and non-UTM parameters
  const utmParams: Record<string, string> = {};
  const allCampaigns = [
    persistedAmplitudeCampaign,
    persistedExperimentCampaign,
    currentCampaign,
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
    persistUrlUtmParams(apiKey, utmParams);
    return {
      ...user,
      persisted_utm_param: utmParams,
    };
  }
  return user;
}

/**
 * Persists UTM parameters from the current URL to experiment-tag storage
 */
export function persistUrlUtmParams(
  apiKey: string,
  campaign: Record<string, string>,
): void {
  const experimentStorageKey = `EXP_${MKTG}_${apiKey.substring(0, 10)}`;
  setStorageItem('localStorage', experimentStorageKey, campaign);
}

async function fetchCampaignData(
  apiKey: string,
): Promise<[Campaign, Campaign | undefined]> {
  const storage = new CookieStorage<Campaign>();
  const storageKey = getStorageKey(apiKey, MKTG);
  const currentCampaign = await new CampaignParser().parse();
  const previousCampaign = await storage.get(storageKey);
  return [currentCampaign, previousCampaign];
}
