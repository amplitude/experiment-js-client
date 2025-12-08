import { CampaignParser } from '@amplitude/analytics-core';
import { CookieStorage } from '@amplitude/analytics-core';
import { MKTG } from '@amplitude/analytics-core';
import type { Campaign } from '@amplitude/analytics-core';

/**
 * Utility function to generate and set marketing cookie
 * Parses current campaign data from URL and referrer, then stores it in the marketing cookie
 * @param apiKey - The API key used to generate the storage key
 * @param domain - Cookie domain (e.g., result from getCookieDomain)
 */
export async function setMarketingCookie(
  apiKey: string,
  domain: string | undefined,
) {
  const storage = new CookieStorage<Campaign>({
    sameSite: 'Lax',
    ...(domain && { domain }),
  });

  const parser = new CampaignParser();
  const storageKey = `AMP_${MKTG}_ORIGINAL_${apiKey.substring(0, 10)}`;
  const campaign = await parser.parse();
  await storage.set(storageKey, campaign);
}
