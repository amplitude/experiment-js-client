import { getGlobalScope } from '@amplitude/experiment-core';

/**
 * True when `window.opener` is missing or inaccessible, i.e. the visual
 * editor has no channel to reach skylab. Commonly caused by the customer
 * page's `Cross-Origin-Opener-Policy` header isolating the popup from
 * its opener. Accessing `opener.closed` can throw on an opaque
 * WindowProxy, so we defensively catch.
 */
export const isOpenerChannelBroken = (): boolean => {
  try {
    const scope = getGlobalScope();
    if (!scope) {
      return true;
    }
    const opener = scope.opener as Window | null | undefined;
    if (!opener) {
      return true;
    }
    return opener.closed;
  } catch {
    return true;
  }
};
