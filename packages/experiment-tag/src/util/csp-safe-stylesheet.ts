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

/**
 * Discriminates Document from ShadowRoot via nodeType. We avoid
 * `instanceof Document` because `instanceof` lies across realms — an iframe's
 * contentDocument IS a Document but isn't an instance of THIS realm's
 * Document constructor.
 */
function isDocument(node: Document | ShadowRoot): node is Document {
  return node.nodeType === Node.DOCUMENT_NODE;
}

export function cspSafeStyleSheet(
  target: Document | ShadowRoot,
  css: string,
): StyleSheetHandle {
  // CSSStyleSheets are realm-bound — adopting one cross-realm throws
  // NotAllowedError. Construct the sheet via the target's owning realm so it
  // can be adopted into an iframe's contentDocument.
  // ShadowRoot.ownerDocument is always a Document per spec; the `?? document`
  // is purely a TS-narrowing concession (the lib.dom type is nullable).
  const ownerDoc: Document = isDocument(target)
    ? target
    : target.ownerDocument ?? document;
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
