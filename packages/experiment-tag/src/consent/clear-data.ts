import { MKTG } from '@amplitude/analytics-core';
import { getGlobalScope } from '@amplitude/experiment-core';

import {
  deleteRawCookie,
  getCookieDomainLevels,
  readRawCookie,
  writeRawCookie,
} from '../util/cookie';
import { removeStorageItem } from '../util/storage';
import { identityCookieKey } from '../util/storage-keys';

/** Mirrors `Defaults.instanceName` in experiment-browser. */
const DEFAULT_INSTANCE_NAME = '$default_instance';

/**
 * The `internalInstanceNameSuffix` experiment-tag passes to
 * `Experiment.initialize`. experiment-browser appends it to `instanceName` when
 * namespacing its variant, flag, and options caches.
 */
const WEB_INSTANCE_SUFFIX = 'web';

export interface PersistedDataKeys {
  localStorage: string[];
  sessionStorage: string[];
  cookies: string[];
}

/** @see markIdentityErased */
const erasureMarkerKey = (apiKey: string): string =>
  `EXP_${apiKey.slice(0, 10)}_erased`;

/** A year, matching the identity cookie this marker guards. */
const ERASURE_MARKER_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * One feature's persisted footprint: every key it writes, per store. The
 * `feature` label names the writer — the groups exist so that each key is
 * explained by what persists it, not to drive any logic.
 */
interface PersistedDataGroup {
  feature: string;
  localStorage?: string[];
  sessionStorage?: string[];
  cookies?: string[];
}

/**
 * Everything experiment-tag (and the browser SDK underneath it) can persist
 * for `apiKey`, grouped by the feature that writes it.
 *
 * Keys are reconstructed from their writers' inputs rather than matched by
 * prefix: an `EXP_*` or `amp-exp-*` sweep would also take a second apiKey's
 * data, another Amplitude product's, or analytics-browser's `AMP_MKTG_*` cookie,
 * which experiment-tag only ever reads.
 *
 * The erasure marker is deliberately absent; it has to outlive the sweep that
 * writes it. See {@link markIdentityErased}.
 */
const getPersistedDataGroups = (
  apiKey: string,
  instanceName: string,
): PersistedDataGroup[] => {
  const slice = apiKey.slice(0, 10);
  // Note the two apiKey slices differ — the `EXP_<slice>` family uses the
  // first ten characters, experiment-browser's caches the last six.
  const cacheNamespace = `amp-exp-${instanceName}-${WEB_INSTANCE_SUFFIX}-${apiKey.slice(
    -6,
  )}`;
  return [
    {
      // Per-origin localStorage seed + cross-subdomain root-domain cookie.
      feature: 'identity',
      localStorage: [`EXP_${slice}`],
      cookies: [identityCookieKey(apiKey)],
    },
    {
      // One key split across both stores: `first_seen` in localStorage,
      // `landing_url` in sessionStorage. Clearing one leaves landing-page
      // attribution behind.
      feature: 'default user provider',
      localStorage: [`EXP_${slice}_DEFAULT_USER_PROVIDER`],
      sessionStorage: [`EXP_${slice}_DEFAULT_USER_PROVIDER`],
    },
    {
      feature: 'behavioral targeting',
      localStorage: [`EXP_${slice}_rtbt_events`],
      cookies: [`EXP_${slice}_rtbt_session`],
    },
    {
      feature: 'marketing attribution',
      localStorage: [`EXP_${MKTG}_${slice}`],
      cookies: [`AMP_${MKTG}_ORIGINAL_${slice}`],
    },
    {
      // In-flight redirect impressions; the cookie copy is the cross-subdomain
      // transport.
      feature: 'redirect impressions',
      sessionStorage: [`EXP_${slice}_REDIRECT`],
      cookies: [`EXP_${slice}_REDIRECT`],
    },
    {
      feature: 'experiment-browser variant/flag caches',
      sessionStorage: [
        cacheNamespace,
        `${cacheNamespace}-flags`,
        `${cacheNamespace}-variants-options`,
      ],
    },
    {
      // Namespaced by the bare instanceName, so shared with any non-web
      // Experiment SDK on the page under the same name. Deleting the queue
      // discards that instance's queued exposures too — accepted: a visitor
      // who denied consent shouldn't have queued exposures from any SDK on
      // the page. Dedupe keys cover every version, not just the current one:
      // SessionDedupeCache drops the older two when constructed, and a denial
      // at load never constructs a client — so an entry from an earlier SDK
      // version would outlive the denial for the tab.
      feature: 'exposure queue and dedupe',
      localStorage: [`EXP_unsent_${instanceName}`],
      sessionStorage: [
        `EXP_sent_v3_${instanceName}`,
        `EXP_sent_v2_${instanceName}`,
        `EXP_sent_${instanceName}`,
      ],
    },
  ];
};

