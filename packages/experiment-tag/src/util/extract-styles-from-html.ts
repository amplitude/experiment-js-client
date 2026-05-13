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
 *   - the visual editor's WidgetRenderer normalization, which migrates the
 *     css into widget.content.css instead of adopting at this point
 *
 * Implementation note: <style> elements are removed wholesale; any attributes
 * on them (nonce, media, scoped, etc.) are dropped along with the element.
 * CSS source contents are preserved verbatim, so in-source @media queries
 * continue to work.
 *
 * NOTE: A copy of this file ships in the visual editor at
 *   apps/experiment-overlay/src/lib/extract-styles-from-html.ts
 *   (https://github.com/amplitude/javascript)
 * If you change one, change the other. Keep the public copy free of internal
 * product names and references to that repo.
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
