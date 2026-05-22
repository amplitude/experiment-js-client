import { getGlobalScope } from '@amplitude/experiment-core';

/**
 * Runs `callback` once `document.body` is available.
 *
 * Polls via `requestAnimationFrame` instead of waiting on a
 * `DOMContentLoaded` / `load` listener because third-party scripts on
 * customer pages (e.g. Cloudflare Rocket Loader) proxy `addEventListener`
 * and can swallow those events — see #299. Callers can assume
 * `document.body` is truthy inside the callback.
 *
 * If `requestAnimationFrame` is unavailable (effectively no modern
 * browser), the callback never fires — silent no-op is preferable to
 * invoking with a null body and crashing the caller.
 */
export const whenBodyReady = (callback: () => void): void => {
  if (document.body) {
    callback();
    return;
  }
  const globalScope = getGlobalScope();
  if (!globalScope?.requestAnimationFrame) {
    return;
  }
  const poll = () => {
    if (document.body) {
      callback();
    } else {
      globalScope.requestAnimationFrame(poll);
    }
  };
  globalScope.requestAnimationFrame(poll);
};
