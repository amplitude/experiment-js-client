import { getGlobalScope } from '@amplitude/experiment-core';

import {
  applyAntiFlickerCss,
  removeAntiFlickerCss,
} from '../../src/util/anti-flicker';

jest.mock('@amplitude/experiment-core', () => ({
  ...jest.requireActual('@amplitude/experiment-core'),
  getGlobalScope: jest.fn(),
}));

describe('applyAntiFlickerCss / removeAntiFlickerCss', () => {
  beforeEach(() => {
    document.adoptedStyleSheets = [];
    removeAntiFlickerCss();
    (getGlobalScope as jest.Mock).mockReturnValue(window);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    removeAntiFlickerCss();
  });

  it('adopts a constructable stylesheet on the document', () => {
    applyAntiFlickerCss();

    expect(document.adoptedStyleSheets).toHaveLength(1);
    expect(document.adoptedStyleSheets[0]).toBeInstanceOf(CSSStyleSheet);
  });

  it('is idempotent — second apply within the timeout window does not double-adopt', () => {
    applyAntiFlickerCss();
    applyAntiFlickerCss();

    expect(document.adoptedStyleSheets).toHaveLength(1);
  });

  it('reverts the sheet automatically after 1000ms', () => {
    applyAntiFlickerCss();
    expect(document.adoptedStyleSheets).toHaveLength(1);

    jest.advanceTimersByTime(1000);

    expect(document.adoptedStyleSheets).toHaveLength(0);
  });

  it('removeAntiFlickerCss reverts the sheet immediately', () => {
    applyAntiFlickerCss();
    expect(document.adoptedStyleSheets).toHaveLength(1);

    removeAntiFlickerCss();

    expect(document.adoptedStyleSheets).toHaveLength(0);
  });

  it('removeAntiFlickerCss is a no-op when nothing was applied', () => {
    expect(() => removeAntiFlickerCss()).not.toThrow();
    expect(document.adoptedStyleSheets).toHaveLength(0);
  });

  it('apply after remove re-adopts (next-init scenario)', () => {
    applyAntiFlickerCss();
    removeAntiFlickerCss();
    applyAntiFlickerCss();

    expect(document.adoptedStyleSheets).toHaveLength(1);
  });
});
