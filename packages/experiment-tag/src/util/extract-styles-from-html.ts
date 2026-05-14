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
 * Implementation note: <style> elements are removed wholesale; any attributes
 * on them (nonce, media, scoped, etc.) are dropped along with the element.
 * CSS source contents are preserved verbatim, so in-source @media queries
 * continue to work.
 */

export type ExtractedStyles = {
  html: string;
  css: string;
};

export function extractStylesFromHtml(html: string): ExtractedStyles {
  if (!html.includes('<style')) return { html, css: '' };

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const styleElements = doc.querySelectorAll('style');
  if (styleElements.length === 0) return { html, css: '' };

  const css = Array.from(styleElements)
    .map((el) => el.textContent ?? '')
    .join('\n');
  styleElements.forEach((el) => el.remove());

  return { html: doc.body.innerHTML, css };
}
