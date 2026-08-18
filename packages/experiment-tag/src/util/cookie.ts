import {
  BASE_CAMPAIGN,
  CampaignParser,
  MKTG,
  decodeCookieValue,
} from '@amplitude/analytics-core';
import type { Campaign } from '@amplitude/analytics-core';

import {
  ConsentAwareCookieStorage,
  type SyncCookieStore,
} from '../consent/consent-cookie-storage';
import {
  isConsentPending,
  isConsentWithheld,
  onConsentDecision,
} from '../consent/consent-gate';

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

/**
 * Cross-subdomain cookie domain per hostname, so {@link getTopLevelDomainSync}
 * probes at most once per host. Keyed by hostname so a page (or a test file)
 * that touches more than one never crosses them.
 */
const cachedDomains: Record<string, string> = {};

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
 * Candidate cross-subdomain cookie domains for `hostname`, registrable domain
 * first (e.g. `['example.com', 'app.example.com']`). Empty for single-label
 * hosts and IPs, which can't carry a `.domain` cookie.
 *
 * Returned without the leading dot; callers add it.
 */
export function getCookieDomainLevels(hostname: string): string[] {
  if (!hostname) return [];
  const normalizedHostname = hostname.toLowerCase();
  const parts = normalizedHostname.split('.');
  if (parts.length <= 1) return [];

  const skipLevel = KNOWN_2LDS.some((tld) =>
    normalizedHostname.endsWith(`.${tld}`),
  )
    ? 2
    : 1;
  const levels: string[] = [];
  for (let i = parts.length - skipLevel - 1; i >= 0; --i) {
    levels.push(parts.slice(i).join('.'));
  }
  return levels;
}

/**
 * The cross-subdomain cookie domain for `hostname`: the first
 * {@link getCookieDomainLevels} entry that accepts one, as a leading-dot domain
 * (e.g. `.example.com`), or `''` when none does. Resolved synchronously by
 * probing `document.cookie`, cached per hostname.
 */
export function getTopLevelDomainSync(hostname: string): string {
  if (hostname in cachedDomains) return cachedDomains[hostname];
  for (const domain of getCookieDomainLevels(hostname)) {
    if (isDomainWritableSync(domain)) {
      return (cachedDomains[hostname] = '.' + domain);
    }
  }
  return (cachedDomains[hostname] = '');
}

/**
 * Resolves several cross-subdomain fields from a single cookie, synchronously,
 * so identity resolution stays off the async cookie-service round-trip on the
 * startup critical path. Each field falls back to its `fallback` value
 * (migration path), then its generator. One read + at most one write; cookie
 * I/O failures degrade to the returned value. Callers are responsible for
 * mirroring values back to localStorage if needed.
 */
export function resolveCrossSubdomainObject<T extends Record<string, string>>(
  cookieKey: string,
  fallback: Partial<T>,
  generators: { [K in keyof T]: () => string },
  options: { domain?: string; expirationDays?: number } = {},
): T {
  const storage = createCookieStorage<string>(options);
  let current: Partial<T> = {};
  try {
    // Missing cookie (`undefined`) and malformed JSON both fall back to {}.
    const parsed = JSON.parse(storage.get(cookieKey) || '{}');
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
    storage.set(cookieKey, JSON.stringify(resolved));
  }
  return resolved;
}

/** Reads a raw cookie value (URL-decoded) synchronously, or `undefined` if absent. */
export function readRawCookie(key: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const c of document.cookie ? document.cookie.split('; ') : []) {
    const eq = c.indexOf('=');
    if ((eq === -1 ? c : c.slice(0, eq)) !== key) continue;
    const v = eq === -1 ? '' : c.slice(eq + 1);
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return undefined;
}

/**
 * Writes a cookie (`Path=/; SameSite=Lax`, `Secure` on https), then verifies it
 * via read-back. Returns `false` on blocked cookie I/O (private mode, ITP, a
 * wrong domain) so callers can fall back to memory. No `maxAgeSeconds` ⇒ session.
 *
 * The read-back compares the decoded value, not just key presence: a silently
 * dropped write that leaves a stale same-key cookie (e.g. a host-only cookie
 * shadowing a failed `.domain` write) reports `false` so the caller serves its
 * fresh in-memory value instead of a stale payload.
 */
export function writeRawCookie(
  key: string,
  value: string,
  options: { domain?: string; maxAgeSeconds?: number } = {},
): boolean {
  if (typeof document === 'undefined') return false;
  const { domain, maxAgeSeconds } = options;
  try {
    document.cookie =
      `${key}=${encodeURIComponent(value)}; path=/; SameSite=Lax` +
      (domain ? `; domain=${domain}` : '') +
      (maxAgeSeconds !== undefined ? `; max-age=${maxAgeSeconds}` : '') +
      (location?.protocol === 'https:' ? '; Secure' : '');
    return readRawCookie(key) === value;
  } catch {
    return false;
  }
}

/** Best-effort delete (must match the domain the cookie was written with). */
export function deleteRawCookie(key: string, domain?: string): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie =
      `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT` +
      (domain ? `; domain=${domain}` : '');
  } catch {
    /* best-effort */
  }
}

/**
 * Synchronous, format-compatible read of a value written by analytics-core's
 * `CookieStorage` (base64 of URL-encoded JSON). Mirrors `CookieStorage.get`
 * without the async Cookie Store API round-trip so it can run on the startup
 * critical path. Returns `undefined` when the cookie is absent or undecodable.
 */
