import { cspSafeStyleSheet } from '../../src/util/csp-safe-stylesheet';

/**
 * Cross-realm coverage gap: these tests do NOT exercise the cross-realm
 * CSSStyleSheet adoption scenario. In real browsers, a sheet constructed in
 * one realm cannot be adopted into a Document/ShadowRoot from a different
 * realm — the browser throws NotAllowedError. construct-style-sheets-polyfill
 * (used here under jsdom) doesn't enforce that invariant, so these tests
 * would pass even if the helper regressed to constructing sheets in the
 * wrong realm.
 *
 * The helper's realm-derivation logic
 * (`target.ownerDocument.defaultView?.CSSStyleSheet`) is exercised manually
 * via the visual editor's mobile-mode device-iframe scenario.
 */
describe('cspSafeStyleSheet', () => {
  beforeEach(() => {
    document.adoptedStyleSheets = [];
  });

  it('adopts a CSSStyleSheet onto the target', () => {
    const handle = cspSafeStyleSheet(document, '.foo { color: red; }');

    expect(document.adoptedStyleSheets).toHaveLength(1);
    expect(document.adoptedStyleSheets[0]).toBeInstanceOf(CSSStyleSheet);

    handle.revert();
  });

  it('revert removes the sheet from adoptedStyleSheets', () => {
    const handle = cspSafeStyleSheet(document, '.foo {}');
    expect(document.adoptedStyleSheets).toHaveLength(1);

    handle.revert();
    expect(document.adoptedStyleSheets).toHaveLength(0);
  });

  it('revert is idempotent', () => {
    const handle = cspSafeStyleSheet(document, '.foo {}');
    handle.revert();
    handle.revert();
    expect(document.adoptedStyleSheets).toHaveLength(0);
  });

  it('preserves other adopted sheets when reverting (filters by identity)', () => {
    const otherSheet = new CSSStyleSheet();
    otherSheet.replaceSync('.other {}');
    document.adoptedStyleSheets = [otherSheet];

    const handle = cspSafeStyleSheet(document, '.foo {}');
    expect(document.adoptedStyleSheets).toHaveLength(2);

    handle.revert();
    expect(document.adoptedStyleSheets).toEqual([otherSheet]);
  });

  it('works on a ShadowRoot target', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const handle = cspSafeStyleSheet(shadow, '.foo {}');
    expect(shadow.adoptedStyleSheets).toHaveLength(1);
    expect(shadow.adoptedStyleSheets[0]).toBeInstanceOf(CSSStyleSheet);

    handle.revert();
    expect(shadow.adoptedStyleSheets).toHaveLength(0);
    document.body.removeChild(host);
  });
});