/**
 * The per-feature groups from {@link getPersistedDataGroups}, flattened to one
 * key list per store for the sweep.
 */
export const getPersistedDataKeys = (
  apiKey: string,
  instanceName: string = DEFAULT_INSTANCE_NAME,
): PersistedDataKeys => {
  const groups = getPersistedDataGroups(apiKey, instanceName);
  return {
    localStorage: groups.flatMap((group) => group.localStorage ?? []),
    sessionStorage: groups.flatMap((group) => group.sessionStorage ?? []),
    cookies: groups.flatMap((group) => group.cookies ?? []),
  };
};

/**
 * Deletes everything experiment-tag has persisted for `apiKey`. Runs when
 * consent is denied at load — where the data belongs to an earlier session, or
 * predates the customer enabling consent gating — and on mid-session
 * revocation.
 *
 * This clears what earlier sessions left behind; it does not stop the current
 * one. A running client is unaware of consent — nothing outside `index.ts` reads
 * the status — so after a revocation it can re-persist some of these keys before
 * the page is reloaded.
 *
 * Cookies are deleted at the host scope and at every candidate root domain: the
 * writers pick between them via a writability probe whose result can differ from
 * the one that applied at write time, and deleting an unused domain is a no-op.
 * This path makes no probe of its own, so cleanup never sets a cookie while
 * consent is denied.
 *
 * Known gap: the relay iframe's CDN-origin localStorage can't be reached from
 * the parent page. The relay is only injected after a grant, so that data exists
 * only for consented visitors.
 */
export const clearAllPersistedData = (
  apiKey: string,
  instanceName?: string,
): void => {
  const keys = getPersistedDataKeys(apiKey, instanceName);

  for (const key of keys.localStorage) {
    removeStorageItem('localStorage', key);
  }
  for (const key of keys.sessionStorage) {
    removeStorageItem('sessionStorage', key);
  }

  const hostname = getGlobalScope()?.location?.hostname ?? '';
  const domains = getCookieDomainLevels(hostname).map((domain) => `.${domain}`);
  for (const key of keys.cookies) {
    deleteRawCookie(key);
    for (const domain of domains) {
      deleteRawCookie(key, domain);
    }
  }
};

/**
 * Records that the shared identity was erased, so a sibling subdomain cannot
 * respawn it. The sweep reaches only this origin's localStorage, and identity
 * resolution seeds from the per-origin `EXP_<slice>` record once the shared cookie
 * is gone — so without this marker, whichever origin the visitor next opts in on
 * decides whether the refusal held.
 *
 * Written *after* a refusal, so the payload is `1`: no timestamp, no identifier,
 * justified only by making that refusal effective. It goes to the first root
 * domain that accepts it, verified by `writeRawCookie`'s read-back rather than a
 * probe cookie, which would be a second write. Hosts with no writable root domain
 * (single-label, IPs) share nothing across origins, so none is written.
 */
export const markIdentityErased = (apiKey: string): void => {
  const hostname = getGlobalScope()?.location?.hostname ?? '';
  for (const domain of getCookieDomainLevels(hostname)) {
    const written = writeRawCookie(erasureMarkerKey(apiKey), '1', {
      domain: `.${domain}`,
      maxAgeSeconds: ERASURE_MARKER_MAX_AGE_SECONDS,
    });
    if (written) {
      return;
    }
  }
};

/**
 * Carries an erasure across to this origin — see {@link markIdentityErased}. Must
 * run before its caller reads any persisted state: variant/flag caches and
 * behavioral events hydrate into memory at construction, and copies already
 * loaded survive this sweep and can be written back under the fresh identity.
 *
 * Both conditions matter. No marker means nothing to carry over; a shared identity
 * cookie means an identity established since the erasure is already in use and
 * wins over every local seed. Marker set with the cookie gone is exactly the
 * respawn case, and there the local records are worthless anyway — this origin is
 * about to mint a fresh identity regardless.
 *
 * Whether consent gating is still switched on is not consulted: the marker only
 * exists because a visitor refused, and that refusal has to outlive a customer
 * turning the feature off.
 */
export const clearIfErasedElsewhere = (
  apiKey: string,
  instanceName?: string,
): void => {
  if (readRawCookie(erasureMarkerKey(apiKey)) === undefined) return;
  if (readRawCookie(identityCookieKey(apiKey)) !== undefined) return;
  clearAllPersistedData(apiKey, instanceName);
};
