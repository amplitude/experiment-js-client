import { getGlobalScope } from '@amplitude/experiment-core';

import { PreviewState } from '../types';
import {
  getTopLevelDomain,
  readRawCookie,
  writeRawCookie,
} from '../util/cookie';
import { getStorageItem, setStorageItem } from '../util/storage';
import { PREVIEW_MODE_SESSION_KEY } from '../util/storage-keys';

const isPopulated = (
  state: PreviewState | null | undefined,
): state is PreviewState =>
  Boolean(state?.previewFlags && Object.keys(state.previewFlags).length > 0);

/**
 * Persist preview overrides for the rest of this page session.
 *
 * sessionStorage covers same-origin navigations. A root-domain session cookie
 * covers sibling subdomains, which sessionStorage cannot. Preview is tooling
 * state (entered via URL params), so the cookie is written even while consent
 * is withheld — same exemption as {@link PREVIEW_MODE_SESSION_KEY}.
 */
export const writePreviewState = (state: PreviewState): void => {
  setStorageItem('sessionStorage', PREVIEW_MODE_SESSION_KEY, state);
  const hostname = getGlobalScope()?.location?.hostname ?? '';
  writeRawCookie(PREVIEW_MODE_SESSION_KEY, JSON.stringify(state), {
    domain: getTopLevelDomain(hostname) || undefined,
  });
};

/**
 * Restore preview overrides: sessionStorage first, then the root-domain cookie
 * (the cross-subdomain path). A cookie hit is copied into sessionStorage so
 * later same-origin reads stay on the existing key.
 */
export const readPreviewState = (): PreviewState | null => {
  const fromSession = getStorageItem<PreviewState>(
    'sessionStorage',
    PREVIEW_MODE_SESSION_KEY,
  );
  if (isPopulated(fromSession)) {
    return fromSession;
  }
  const raw = readRawCookie(PREVIEW_MODE_SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PreviewState;
    if (!isPopulated(parsed)) {
      return null;
    }
    setStorageItem('sessionStorage', PREVIEW_MODE_SESSION_KEY, parsed);
    return parsed;
  } catch {
    return null;
  }
};
