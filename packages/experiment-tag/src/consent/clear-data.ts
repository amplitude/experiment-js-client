import { MKTG } from '@amplitude/analytics-core';
import { getGlobalScope } from '@amplitude/experiment-core';

import {
  deleteRawCookie,
  getCookieDomainLevels,
  readRawCookie,
  writeRawCookie,
} from '../util/cookie';
import { removeStorageItem } from '../util/storage';

/** Mirrors `Defaults.instanceName` in experiment-browser. */
const DEFAULT_INSTANCE_NAME = '$default_instance';

/**
 * The `internalInstanceNameSuffix` experiment-tag passes to
 * `Experiment.initialize`. experiment-browser appends it to `instanceName` when
 * namespacing its variant, flag, and options caches, so those keys are specific
 * to web experiments.
 */
const WEB_INSTANCE_SUFFIX = 'web';

export interface PersistedDataKeys {
  localStorage: string[];
  sessionStorage: string[];
  cookies: string[];
}

/**
 * Root-domain cookie holding the cross-subdomain `web_exp_id_v2`. Shared with
 * the writer in `experiment.ts` rather than spelled twice: if the two spellings
 * drifted, {@link clearIfErasedElsewhere} would read a key that never exists,
 * read every start as "identity absent", and sweep the visitor's fresh identity
 * on every page load.
 */
export const identityCookieKey = (apiKey: string): string =>
  `EXP_${apiKey.slice(0, 10)}_identity`;

/** @see markIdentityErased */
const erasureMarkerKey = (apiKey: string): string =>
  `EXP_${apiKey.slice(0, 10)}_erased`;

/** A year, matching the identity cookie this marker guards. */
const ERASURE_MARKER_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * Every storage key and cookie experiment-tag (and the browser SDK underneath
 * it) can persist for `apiKey`.
 *
 * Keys are reconstructed from the same inputs their writers use rather than
 * matched by prefix. A sweep of `EXP_*` or `amp-exp-*` would also delete a
 * second apiKey's data, or another Amplitude product's, on a shared domain —
 * and analytics-browser's own `AMP_MKTG_*` campaign cookie, which experiment-tag
 * only ever reads.
 *
 * The two apiKey slices are not the same: the `EXP_<slice>` family uses the
 * first ten characters, while experiment-browser's caches use the last six.
 *
 * The erasure marker is deliberately absent: it is written by the refusal and
 * has to outlive the sweep that writes it. See {@link markIdentityErased}.
 */
export const getPersistedDataKeys = (
  apiKey: string,
  instanceName: string = DEFAULT_INSTANCE_NAME,
): PersistedDataKeys => {
  const slice = apiKey.slice(0, 10);
  const cacheNamespace = `amp-exp-${instanceName}-${WEB_INSTANCE_SUFFIX}-${apiKey.slice(
    -6,
  )}`;
  return {
    localStorage: [
      `EXP_${slice}`,
      `EXP_${slice}_DEFAULT_USER_PROVIDER`,
      `EXP_${slice}_rtbt_events`,
      `EXP_${MKTG}_${slice}`,
      // Namespaced by the bare instanceName, so this is shared with any
      // separately initialized (non-web) Experiment SDK on the page using the
      // same instance name. Deleting it can discard that instance's queued
      // exposures too — accepted, since a visitor who denied consent shouldn't
      // have queued exposures from any SDK on the page.
      `EXP_unsent_${instanceName}`,
    ],
    sessionStorage: [
      // Same key as the localStorage entry above, deliberately: DefaultUserProvider
      // splits one key across both stores — `first_seen` in localStorage,
      // `landing_url` in sessionStorage. Clearing only one leaves landing-page
      // attribution behind.
      `EXP_${slice}_DEFAULT_USER_PROVIDER`,
      `EXP_${slice}_REDIRECT`,
      cacheNamespace,
      `${cacheNamespace}-flags`,
      `${cacheNamespace}-variants-options`,
      // Shared with co-resident SDK instances, as above. Every version, not just
      // the current one: SessionDedupeCache drops the older two as it is
      // constructed, and a denial at load never constructs a client — so an entry
      // written under an earlier SDK version would outlive the denial for the tab.
      `EXP_sent_v3_${instanceName}`,
      `EXP_sent_v2_${instanceName}`,
      `EXP_sent_${instanceName}`,
    ],
    cookies: [
      identityCookieKey(apiKey),
      `EXP_${slice}_rtbt_session`,
      `EXP_${slice}_REDIRECT`,
      `AMP_${MKTG}_ORIGINAL_${slice}`,
    ],
  };
};

