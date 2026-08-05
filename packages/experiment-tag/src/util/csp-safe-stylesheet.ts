/**
 * Adopts a CSSStyleSheet onto a Document or ShadowRoot.
 *
 * Constructable stylesheets are not gated by CSP `style-src`, which means this
 * works on customer pages with strict nonce/hash CSP policies where `<style>`
 * element injection would be blocked.
 *
 * When `adoptedStyleSheets` is missing or not iterable (e.g. synthetic shadow
 * polyfills), falls back to appending a `<style>` element so callers do not
 * crash. Prefer the constructable path when available.
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
 * Constructable stylesheet adoption requires an iterable `adoptedStyleSheets`.
 * Some synthetic shadow roots expose a ShadowRoot-like object without that API
 * (`undefined`), so spreading it throws `TypeError: … is not iterable`.
 */
function supportsAdoptedStyleSheets(target: Document | ShadowRoot): boolean {
  const sheets = (target as { adoptedStyleSheets?: unknown })
    .adoptedStyleSheets;
  return (
    sheets != null &&
    typeof (sheets as { [Symbol.iterator]?: unknown })[Symbol.iterator] ===
      'function'
  );
}

function styleElementHandle(
  target: Document | ShadowRoot,
  ownerDoc: Document,
  css: string,
): StyleSheetHandle {
  const styleEl = ownerDoc.createElement('style');
  styleEl.textContent = css;
  let adopted = false;

  const mountParent = (): ParentNode => {
    if (isDocument(target)) {
      return target.head ?? target.documentElement;
    }
    return target;
  };

  const adopt = (): void => {
    if (adopted) return;
    mountParent().appendChild(styleEl);
    adopted = true;
  };

  adopt();

  return {
    revert: (): void => {
      if (!adopted) return;
      styleEl.remove();
      adopted = false;
    },
    reapply: adopt,
  };
}

function adoptedStyleSheetHandle(
  target: Document | ShadowRoot,
  ownerDoc: Document,
  css: string,
): StyleSheetHandle {
  // CSSStyleSheets are realm-bound — adopting one cross-realm throws
  // NotAllowedError. Construct the sheet via the target's owning realm so it
  // can be adopted into an iframe's contentDocument.
  const SheetCtor = ownerDoc.defaultView?.CSSStyleSheet ?? CSSStyleSheet;
  const sheet = new SheetCtor();
  sheet.replaceSync(css);
  let adopted = false;

  const adopt = (): void => {
    if (adopted) return;
    target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
    adopted = true;
  };

  adopt();

  return {
    revert: (): void => {
      if (!adopted) return;
      target.adoptedStyleSheets = target.adoptedStyleSheets.filter(
        (s) => s !== sheet,
      );
      adopted = false;
    },
    reapply: adopt,
  };
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

  if (supportsAdoptedStyleSheets(target)) {
    return adoptedStyleSheetHandle(target, ownerDoc, css);
  }

  return styleElementHandle(target, ownerDoc, css);
}
