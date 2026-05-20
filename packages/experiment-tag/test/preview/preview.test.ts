describe('PreviewModeModal style injection', () => {
  beforeEach(() => {
    // Clear adoptedStyleSheets BEFORE wiping head.innerHTML — the
    // construct-style-sheets-polyfill tracks the <style> nodes it injected
    // into <head> and throws if we remove them out from under it before
    // resetting the adopted list.
    document.adoptedStyleSheets = [];
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    jest.resetModules();
  });

  /**
   * The module-level `modalStylesHandle` in preview.ts persists across tests
   * in this file. Use jest.isolateModulesAsync to give each test a fresh
   * module instance so cross-test pollution doesn't make idempotency look
   * broken (or pass spuriously).
   */
  const loadFreshPreview = async () => {
    let mod: typeof import('../../src/preview/preview');
    await jest.isolateModulesAsync(async () => {
      mod = await import('../../src/preview/preview');
    });
    return mod!;
  };

  it('show() adopts a constructable stylesheet onto the document', async () => {
    const { PreviewModeModal } = await loadFreshPreview();
    new PreviewModeModal({ flags: { 'flag-1': 'A' } }).show();

    expect(document.adoptedStyleSheets).toHaveLength(1);
    expect(document.adoptedStyleSheets[0]).toBeInstanceOf(CSSStyleSheet);
  });

  it('a second instance does not double-adopt the stylesheet', async () => {
    const { PreviewModeModal } = await loadFreshPreview();
    new PreviewModeModal({ flags: { 'flag-1': 'A' } }).show();
    new PreviewModeModal({ flags: { 'flag-2': 'B' } }).show();

    expect(document.adoptedStyleSheets).toHaveLength(1);
  });

  it('hide() does not revert the stylesheet (matches pre-refactor behavior)', async () => {
    // injectStyles() runs synchronously inside createModal(), so the sheet is
    // adopted before requestAnimationFrame appends the modal to the body.
    // We assert against adopted sheets only — not against the modal element —
    // so we don't have to flush the rAF in jsdom.
    const { PreviewModeModal } = await loadFreshPreview();
    const modal = new PreviewModeModal({ flags: { 'flag-1': 'A' } });
    modal.show();
    expect(document.adoptedStyleSheets).toHaveLength(1);

    modal.hide();

    expect(document.adoptedStyleSheets).toHaveLength(1);
  });
});
