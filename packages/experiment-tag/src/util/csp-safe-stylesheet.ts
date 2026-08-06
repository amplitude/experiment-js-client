/**
 * Adopts a CSSStyleSheet onto a Document or ShadowRoot.
 *
 * Constructable stylesheets are not gated by CSP `style-src`, which means this
 * works on customer pages with strict nonce/hash CSP policies where `<style>`
 * element injection would be blocked.
 *
 * When `target.adoptedStyleSheets` is missing (e.g. synthetic shadow
 * DocumentFragments that are not real ShadowRoots), adopts onto the owning
 * Document instead. Synthetic shadow does not encapsulate styles like native
 * shadow, so document-level rules still apply.
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

/**
 * Real style targets expose `adoptedStyleSheets` (an empty array-like by
 * default). Synthetic shadow roots can look like ShadowRoot / DocumentFragment
 * but omit it, so spreading throws `TypeError: … is not iterable`.
 */
export function supportsAdoptedStyleSheets(
  target: Document | ShadowRoot,
): boolean {
  return (
    (target as { adoptedStyleSheets?: unknown }).adoptedStyleSheets !==
    undefined
  );
}

export function cspSafeStyleSheet(
  target: Document | ShadowRoot,
  css: string,
): StyleSheetHandle {
  // ShadowRoot.ownerDocument is always a Document per spec; the `?? document`
  // is purely a TS-narrowing concession (the lib.dom type is nullable).
  const ownerDoc: Document = isDocument(target)
    ? target
    : target.ownerDocument ?? document;

  // Prefer the requested target when it supports constructable adoption.
  // Otherwise fall back to the owning Document — not a `<style>` inject into
  // a synthetic/fake root, which is not a meaningful style target.
  const adoptTarget = supportsAdoptedStyleSheets(target) ? target : ownerDoc;

  // CSSStyleSheets are realm-bound — adopting one cross-realm throws
  // NotAllowedError. Construct the sheet via the target's owning realm so it
  // can be adopted into an iframe's contentDocument.
  const SheetCtor = ownerDoc.defaultView?.CSSStyleSheet ?? CSSStyleSheet;
  const sheet = new SheetCtor();
  sheet.replaceSync(css);
  let adopted = false;

  const adopt = (): void => {
    if (adopted) return;
    adoptTarget.adoptedStyleSheets = [...adoptTarget.adoptedStyleSheets, sheet];
    adopted = true;
  };

  adopt();

  return {
    revert: (): void => {
      if (!adopted) return;
      adoptTarget.adoptedStyleSheets = adoptTarget.adoptedStyleSheets.filter(
        (s) => s !== sheet,
      );
      adopted = false;
    },
    reapply: adopt,
  };
}