export function readCookieStorageSync<T>(key: string): T | undefined {
  try {
    const raw = readRawCookie(key);
    // Base64 has no `%`, so `readRawCookie`'s URL-decode is a no-op on the payload.
    if (raw === undefined) return undefined;
    const decoded = decodeCookieValue(raw);
    if (decoded === undefined) return undefined;
    return JSON.parse(decoded) as T;
  } catch {
    return undefined;
  }
}

/**
 * Synchronous write in analytics-core's base64 format of URL-encoded JSON
 * Copy of its `CookieStorage.prototype.setSync` logic since it's not exported
 */
export function writeCookieStorageSync<T>(
  key: string,
  value: T,
  options: {
    domain?: string;
    sameSite?: string;
    expirationDays?: number;
  } = {},
): void {
  if (typeof document === 'undefined') return;
  try {
    let cookie = `${key}=${btoa(encodeURIComponent(JSON.stringify(value)))}`;
    if (options.expirationDays) {
      const expires = new Date();
      expires.setTime(
        expires.getTime() + options.expirationDays * 24 * 60 * 60 * 1000,
      );
      cookie += `; expires=${expires.toUTCString()}`;
    }
    cookie += '; path=/';
    if (options.domain) cookie += `; domain=${options.domain}`;
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
    document.cookie = cookie;
  } catch {
    /* blocked cookie I/O degrades silently */
  }
}

/** Cookie-backed {@link SyncCookieStore}, in analytics-core's wire format. */
type CookieStorageOptions = {
  domain?: string;
  sameSite?: string;
  expirationDays?: number;
};

const documentCookieStore = <T>(
  options: CookieStorageOptions = {},
): SyncCookieStore<T> => ({
  get: (key) => readCookieStorageSync<T>(key),
  set: (key, value) =>
    writeCookieStorageSync<T>(key, value, { sameSite: 'Lax', ...options }),
  remove: (key) => deleteRawCookie(key, options.domain),
});

/**
 * The single consent-gated cookie store every experiment-tag call site should
 * use, so a new one cannot silently bypass the consent gate. Reads and writes
 * are synchronous (`document.cookie`); the gate buffers pending writes and
 * flushes them on grant.
 */
export const createCookieStorage = <T>(
  options: CookieStorageOptions = {},
): SyncCookieStore<T> =>
  new ConsentAwareCookieStorage<T>(documentCookieStore<T>(options));

/**
 * Synchronous two-tier (cookie → in-memory) JSON store. The cookie is the
 * cross-tab / cross-subdomain source of truth; if writes are blocked (detected
 * via {@link writeRawCookie}'s read-back) it degrades to a per-page value. The
 * domain is read lazily per write so it can be resolved after construction.
 */
export class SyncJsonCookie<T> {
  private usable?: boolean;
  private memory?: T;
  private consentFlushArmed = false;

  constructor(
    private readonly key: string,
    private readonly getDomain: () => string,
    private readonly options: {
      maxAgeSeconds?: number;
      /** Validates/normalizes a parsed payload; return undefined to reject it. */
      validate?: (value: unknown) => T | undefined;
    } = {},
  ) {}

  read(): T | undefined {
    // Without consent the cookie is treated as absent: the memory tier is the
    // only source, so nothing an earlier consented session left behind is read
    // back.
    if (!isConsentWithheld() && this.usable !== false) {
      const raw = readRawCookie(this.key);
      const parsed = raw !== undefined ? this.parse(raw) : undefined;
      if (parsed !== undefined) return parsed;
    }
    return this.memory;
  }

  write(value: T): void {
    this.memory = value;
    if (isConsentWithheld()) {
      // The memory tier already holds the value, and this class degrades to it
      // whenever the cookie is unavailable — so a withheld write needs no buffer
      // of its own. Only a pending one is worth arming a flush for; after refusal
      // the value simply stays in memory for the life of the page.
      if (isConsentPending()) {
        this.armConsentFlush();
      }
      return;
    }
    this.usable =
      typeof document !== 'undefined' &&
      this.usable !== false &&
      writeRawCookie(this.key, JSON.stringify(value), {
        domain: this.getDomain() || undefined,
        maxAgeSeconds: this.options.maxAgeSeconds,
      });
  }

  clear(): void {
    this.memory = undefined;
    if (isConsentPending()) {
      // Nothing of ours is out there to delete, and issuing the expiry would be
      // a cookie write in its own right. Refusal deliberately falls through, so
      // denial cleanup can still erase a cookie from a consented visit.
      return;
    }
    deleteRawCookie(this.key, this.getDomain() || undefined);
  }

  /**
   * Promotes the deferred value to a cookie on grant. Writing the same value
   * rather than a fresh one is what keeps the session id the visitor already had
   * while consent was pending, instead of rotating it at the moment of grant.
   */
  private armConsentFlush(): void {
    if (this.consentFlushArmed) {
      return;
    }
    this.consentFlushArmed = true;
    onConsentDecision((granted) => {
      if (granted && this.memory !== undefined) {
        this.write(this.memory);
      }
    });
  }

  private parse(raw: string): T | undefined {
    try {
      const data = JSON.parse(raw);
      return this.options.validate ? this.options.validate(data) : (data as T);
    } catch {
      return undefined;
    }
  }
}

export function setMarketingCookie(apiKey: string, hostname: string): void {
  const domain = getTopLevelDomainSync(hostname);
  const storage = createCookieStorage<Campaign>({
    sameSite: 'Lax',
    ...(domain && { domain }),
  });

  const parser = new CampaignParser();
  const storageKey = `AMP_${MKTG}_ORIGINAL_${apiKey.substring(0, 10)}`;
  const campaign: Campaign = {
    ...BASE_CAMPAIGN,
    ...parser.getUtmParam(),
    ...parser.getReferrer(),
    ...parser.getClickIds(),
  };
  storage.set(storageKey, campaign);
}
