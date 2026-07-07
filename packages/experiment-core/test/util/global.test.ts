import {
  getClearInterval,
  getClearTimeout,
  getDocument,
  getFetch,
  getGlobalScope,
  getLocalStorage,
  getSessionStorage,
  getSetInterval,
  getSetTimeout,
} from '../../src/util/global';

type Helper<T> = () => T | undefined;

const withDeletedProperty = <T>(
  prop: keyof typeof globalThis,
  fn: () => T,
): T => {
  const scope = globalThis as Record<string, unknown>;
  const original = scope[prop as string];
  delete scope[prop as string];
  try {
    return fn();
  } finally {
    scope[prop as string] = original;
  }
};

describe('getGlobalScope', () => {
  it('returns globalThis in a normal environment', () => {
    expect(getGlobalScope()).toBe(globalThis);
  });
});

describe.each<[string, Helper<unknown>, keyof typeof globalThis]>([
  ['getLocalStorage', getLocalStorage, 'localStorage'],
  ['getSessionStorage', getSessionStorage, 'sessionStorage'],
  ['getDocument', getDocument, 'document'],
])('%s', (_name, helper, prop) => {
  it('returns the value when present on the global', () => {
    expect(helper()).toBe(globalThis[prop]);
  });

  it('returns undefined when the property is missing', () => {
    withDeletedProperty(prop, () => {
      expect(helper()).toBeUndefined();
    });
  });
});

describe.each<[string, Helper<unknown>, keyof typeof globalThis]>([
  ['getSetTimeout', getSetTimeout, 'setTimeout'],
  ['getClearTimeout', getClearTimeout, 'clearTimeout'],
  ['getSetInterval', getSetInterval, 'setInterval'],
  ['getClearInterval', getClearInterval, 'clearInterval'],
])('%s', (_name, helper, prop) => {
  it('returns a callable when present on the global', () => {
    expect(typeof helper()).toBe('function');
  });

  it('returns undefined when the property is missing', () => {
    withDeletedProperty(prop, () => {
      expect(helper()).toBeUndefined();
    });
  });
});

describe('getFetch', () => {
  it('returns the fetch function when present on the global', () => {
    const scope = globalThis as Record<string, unknown>;
    const original = scope.fetch;
    const stub = jest.fn();
    scope.fetch = stub;
    try {
      const fetchFn = getFetch();
      expect(typeof fetchFn).toBe('function');
      fetchFn?.('http://example.com');
      expect(stub).toHaveBeenCalledWith('http://example.com');
    } finally {
      if (original === undefined) {
        delete scope.fetch;
      } else {
        scope.fetch = original;
      }
    }
  });

  it('returns undefined when fetch is missing from the global', () => {
    withDeletedProperty('fetch', () => {
      expect(getFetch()).toBeUndefined();
    });
  });
});

describe('getSetTimeout / getClearTimeout', () => {
  it('returned setTimeout schedules the callback and clearTimeout cancels it', async () => {
    const setTimeoutFn = getSetTimeout();
    const clearTimeoutFn = getClearTimeout();
    if (!setTimeoutFn || !clearTimeoutFn) {
      throw new Error('expected setTimeout/clearTimeout to be defined');
    }

    let cancelled = false;
    const handle = setTimeoutFn(() => {
      if (cancelled) {
        throw new Error('cancelled timeout fired');
      }
    }, 50);
    clearTimeoutFn(handle);
    cancelled = true;

    await new Promise<void>((resolve) => setTimeoutFn(resolve, 100));
    expect(cancelled).toBe(true);
  });
});

describe('getSetInterval / getClearInterval', () => {
  it('returned setInterval schedules and clearInterval cancels', async () => {
    const setIntervalFn = getSetInterval();
    const clearIntervalFn = getClearInterval();
    const setTimeoutFn = getSetTimeout();
    if (!setIntervalFn || !clearIntervalFn || !setTimeoutFn) {
      throw new Error(
        'expected setInterval/clearInterval/setTimeout to be defined',
      );
    }

    let calls = 0;
    const handle = setIntervalFn(() => {
      calls += 1;
    }, 25);

    await new Promise<void>((resolve) => setTimeoutFn(resolve, 80));
    clearIntervalFn(handle);
    const callsAtCancel = calls;
    await new Promise<void>((resolve) => setTimeoutFn(resolve, 75));
    expect(calls).toBe(callsAtCancel);
  });
});
