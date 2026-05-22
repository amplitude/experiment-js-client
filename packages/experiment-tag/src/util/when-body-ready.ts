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
 */
export const whenBodyReady = (callback: () => void): void => {
  if (document.body) {
    callback();
    return;
  }
  const globalScope = getGlobalScope();
  if (!globalScope?.requestAnimationFrame) {
    callback();
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
