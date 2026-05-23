import { whenBodyReady } from '../../src/util/when-body-ready';

describe('whenBodyReady', () => {
  let originalBody: HTMLElement;
  let bodyDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalBody = document.body;
    bodyDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'body',
    );
  });

  afterEach(() => {
    if (bodyDescriptor) {
      Object.defineProperty(Document.prototype, 'body', bodyDescriptor);
    } else {
      Object.defineProperty(document, 'body', {
        configurable: true,
        value: originalBody,
      });
    }
  });

  const setBody = (value: HTMLElement | null) => {
    Object.defineProperty(document, 'body', {
      configurable: true,
      get: () => value,
    });
  };

  it('runs the callback synchronously when document.body is already present', () => {
    const cb = jest.fn();
    whenBodyReady(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('defers the callback until document.body becomes available', () => {
    setBody(null);
    const rafCallbacks: FrameRequestCallback[] = [];
    const rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });

    const cb = jest.fn();
    whenBodyReady(cb);
    expect(cb).not.toHaveBeenCalled();
    expect(rafSpy).toHaveBeenCalledTimes(1);

    rafCallbacks.shift()?.(0);
    expect(cb).not.toHaveBeenCalled();
    expect(rafSpy).toHaveBeenCalledTimes(2);

    setBody(originalBody);
    rafCallbacks.shift()?.(0);
    expect(cb).toHaveBeenCalledTimes(1);

    rafSpy.mockRestore();
  });

  it('invokes the callback immediately when rAF is unavailable', () => {
    setBody(null);
    const originalRaf = window.requestAnimationFrame;
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: undefined,
    });

    try {
      const cb = jest.fn();
      whenBodyReady(cb);
      expect(cb).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        value: originalRaf,
      });
    }
  });
});
