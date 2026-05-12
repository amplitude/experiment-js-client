/**
 * Adopts a CSSStyleSheet onto a Document or ShadowRoot.
 *
 * Constructable stylesheets are not gated by CSP `style-src`, which means this
 * works on customer pages with strict nonce/hash CSP policies where `<style>`
 * element injection would be blocked.
 *
 * Returns idempotent revert/reapply handles for hide-and-restore use cases
 * (e.g. temporarily hiding then restoring a page's styles).
 */

export type StyleSheetHandle = {
  revert: () => void;
  reapply: () => void;
};

export function cspSafeStyleSheet(
  target: Document | ShadowRoot,
  css: string,
): StyleSheetHandle {
  // CSSStyleSheets are realm-bound — adopting one cross-realm throws
  // NotAllowedError. Construct the sheet via the target's owning realm so it
  // can be adopted into an iframe's contentDocument.
  const ownerDoc: Document =
    (target as Document).ownerDocument ?? (target as Document);
  const SheetCtor = ownerDoc.defaultView?.CSSStyleSheet ?? CSSStyleSheet;
  const sheet = new SheetCtor();
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
