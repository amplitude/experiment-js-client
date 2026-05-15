import { extractAndAdoptStyles } from '../../src/util/extract-and-adopt-styles';

describe('extractAndAdoptStyles', () => {
  beforeEach(() => {
    document.adoptedStyleSheets = [];
  });

  it('returns input html and null handle when no <style> present', () => {
    const html = '<div>hi</div>';
    const result = extractAndAdoptStyles(html, document);

    expect(result.html).toBe(html);
    expect(result.handle).toBeNull();
    expect(document.adoptedStyleSheets).toHaveLength(0);
  });

  it('extracts <style>, returns cleaned html and a handle, adopts the sheet on the target', () => {
    const html = '<div>hi</div><style>.a { color: red; }</style>';
    const result = extractAndAdoptStyles(html, document);

    expect(result.html).toBe('<div>hi</div>');
    expect(result.handle).not.toBeNull();
    expect(document.adoptedStyleSheets).toHaveLength(1);
    expect(document.adoptedStyleSheets[0]).toBeInstanceOf(CSSStyleSheet);
  });

  it('handle.revert removes the sheet', () => {
    const result = extractAndAdoptStyles(
      '<div></div><style>.a {}</style>',
      document,
    );
    expect(document.adoptedStyleSheets).toHaveLength(1);

    result.handle?.revert();
    expect(document.adoptedStyleSheets).toHaveLength(0);
  });

  it('handle.reapply re-adopts after revert', () => {
    const result = extractAndAdoptStyles(
      '<div></div><style>.a {}</style>',
      document,
    );
    const sheet = document.adoptedStyleSheets[0];
    result.handle?.revert();
    result.handle?.reapply();

    expect(document.adoptedStyleSheets).toHaveLength(1);
    expect(document.adoptedStyleSheets[0]).toBe(sheet);
  });

  it('works with a ShadowRoot target', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const result = extractAndAdoptStyles(
      '<p>hi</p><style>p { color: red; }</style>',
      shadow,
    );

    expect(result.html).toBe('<p>hi</p>');
    expect(shadow.adoptedStyleSheets).toHaveLength(1);

    result.handle?.revert();
    document.body.removeChild(host);
  });
});
