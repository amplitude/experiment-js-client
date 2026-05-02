/**
 * Adopts a CSSStyleSheet onto a Document or ShadowRoot.
 *
 * Constructable stylesheets are not gated by CSP `style-src`, which means this
 * works on customer pages with strict nonce/hash CSP policies (e.g. Fathom)
 * where `<style>` element injection would be blocked.
 *
 * Returns idempotent revert/reapply handles for hide-and-restore use cases
 * (e.g. AI stylizer page snapshots).
 *
 * NOTE: This file is duplicated in:
 *   - apps/experiment-overlay/src/lib/csp-safe-stylesheet.ts (javascript repo)
 *   - packages/experiment-tag/src/util/csp-safe-stylesheet.ts (experiment-js-client repo)
 * If you change one, change the other.
 */

export type StyleSheetHandle = {
  revert: () => void;
  reapply: () => void;
};

export function cspSafeStyleSheet(
  target: Document | ShadowRoot,
  css: string,
): StyleSheetHandle {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  let adopted = false;

  const adopt = () => {
    if (adopted) return;
    target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
    adopted = true;
  };

  adopt();

  return {
    revert: () => {
      if (!adopted) return;
      target.adoptedStyleSheets = target.adoptedStyleSheets.filter(
        (s) => s !== sheet,
      );
      adopted = false;
    },
    reapply: adopt,
  };
}
