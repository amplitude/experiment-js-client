import { cspSafeStyleSheet } from '../../src/util/csp-safe-stylesheet';

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

  it('reapply re-adopts the same sheet after revert', () => {
    const handle = cspSafeStyleSheet(document, '.foo {}');
    const originalSheet = document.adoptedStyleSheets[0];

    handle.revert();
    handle.reapply();

    expect(document.adoptedStyleSheets).toHaveLength(1);
    expect(document.adoptedStyleSheets[0]).toBe(originalSheet);
  });

  it('reapply is idempotent (no-op when already adopted)', () => {
    const handle = cspSafeStyleSheet(document, '.foo {}');
    handle.reapply();
    handle.reapply();
    expect(document.adoptedStyleSheets).toHaveLength(1);

    handle.revert();
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
