// Mock helpers for testing

import { WebExperimentConfig } from '../../src/types';

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
  getElementById: jest.fn().mockReturnValue(null),
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

  const syncFromHref = (href: string) => {
    const parsed = new URL(href);
    location.href = parsed.href;
    location.search = parsed.search;
    location.hostname = parsed.hostname;
    location.pathname = parsed.pathname;
    location.protocol = parsed.protocol;
    location.port = parsed.port;
    location.host = parsed.host;
  };

  // Ensure replace updates href
  if (!overrides?.replace) {
    location.replace = jest.fn((url: string) => {
      syncFromHref(new URL(url, location.href).href);
    });
  }

  (location as { _syncFromHref?: (href: string) => void })._syncFromHref =
    syncFromHref;

  return location;
};

export const createHistoryMock = (location: {
  href: string;
  search?: string;
  hostname?: string;
  pathname?: string;
  protocol?: string;
  port?: string;
  host?: string;
  _syncFromHref?: (href: string) => void;
}) => {
  const applyUrl = (url: string | URL | null | undefined) => {
    if (url == null || url === '') {
      return;
    }
    const resolved = new URL(String(url), location.href).href;
    if (location._syncFromHref) {
      location._syncFromHref(resolved);
    } else {
      location.href = resolved;
    }
  };

  return {
    pushState: jest.fn(
      (_state: unknown, _title: string, url?: string | URL | null) => {
        applyUrl(url);
      },
    ),
    // Default replaceState records the call but does not mutate location.
    // Preview/VE tests rely on href staying put; SPA tests that need mutation
    // should drive navigation via pushState (or assign a custom impl).
    replaceState: jest.fn(),
  };
};

export const createMockGlobal = (overrides?: Record<string, unknown>) => {
  const location = createLocationMock(
    overrides?.location && typeof overrides.location === 'object'
      ? (overrides.location as Record<string, unknown>)
      : undefined,
  );

  const listeners: Record<string, Array<(event?: Event) => void>> = {};

  const baseGlobal = {
    localStorage: createStorageMock(),
    sessionStorage: createStorageMock(),
    document: createDocumentMock(),
    history: createHistoryMock(location),
    addEventListener: jest.fn(
      (event: string, handler: (event?: Event) => void) => {
        if (!listeners[event]) {
          listeners[event] = [];
        }
        listeners[event].push(handler);
      },
    ),
    removeEventListener: jest.fn(
      (event: string, handler: (event?: Event) => void) => {
        listeners[event] = (listeners[event] || []).filter(
          (h) => h !== handler,
        );
      },
    ),
    dispatchEvent: jest.fn((event: Event) => {
      for (const handler of listeners[event.type] || []) {
        handler(event);
      }
      return true;
    }),
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
    location,
    innerHeight: 768,
    innerWidth: 1024,
    opener: { closed: false },
    experimentConfig: {
      redirectConfig: {
        encodeRedirectInCookie: false,
        encodeRedirectInUrl: false,
      },
    } as WebExperimentConfig,
  };

  // Apply overrides with smart merging for nested objects
  if (overrides) {
    Object.keys(overrides).forEach((key) => {
      if (key === 'location') {
        // already applied above
        return;
      } else if (key === 'document' && typeof overrides[key] === 'object') {
        // Merge document properties
        baseGlobal.document = createDocumentMock(
          overrides[key] as Record<string, unknown>,
        );
      } else if (key === 'history' && typeof overrides[key] === 'object') {
        baseGlobal.history = {
          ...baseGlobal.history,
          ...(overrides[key] as Record<string, unknown>),
        } as typeof baseGlobal.history;
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
