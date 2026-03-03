// Mock helpers for testing

export const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    length: jest.fn(() => Object.keys(store).length),
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
};

export const createDocumentMock = (overrides?: Record<string, unknown>) => ({
  referrer: '',
  documentElement: {
    nodeType: 1,
    nodeName: 'HTML',
  },
  querySelector: jest.fn(),
  createElement: jest.fn(),
  head: {
    appendChild: jest.fn(),
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  hidden: false,
  ...overrides,
});

export const createLocationMock = (overrides?: Record<string, unknown>) => {
  const location = {
    href: 'http://test.com',
    search: '',
    hostname: 'test.com',
    pathname: '/',
    protocol: 'http:',
    port: '',
    host: 'test.com',
    replace: jest.fn(),
    ...overrides,
  };

  // Ensure replace updates href
  if (!overrides?.replace) {
    location.replace = jest.fn((url: string) => {
      location.href = url;
    });
  }

  return location;
};

export const createMockGlobal = (overrides?: Record<string, unknown>) => {
  const baseGlobal = {
    localStorage: createStorageMock(),
    sessionStorage: createStorageMock(),
    document: createDocumentMock(),
    history: { replaceState: jest.fn() },
    addEventListener: jest.fn(),
    setTimeout: jest.fn((fn: () => void) => fn()),
    clearTimeout: jest.fn(),
    experimentIntegration: {
      track: () => {
        return true;
      },
      getUser: () => {
        return {
          user_id: 'user',
          device_id: 'device',
        };
      },
    },
    location: createLocationMock(),
    innerHeight: 768,
    innerWidth: 1024,
  };

  // Apply overrides with smart merging for nested objects
  if (overrides) {
    Object.keys(overrides).forEach((key) => {
      if (key === 'location' && typeof overrides[key] === 'object') {
        // Merge location properties
        baseGlobal.location = createLocationMock(
          overrides[key] as Record<string, unknown>,
        );
      } else if (key === 'document' && typeof overrides[key] === 'object') {
        // Merge document properties
        baseGlobal.document = createDocumentMock(
          overrides[key] as Record<string, unknown>,
        );
      } else {
        baseGlobal[key] = overrides[key];
      }
    });
  }

  return baseGlobal;
};

// Mock MutationObserver for tests
export class MockMutationObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn(() => []);

  constructor(callback: MutationCallback) {
    // do nothing
  }
}

// Mock IntersectionObserver for tests
export class MockIntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn(() => []);

  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    // do nothing
  }
}

// Setup global observers
export const setupGlobalObservers = () => {
  global.MutationObserver = MockMutationObserver as any;
  global.IntersectionObserver = MockIntersectionObserver as any;
};
