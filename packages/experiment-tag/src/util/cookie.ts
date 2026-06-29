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
 * Resolves several cross-subdomain fields from a single cookie, using cookie
 * storage as the authoritative source. Each field falls back to its `fallback`
 * value (migration path), then its generator. One read + at most one write;
 * cookie I/O failures degrade to the returned value. Callers are responsible
 * for mirroring values back to localStorage if needed.
 */
export async function resolveCrossSubdomainObject<
  T extends Record<string, string>,
>(
  cookieStorage: CookieStorage<string>,
  cookieKey: string,
  fallback: Partial<T>,
  generators: { [K in keyof T]: () => string },
): Promise<T> {
  let current: Partial<T> = {};
  try {
    // Missing cookie (`undefined`) and malformed JSON both fall back to {}.
    const parsed = JSON.parse((await cookieStorage.get(cookieKey)) || '{}');
    if (parsed && typeof parsed === 'object') current = parsed;
  } catch {
    /* re-seed below */
  }

  const resolved = {} as T;
  let changed = false;
  for (const key of Object.keys(generators) as (keyof T)[]) {
    const existing = current[key];
    if (typeof existing === 'string' && existing) {
      resolved[key] = existing as T[keyof T];
    } else {
      resolved[key] = (fallback[key] ?? generators[key]()) as T[keyof T];
      changed = true;
    }
  }

  if (changed) {
    try {
      await cookieStorage.set(cookieKey, JSON.stringify(resolved));
    } catch {
      /* write blocked: persist via returned value only */
    }
  }
  return resolved;
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
