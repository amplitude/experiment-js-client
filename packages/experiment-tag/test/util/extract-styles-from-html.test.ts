import { extractStylesFromHtml } from '../../src/util/extract-styles-from-html';

describe('extractStylesFromHtml', () => {
  it('returns input unchanged when there are no <style> tags (fast path)', () => {
    const html = '<div class="foo">hello</div>';
    const result = extractStylesFromHtml(html);
    expect(result).toEqual({ html, css: '' });
  });

  it('returns input unchanged when input is empty', () => {
    expect(extractStylesFromHtml('')).toEqual({ html: '', css: '' });
  });

  it('extracts a single <style> block, removes it from html, returns its content as css', () => {
    const html = '<div>hi</div><style>.foo { color: red; }</style>';
    const result = extractStylesFromHtml(html);
    expect(result.html).toBe('<div>hi</div>');
    expect(result.css).toBe('.foo { color: red; }');
  });

  it('concatenates multiple <style> blocks in source order', () => {
    const html =
      '<style>.a { color: red; }</style><div>x</div><style>.b { color: blue; }</style>';
    const result = extractStylesFromHtml(html);
    expect(result.html).toBe('<div>x</div>');
    expect(result.css).toBe('.a { color: red; }\n.b { color: blue; }');
  });

  it('extracts <style> nested inside other elements; preserves surrounding html', () => {
    const html =
      '<div class="outer"><span>inner</span><style>.x{}</style></div>';
    const result = extractStylesFromHtml(html);
    expect(result.html).toBe('<div class="outer"><span>inner</span></div>');
    expect(result.css).toBe('.x{}');
  });

  it('does not throw on malformed input', () => {
    expect(() => extractStylesFromHtml('<div><style>.a{}')).not.toThrow();
  });

  it('strips <style> elements with attributes (nonce, media, etc.)', () => {
    const html =
      '<div>x</div><style media="print" nonce="abc">.a{}</style><style>.b{}</style>';
    const result = extractStylesFromHtml(html);
    expect(result.html).toBe('<div>x</div>');
    expect(result.css).toBe('.a{}\n.b{}');
  });

  it('preserves CSS source verbatim including @media queries and pseudo-classes', () => {
    const css =
      '.btn:hover { color: red; }\n@media (max-width: 600px) { .btn { font-size: 12px; } }';
    const html = `<button class="btn">x</button><style>${css}</style>`;
    const result = extractStylesFromHtml(html);
    expect(result.css).toBe(css);
  });
});
