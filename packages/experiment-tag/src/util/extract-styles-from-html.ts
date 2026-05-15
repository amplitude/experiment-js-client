/**
 * Removes <style> elements from `html` and returns their combined textContent
 * as a `css` string. Pure string transformation — no DOM side effects, no
 * adoption.
 *
 * Returns `{ html: input, css: '' }` unchanged if there are no <style> tags
 * (fast path via `String.includes`).
 *
 * Used by:
 *   - extractAndAdoptStyles (composes adoption on top)
 *   - callers that want to migrate the extracted CSS into a separate
 *     persistent storage layer instead of adopting it as a stylesheet
 *
 * Implementation notes:
 *   - <style> elements are removed wholesale; any attributes on them (nonce,
 *     media, scoped, etc.) are dropped along with the element. CSS source
 *     contents are preserved verbatim, so in-source @media queries continue
 *     to work.
 *   - We deliberately use a regex (not DOMParser) because DOMParser
 *     materializes <style> elements as it parses, which constructs their
 *     CSSStyleSheet and triggers CSP `style-src` enforcement on strict
 *     customer pages — even when the elements live in a detached document
 *     and are never inserted into the live DOM. The whole point of this
 *     helper is to avoid that very violation.
 */

export type ExtractedStyles = {
  html: string;
  css: string;
};

const STYLE_TAG_RE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;

export function extractStylesFromHtml(html: string): ExtractedStyles {
  if (!html.toLowerCase().includes('<style')) return { html, css: '' };

  const cssChunks: string[] = [];
  const cleanedHtml = html.replace(STYLE_TAG_RE, (_match, content: string) => {
    cssChunks.push(content);
    return '';
  });

  if (cssChunks.length === 0) return { html, css: '' };
  return { html: cleanedHtml, css: cssChunks.join('\n') };
}
