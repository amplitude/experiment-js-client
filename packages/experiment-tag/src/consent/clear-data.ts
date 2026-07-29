import { MKTG } from '@amplitude/analytics-core';
import { getGlobalScope } from '@amplitude/experiment-core';

import { deleteRawCookie, getCookieDomainLevels } from '../util/cookie';
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
      `EXP_${slice}_identity`,
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
