import { getGlobalScope } from '@amplitude/experiment-core';

import {
  cspSafeStyleSheet,
  type StyleSheetHandle,
} from './csp-safe-stylesheet';

const ANTI_FLICKER_CSS =
  '* { visibility: hidden !important; background-image: none !important; }';
const TIMEOUT_MS = 1000;

let activeHandle: StyleSheetHandle | undefined;

/**
 * Adopt the anti-flicker stylesheet onto the document via a constructable
 * stylesheet (CSP-safe; works on strict style-src customer pages). Idempotent —
 * a second call before removal / timeout is a no-op. Auto-reverts after 1s as
 * a safety net in case the consumer never calls removeAntiFlickerCss.
 */
export const applyAntiFlickerCss = () => {
  if (activeHandle) return;
  const globalScope = getGlobalScope();
  const targetDoc = globalScope?.document ?? document;

  const handle = cspSafeStyleSheet(targetDoc, ANTI_FLICKER_CSS);
  activeHandle = handle;

  globalScope?.window.setTimeout(() => {
    // Capture-by-identity: only revert if the handle we scheduled for is still
    // active. Without this guard, an apply→remove→apply within TIMEOUT_MS
    // would let the first timeout prematurely revert the second apply.
    if (activeHandle === handle) {
      removeAntiFlickerCss();
    }
  }, TIMEOUT_MS);
};

/**
 * Revert the anti-flicker stylesheet immediately. Idempotent — safe to call
 * even when no sheet is active.
 */
export const removeAntiFlickerCss = (): void => {
  activeHandle?.revert();
  activeHandle = undefined;
};
