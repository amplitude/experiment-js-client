import { CampaignParser } from '@amplitude/analytics-core';
import { CookieStorage } from '@amplitude/analytics-core';
import { MKTG } from '@amplitude/analytics-core';
import type { Campaign } from '@amplitude/analytics-core';

/**
 * Utility function to generate and set marketing cookie
 * Parses current campaign data from URL and referrer, then stores it in the marketing cookie
 */
export async function setMarketingCookie(apiKey: string) {
  const storage = new CookieStorage<Campaign>({
    expirationDays: 365,
    sameSite: 'Lax',
  });

  const parser = new CampaignParser();
  const storageKey = `AMP_${apiKey.substring(0, 10)}_ORIGINAL_${MKTG}`;
  const campaign = await parser.parse();
  await storage.set(storageKey, campaign);
}
