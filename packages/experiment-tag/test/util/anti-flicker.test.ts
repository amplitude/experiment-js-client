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

  it('safety-net timeout from a previous apply does not revert a later apply', () => {
    // T=0: first apply, schedules timeout for T=1000
    applyAntiFlickerCss();
    expect(document.adoptedStyleSheets).toHaveLength(1);

    // T=200: cleanup arrives early
    jest.advanceTimersByTime(200);
    removeAntiFlickerCss();
    expect(document.adoptedStyleSheets).toHaveLength(0);

    // T=300: second apply, schedules its own timeout for T=1300
    jest.advanceTimersByTime(100);
    applyAntiFlickerCss();
    expect(document.adoptedStyleSheets).toHaveLength(1);

    // T=1000: first timeout fires. It must NOT revert the second apply.
    jest.advanceTimersByTime(700);
    expect(document.adoptedStyleSheets).toHaveLength(1);

    // T=1300: second timeout fires. Now the second apply gets cleaned up.
    jest.advanceTimersByTime(300);
    expect(document.adoptedStyleSheets).toHaveLength(0);
  });
});