/**
 * Deletes everything experiment-tag has persisted for `apiKey`. Runs when
 * consent is denied at load — where the data belongs to an earlier session, or
 * predates the customer enabling consent gating — and on mid-session
 * revocation.
 *
 * How much a sweep buys differs between the two. Denied at load, no client is
 * ever constructed, so nothing rewrites what this removes. On a mid-session
 * revocation the running client is unaware of consent — nothing outside
 * `index.ts` reads the status — so it keeps evaluating and tracking and can
 * re-persist some of these keys before the page is reloaded. The sweep clears
 * what earlier sessions left behind; it does not stop the current one.
 *
 * Cookies are deleted at the host scope and at every candidate root domain,
 * because the writers choose between them based on a writability probe whose
 * result can differ from the one that applied when the cookie was written.
 * Deleting at a domain that was never used is a no-op, so the extra attempts
 * only widen coverage. Unlike the write path this makes no probe of its own,
 * so cleanup never sets a cookie while consent is denied.
 *
 * Known gap: the relay iframe's CDN-origin localStorage is cross-origin and
 * can't be cleared from the parent page. The relay is only injected after a
 * grant, so that data exists only for consented visitors.
 */
export const clearAllPersistedData = (
  apiKey: string,
  options: { instanceName?: string } = {},
): void => {
  const keys = getPersistedDataKeys(apiKey, options.instanceName);

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
 * Records that the shared identity was erased, so no sibling subdomain can seed
 * a new identity cookie from the copy it still holds.
 *
 * `resolveCrossSubdomainObject` treats the root-domain identity cookie as
 * authoritative and falls back to the per-origin `EXP_<slice>` record as a
 * migration seed. The sweep above deletes both — but only this origin's
 * localStorage, which is all it can reach. Consent is shared across subdomains,
 * so a sibling sweeps itself on its next visit; what it cannot do is sweep
 * itself while the refusal keeps the client from starting there at all.
 *
 * That leaves the re-grant path. A visitor who refuses here, never returns to
 * `www` in the meantime, then opts back in *on* `www` gives that origin a start
 * with no shared cookie and a stale local record — which it seeds from, writing
 * the refused `web_exp_id_v2` back to a root-domain cookie. The identity comes
 * back, relinked across subdomains, and which origin they happened to return to
 * decides whether the refusal held. This marker is what stops that.
 *
 * It is a cookie written *after* a refusal, so it carries no timestamp and no
 * identifier — `1` is the entire payload, and it earns its place only by making
 * the refusal effective, the same basis a consent platform records its own
 * decision under.
 *
 * It goes to the first root domain that accepts it, verified by
 * `writeRawCookie`'s read-back rather than a throwaway probe cookie, which would
 * be a second write. Hosts with no writable root domain (single-label hosts, IPs)
 * share no cookie across origins, so there is nothing to respawn from and no
 * marker is written.
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
 * Carries an erasure across to this origin, so a refusal on one subdomain is not
 * undone by what another kept. Runs before identity is read.
 *
 * Both halves of the guard matter. With no marker there is nothing to carry
 * over. With a shared identity cookie present there is nothing to carry over
 * either — that cookie already wins over every local seed, so an identity
 * established since the erasure is the one in use and the stale local records
 * can only lose to it. What remains is exactly the case a respawn needs: marker
 * set, cookie gone. There, the local records are worth nothing anyway, because
 * this origin is about to mint a fresh identity either way.
 *
 * Consent gating being switched off is not consulted. The marker only ever
 * exists because a visitor refused, and that refusal has to outlive a customer
 * turning the feature off.
 */
export const clearIfErasedElsewhere = (
  apiKey: string,
  options: { instanceName?: string } = {},
): void => {
  if (readRawCookie(erasureMarkerKey(apiKey)) === undefined) return;
  if (readRawCookie(identityCookieKey(apiKey)) !== undefined) return;
  clearAllPersistedData(apiKey, options);
};
