/**
 * Removes <style> elements from `html` and adopts their combined CSS onto
 * `target` as a constructable stylesheet (CSP-safe).
 *
 * Used at every site that inserts author-controlled HTML into a customer
 * document — declarativeMutate (html mutations) and widget injection — to
 * neutralize embedded <style> elements that would be blocked by strict
 * style-src CSPs.
 *
 * Returns the cleaned HTML and a handle whose lifecycle the caller MUST tie
 * to the surrounding mutation/inject controller's revert. Returns
 * `handle: null` when the input has no <style> tags.
 *
 * NOTE: A copy of this file ships in the visual editor at
 *   apps/experiment-overlay/src/lib/extract-and-adopt-styles.ts
 * If you change one, change the other.
 */

import {
  cspSafeStyleSheet,
  type StyleSheetHandle,
} from './csp-safe-stylesheet';
import { extractStylesFromHtml } from './extract-styles-from-html';

export type ExtractAndAdoptResult = {
  html: string;
  handle: StyleSheetHandle | null;
};

export function extractAndAdoptStyles(
  html: string,
  target: Document | ShadowRoot,
): ExtractAndAdoptResult {
  const { html: cleanedHtml, css } = extractStylesFromHtml(html);
  if (css === '') return { html, handle: null };
  return { html: cleanedHtml, handle: cspSafeStyleSheet(target, css) };
}
