import { getGlobalScope } from '@amplitude/experiment-core';

/**
 * Runs `callback` once `document.body` is available.
 *
 * Polls via `requestAnimationFrame` instead of waiting on a
 * `DOMContentLoaded` / `load` listener because third-party scripts that
 * proxy global event listeners can swallow those events — see #299.
 *
 * In the (effectively impossible) case where `requestAnimationFrame` is
 * unavailable, the callback is invoked immediately rather than never —
 * callers that would crash on a null body should guard inside.
 *
 * Returns a cancel function that stops any in-flight body poll.
 */
export const whenBodyReady = (callback: () => void): (() => void) => {
  if (document.body) {
    callback();
    return () => undefined;
  }
  const globalScope = getGlobalScope();
  if (!globalScope?.requestAnimationFrame) {
    callback();
    return () => undefined;
  }
  let cancelled = false;
  const poll = () => {
    if (cancelled) {
      return;
    }
    if (document.body) {
      callback();
    } else {
      globalScope.requestAnimationFrame(poll);
    }
  };
  globalScope.requestAnimationFrame(poll);
  return () => {
    cancelled = true;
  };
};
