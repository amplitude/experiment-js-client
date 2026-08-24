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

import { consentGate } from './consent-gate';

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
 * grouping is documentation only — it does not drive any logic.
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
      // transport. REDIRECT_MARKER is the stick-detector record from WEB-228.
      feature: 'redirect impressions',
      sessionStorage: [`EXP_${slice}_REDIRECT`, `EXP_${slice}_REDIRECT_MARKER`],
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
      // the page.
      feature: 'exposure queue and dedupe',
      localStorage: [`EXP_unsent_${instanceName}`],
      // v1/v2 keys: denial-at-load never constructs SessionDedupeCache, so
      // leftover entries from a tab open across an SDK upgrade would otherwise
      // survive a refusal.
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
 * consent is denied at load and on mid-session revocation.
 *
 * Cookies are deleted at the host scope and at every candidate root domain:
 * the writability probe that picked the domain at write time can resolve
 * differently now, and deleting an unused domain is a no-op. No probe is made
 * here, so cleanup never sets a cookie while consent is denied.
 *
 * Known gap: the relay iframe's CDN-origin localStorage can't be reached from
 * the parent page. The relay is only injected after a grant, so that data
 * exists only for consented visitors.
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
 * respawn it: the sweep reaches only this origin's localStorage, and without
 * the marker another origin's local `EXP_<slice>` seed would re-establish the
 * erased identity. The payload is just `1` — no timestamp or identifier — and
 * goes to the first root domain that accepts it (verified by read-back, not a
 * probe cookie, which would be a second write).
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
 * Carries an erasure across to this origin — see {@link markIdentityErased}.
 * Must run before the caller reads any persisted state, since caches hydrate
 * into memory at construction and would survive the sweep.
 *
 * Sweeps only when the marker is set AND the shared identity cookie is gone —
 * the respawn case. A present cookie means an identity established since the
 * erasure is in use and wins over local seeds. Runs regardless of whether
 * gating is still enabled: a refusal has to outlive the customer turning the
 * feature off.
 */
export const clearIfErasedElsewhere = (
  apiKey: string,
  instanceName?: string,
): void => {
  if (readRawCookie(erasureMarkerKey(apiKey)) === undefined) return;
  if (readRawCookie(identityCookieKey(apiKey)) !== undefined) return;
  clearAllPersistedData(apiKey, instanceName);
};

/**
 * Arms the denial cleanup against the current manager, once. Called from
 * `initialize` because the sweep needs its apiKey. Lives here rather than in
 * `consent-gate.ts` to avoid a circular import with the storage utilities.
 *
 * The immediate sweep covers a denial that resolved before this point; the
 * listener registered after it covers later revocations without double-firing
 * on the transition that just happened.
 */
export const armDenialCleanup = (
  apiKey: string,
  instanceName?: string,
): void => {
  if (consentGate.cleanupArmedManager === consentGate.manager) {
    return;
  }
  consentGate.cleanupArmedManager = consentGate.manager;
  const clearData = () => {
    clearAllPersistedData(apiKey, instanceName);
    // The sweep is origin-local; the marker is what crosses subdomains.
    markIdentityErased(apiKey);
  };
  if (consentGate.manager.getStatus() === 'denied') {
    clearData();
  }
  consentGate.manager.onChange((status) => {
    if (status === 'denied') {
      clearData();
    }
  });
};
