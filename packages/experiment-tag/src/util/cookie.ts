import { CampaignParser } from '@amplitude/analytics-core';
import { CookieStorage } from '@amplitude/analytics-core';
import { MKTG } from '@amplitude/analytics-core';
import type { Campaign } from '@amplitude/analytics-core';

const KNOWN_2LDS = [
  'ac.in',
  'ac.jp',
  'ac.kr',
  'ac.th',
  'ac.uk',
  'ac.za',
  'appspot.com',
  'asn.au',
  'azurewebsites.net',
  'blogspot.com',
  'cloudfront.net',
  'co.ca',
  'co.in',
  'co.jp',
  'co.kr',
  'co.nz',
  'co.th',
  'co.uk',
  'co.za',
  'com.ar',
  'com.au',
  'com.br',
  'com.cn',
  'com.hk',
  'com.in',
  'com.jp',
  'com.kr',
  'com.mx',
  'com.pl',
  'com.sg',
  'com.tr',
  'com.tw',
  'ed.jp',
  'edu.au',
  'edu.br',
  'edu.cn',
  'edu.hk',
  'edu.sg',
  'edu.th',
  'edu.tr',
  'edu.tw',
  'firebaseapp.com',
  'fly.dev',
  'gc.ca',
  'geek.nz',
  'github.io',
  'gitlab.io',
  'go.jp',
  'go.kr',
  'go.th',
  'gob.ar',
  'gob.mx',
  'gov.au',
  'gov.br',
  'gov.cn',
  'gov.hk',
  'gov.in',
  'gov.pl',
  'gov.sg',
  'gov.tr',
  'gov.tw',
  'gov.uk',
  'gov.za',
  'govt.nz',
  'gr.jp',
  'herokuapp.com',
  'id.au',
  'idv.hk',
  'iwi.nz',
  'lg.jp',
  'ltd.uk',
  'maori.nz',
  'me.uk',
  'mil.kr',
  'myshopify.com',
  'ne.jp',
  'ne.kr',
  'net.au',
  'net.br',
  'net.cn',
  'net.hk',
  'net.in',
  'net.nz',
  'net.pl',
  'net.sg',
  'net.tr',
  'net.tw',
  'net.za',
  'netlify.app',
  'onrender.com',
  'or.jp',
  'or.kr',
  'or.th',
  'org.ar',
  'org.au',
  'org.br',
  'org.cn',
  'org.hk',
  'org.in',
  'org.mx',
  'org.nz',
  'org.pl',
  'org.sg',
  'org.tw',
  'org.uk',
  'org.za',
  'pages.dev',
  'pe.kr',
  'plc.uk',
  're.kr',
  'res.in',
  'sch.uk',
  'vercel.app',
  'workers.dev',
];

let cachedDomain: string | undefined;

/**
 * Synchronously probes whether a cookie can be written to `.<domain>` by
 * setting a throwaway cookie and reading it back via `document.cookie`.
 */
function isDomainWritableSync(domain: string): boolean {
  if (typeof document === 'undefined') return false;
  const testKey = `AMP_TLD_TEST_${Date.now()}`;
  try {
    document.cookie = `${testKey}=1; domain=.${domain}; path=/; SameSite=Lax`;
    const written = document.cookie.indexOf(`${testKey}=`) !== -1;
    // Clean up the probe cookie regardless of the result.
    document.cookie = `${testKey}=; domain=.${domain}; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    return written;
  } catch {
    return false;
  }
}

/**
 * Synchronous variant of {@link getTopLevelDomain}. Resolves the registrable
 * (root) domain for `hostname` so callers can set a cookie shared across
 * subdomains, without the async `CookieStorage.isDomainWritable` round-trip.
 * Returns a leading-dot domain (e.g. `.example.com`) or `''` when no
 * cross-subdomain domain is writable (single-label hosts, IPs, blocked I/O).
 */
export function getTopLevelDomainSync(hostname: string): string {
  if (!hostname) return '';
  const normalizedHostname = hostname.toLowerCase();
  const parts = normalizedHostname.split('.');
  if (parts.length <= 1) return '';

  const skipLevel = KNOWN_2LDS.some((tld) =>
    normalizedHostname.endsWith(`.${tld}`),
  )
    ? 2
    : 1;
  const levels: string[] = [];
  for (let i = parts.length - skipLevel - 1; i >= 0; --i) {
    levels.push(parts.slice(i).join('.'));
  }
  for (const domain of levels) {
    if (isDomainWritableSync(domain)) {
      return '.' + domain;
    }
  }
  return '';
}

export async function getTopLevelDomain(hostname: string): Promise<string> {
  if (cachedDomain !== undefined) return cachedDomain;
  if (!hostname) {
    return (cachedDomain = '');
  }
  const normalizedHostname = hostname.toLowerCase();
  const parts = normalizedHostname.split('.');
  if (parts.length === 1) return (cachedDomain = '');

  const skipLevel = KNOWN_2LDS.some((tld) =>
    normalizedHostname.endsWith(`.${tld}`),
  )
    ? 2
    : 1;
  const levels: string[] = [];
  for (let i = parts.length - skipLevel - 1; i >= 0; --i) {
    levels.push(parts.slice(i).join('.'));
  }
  for (const domain of levels) {
    if (await CookieStorage.isDomainWritable(domain)) {
      return (cachedDomain = '.' + domain);
    }
  }
  return (cachedDomain = '');
}

/**
 * Resolves a cross-subdomain value using cookie storage as the authoritative
 * source. Falls back to a provided localStorage value (migration path), then
 * generates a new value if neither exists. Attempts to set the cookie when
 * missing; cookie I/O failures fall back to localStorage / generateNew.
 * Callers are responsible for syncing the returned value back to localStorage.
 */
export async function resolveCrossSubdomainValue(
  cookieStorage: CookieStorage<string>,
  cookieKey: string,
  localStorageValue: string | undefined,
  generateNew: () => string,
): Promise<string> {
  try {
    const cookieValue = await cookieStorage.get(cookieKey);
    if (cookieValue) {
      return cookieValue;
    }
  } catch {
    // Cookie read blocked; fall through to localStorage / generateNew.
  }
  const value = localStorageValue ?? generateNew();
  try {
    await cookieStorage.set(cookieKey, value);
  } catch {
    // Cookie write blocked; return value for localStorage-only persistence.
  }
  return value;
}

export async function setMarketingCookie(apiKey: string, hostname: string) {
  const domain = await getTopLevelDomain(hostname);
  const storage = new CookieStorage<Campaign>({
    sameSite: 'Lax',
    ...(domain && { domain }),
  });

  const parser = new CampaignParser();
  const storageKey = `AMP_${MKTG}_ORIGINAL_${apiKey.substring(0, 10)}`;
  const campaign = await parser.parse();
  await storage.set(storageKey, campaign);
}
