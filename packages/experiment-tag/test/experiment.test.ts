import * as experimentCore from '@amplitude/experiment-core';
import { safeGlobal } from '@amplitude/experiment-core';
import { ExperimentClient } from '@amplitude/experiment-js-client';
import { Base64 } from 'js-base64';
import { DefaultWebExperimentClient } from 'src/experiment';
import * as uuid from 'src/util/uuid';
import { stringify } from 'ts-jest';

import { createMutateFlag, createRedirectFlag } from './util/create-flag';
import { createPageObject } from './util/create-page-object';
import { MockHttpClient } from './util/mock-http-client';

let apiKey = 0;
const DEFAULT_PAGE_OBJECTS = {
  test: createPageObject('A', 'url_change', undefined, 'http://test.com'),
};
const DEFAULT_REDIRECT_SCOPE = { treatment: ['A'], control: ['A'] };
const DEFAULT_MUTATE_SCOPE = { metadata: { scope: ['A'] } };

jest.mock('src/util/messenger', () => {
  return {
    WindowMessenger: {
      setup: jest.fn(),
    },
  };
});

const newMockGlobal = (overrides?: Record<string, unknown>) => {
  const createStorageMock = () => {
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

  // Base global object first
  const baseGlobal = {
    localStorage: createStorageMock(),
    sessionStorage: createStorageMock(),
    document: { referrer: '' },
    history: { replaceState: jest.fn() },
    addEventListener: jest.fn(),
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
    location: {
      href: 'http://test.com',
      search: '',
      hostname: 'test.com',
      pathname: '/',
      protocol: 'http:',
      port: '',
      host: 'test.com',
      replace: jest.fn(),
    },
  };

  baseGlobal.location.replace = jest.fn((url) => {
    baseGlobal.location.href = url;
  });

  if (overrides) {
    Object.keys(overrides).forEach((key) => {
      if (key === 'location' && typeof overrides[key] === 'object') {
        // Merge location properties but preserve the replace function reference
        const locationOverrides = overrides[key] as any;

        // Store the original replace function
        const originalReplace = baseGlobal.location.replace;

        // Merge properties
        baseGlobal.location = {
          ...baseGlobal.location,
          ...locationOverrides,
        };

        if (!locationOverrides.replace) {
          baseGlobal.location.replace = originalReplace;
        } else if (typeof locationOverrides.replace === 'function') {
          // If override provided a replace function, enhance it to update href
          const customReplace = locationOverrides.replace;
          baseGlobal.location.replace = jest.fn((url) => {
            baseGlobal.location.href = url;
            return customReplace(url);
          });
        }
      } else {
        baseGlobal[key] = overrides[key];
      }
    });
  }

  return baseGlobal;
};

describe('initializeExperiment', () => {
  const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
  jest.spyOn(ExperimentClient.prototype, 'setUser');
  jest.spyOn(ExperimentClient.prototype, 'all');
  const mockExposure = jest.spyOn(ExperimentClient.prototype, 'exposure');
  // Add a spy for the exposureInternal method
  const mockExposureInternal = jest.spyOn(
    ExperimentClient.prototype as any,
    'exposureInternal',
  );
  jest.spyOn(uuid, 'UUID').mockReturnValue('mock');
  let mockGlobal;
  let antiFlickerSpy;

  beforeEach(() => {
    apiKey++;
    jest.clearAllMocks();
    jest.spyOn(experimentCore, 'isLocalStorageAvailable').mockReturnValue(true);

    // Create fresh mock global for each test
    mockGlobal = newMockGlobal();

    // Ensure the mock is properly set
    mockGetGlobalScope.mockReturnValue(mockGlobal);
    antiFlickerSpy = jest
      .spyOn(DefaultWebExperimentClient.prototype as any, 'applyAntiFlickerCss')
      .mockImplementation(jest.fn());
  });

  test('should initialize experiment with empty user', () => {
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([]),
      JSON.stringify({}),
    ).start();
    expect(ExperimentClient.prototype.setUser).toHaveBeenCalledWith({
      web_exp_id: 'mock',
    });
    expect(mockGlobal.localStorage.setItem).toHaveBeenCalledWith(
      'EXP_' + stringify(apiKey),
      JSON.stringify({ web_exp_id: 'mock' }),
    );
  });

  test('set web experiment config', () => {
    const mockGlobal = newMockGlobal({
      location: {
        href: 'http://test.com',
        replace: jest.fn(),
        search: '?test=control&PREVIEW=true',
      },
      experimentConfig: {
        useDefaultNavigationHandler: false,
      },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);
    const initialFlags = [
      // remote flag
      createMutateFlag('test-2', 'treatment', [], [], 'remote'),
      // local flag
      createMutateFlag('test-1', 'treatment'),
    ];
    const remoteFlags = [createMutateFlag('test-2', 'treatment')];

    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags));

    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify({}),
      {
        httpClient: mockHttpClient,
      },
    );
    expect((client as any).config.useDefaultNavigationHandler).toBe(false);
  });

  test('experiment should not run without localStorage', async () => {
    jest
      .spyOn(experimentCore, 'isLocalStorageAvailable')
      .mockReturnValue(false);
    try {
      await DefaultWebExperimentClient.getInstance(
        stringify(apiKey),
        JSON.stringify([]),
        JSON.stringify({}),
      ).start();
    } catch (error: any) {
      expect(error.message).toBe(
        'Amplitude Web Experiment Client could not be initialized.',
      );
    }
    expect(mockGlobal.localStorage.getItem).toHaveBeenCalledTimes(0);
  });

  test('treatment variant on control page - should redirect and store in sessionStorage', () => {
    // Create a fresh mock global for this test
    mockGlobal = newMockGlobal();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);

    const redirectStorageKey = `EXP_${apiKey.toString().slice(0, 10)}_REDIRECT`;

    // Verify sessionStorage is empty before test
    expect(mockGlobal.sessionStorage.getItem(redirectStorageKey)).toBeNull();

    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2',
          undefined,
          DEFAULT_REDIRECT_SCOPE,
        ),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );

    // Initialize the client to ensure messageBus is created
    client.start();

    // Check redirect was called
    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );

    // Directly check if the value was stored in sessionStorage
    // This bypasses the mock function call history and checks the actual storage
    const storedValue = mockGlobal.sessionStorage.getItem(redirectStorageKey);
    expect(storedValue).not.toBeNull();

    if (storedValue) {
      const storedRedirects = JSON.parse(storedValue);
      expect(storedRedirects).toHaveProperty('test');
    }

    // Clear exposure tracking before simulating URL change
    mockExposureInternal.mockClear();

    // Ensure messageBus exists before publishing
    if ((client as any).messageBus) {
      // Simulate URL change event after redirect
      (client as any).messageBus.publish('url_change', {});

      // Verify exposureInternal was called with the correct flag key
      expect(mockExposureInternal).toHaveBeenCalledTimes(1);
      expect(mockExposureInternal.mock.calls[0][0]).toBe('test');

      // Check that the sourceVariant parameter contains the expected properties
      const sourceVariant: any = mockExposureInternal.mock.calls[0][1];
      expect(sourceVariant).toBeDefined();
      expect(sourceVariant.variant).toBeDefined();
      expect(sourceVariant.variant.key).toBe('treatment');

      // Verify sessionStorage was cleared after tracking
      expect(mockGlobal.sessionStorage.getItem(redirectStorageKey)).toBeNull();
    }
  });

  test('control variant on control page - should not redirect but call exposure', () => {
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'control', 'http://test.com/2'),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    ).start();

    // No redirect should happen
    expect(mockGlobal.location.replace).toBeCalledTimes(0);

    // Exposure should be tracked
    expect(mockExposure).toHaveBeenCalledWith('test');

    // No history manipulation
    expect(mockGlobal.history.replaceState).toBeCalledTimes(0);

    // No redirect info should be stored
    const redirectStorageKey = `EXP_${apiKey.toString().slice(0, 10)}_REDIRECT`;
    const storedRedirectsCall =
      mockGlobal.sessionStorage.setItem.mock.calls.find(
        (call) => call[0] === redirectStorageKey,
      );
    expect(storedRedirectsCall).toBeFalsy();
  });

  test('preview - force control variant', () => {
    const mockGlobal = newMockGlobal({
      location: {
        href: 'http://test.com',
        replace: jest.fn(),
        search: '?test=control&PREVIEW=true',
      },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'treatment', 'http://test.com/2'),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    ).start();
    expect(mockGlobal.location.replace).toHaveBeenCalledTimes(0);
    expect(mockGlobal.history.replaceState).toHaveBeenCalledWith(
      {},
      '',
      'http://test.com/',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('preview - force treatment variant when on control page', async () => {
    const mockGlobal = newMockGlobal({
      location: {
        href: 'http://test.com/',
        search: '?test=treatment&PREVIEW=true',
      },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);

    const redirectStorageKey = `EXP_${apiKey.toString().slice(0, 10)}_REDIRECT`;

    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'control',
          'http://test.com/2',
          undefined,
          DEFAULT_REDIRECT_SCOPE,
        ),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );

    await client.start();

    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );

    // Check if redirect info was stored in sessionStorage
    const storedValue = mockGlobal.sessionStorage.getItem(redirectStorageKey);
    expect(storedValue).not.toBeNull();

    if (storedValue) {
      const storedRedirects = JSON.parse(storedValue);
      expect(storedRedirects).toHaveProperty('test');
    }

    // Clear exposure tracking before simulating URL change
    mockExposureInternal.mockClear();
    mockExposure.mockClear();

    // Simulate URL change event after redirect
    (client as any).messageBus.publish('url_change', {});

    // Verify exposureInternal was called with the correct flag key
    expect(mockExposureInternal).toHaveBeenCalledTimes(1);
    expect(mockExposureInternal.mock.calls[0][0]).toBe('test');

    // Check that the sourceVariant parameter contains the expected properties
    const sourceVariant: any = mockExposureInternal.mock.calls[0][1];
    expect(sourceVariant).toBeDefined();
    expect(sourceVariant.variant).toBeDefined();
    expect(sourceVariant.variant.key).toBe('treatment'); // Preview forces treatment

    // Verify sessionStorage was cleared after tracking
    expect(mockGlobal.sessionStorage.getItem(redirectStorageKey)).toBeNull();
  });

  test('preview - force treatment variant when on treatment page', () => {
    const mockGlobal = newMockGlobal({
      location: {
        href: 'http://test.com/2',
        replace: jest.fn(),
        search: '?test=treatment&PREVIEW=true',
      },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'treatment', 'http://test.com/2', undefined),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );

    expect(mockGlobal.location.replace).toHaveBeenCalledTimes(0);
    expect(mockExposure).toHaveBeenCalledTimes(0);
    expect(mockGlobal.history.replaceState).toHaveBeenCalledWith(
      {},
      '',
      'http://test.com/2',
    );
  });

  test('concatenate query params from original and redirected url', () => {
    const mockGlobal = newMockGlobal({
      location: {
        href: 'http://test.com/?param1=a&param2=b',
        replace: jest.fn(),
        search: '?param1=a&param2=b',
      },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);

    const redirectStorageKey = `EXP_${apiKey.toString().slice(0, 10)}_REDIRECT`;

    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2?param3=c',
          'http://test.com/',
          DEFAULT_REDIRECT_SCOPE,
        ),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );

    client.start();

    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2?param3=c&param1=a&param2=b',
    );

    // Check if redirect info was stored in sessionStorage
    const storedValue = mockGlobal.sessionStorage.getItem(redirectStorageKey);
    expect(storedValue).not.toBeNull();

    if (storedValue) {
      const storedRedirects = JSON.parse(storedValue);
      expect(storedRedirects).toHaveProperty('test');
    }

    // Clear exposure tracking before simulating URL change
    mockExposureInternal.mockClear();
    mockExposure.mockClear();

    // Simulate URL change event after redirect
    (client as any).messageBus.publish('url_change', {});

    // Verify exposureInternal was called with the correct flag key
    expect(mockExposureInternal).toHaveBeenCalledTimes(1);
    expect(mockExposureInternal.mock.calls[0][0]).toBe('test');

    // Check that the sourceVariant parameter contains the expected properties
    const sourceVariant: any = mockExposureInternal.mock.calls[0][1];
    expect(sourceVariant).toBeDefined();
    expect(sourceVariant.variant).toBeDefined();
    expect(sourceVariant.variant.key).toBe('treatment');

    // Verify sessionStorage was cleared after tracking
    expect(mockGlobal.sessionStorage.getItem(redirectStorageKey)).toBeNull();
  });

  test('should behave as control variant when payload is empty', () => {
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'control',
          'http://test.com/2?param3=c',
          undefined,
          DEFAULT_REDIRECT_SCOPE,
        ),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    ).start();

    expect(mockGlobal.location.replace).not.toHaveBeenCalled();
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('on targeted page, should call exposure and store in sessionStorage', () => {
    // Create a fresh mock global
    const mockGlobal = newMockGlobal({
      location: {
        href: 'http://test.com',
        replace: jest.fn(),
      },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);

    const redirectStorageKey = `EXP_${apiKey.toString().slice(0, 10)}_REDIRECT`;

    // Verify sessionStorage is empty before test
    expect(mockGlobal.sessionStorage.getItem(redirectStorageKey)).toBeNull();

    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2',
          undefined,
          DEFAULT_REDIRECT_SCOPE,
        ),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );

    // Initialize the client to ensure messageBus is created
    client.start();

    // Check redirect was called
    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );

    // Check if redirect info was stored in sessionStorage
    const storedValue = mockGlobal.sessionStorage.getItem(redirectStorageKey);
    expect(storedValue).not.toBeNull();

    if (storedValue) {
      const storedRedirects = JSON.parse(storedValue);
      expect(storedRedirects).toHaveProperty('test');
    }

    // Clear exposure tracking before simulating URL change
    mockExposureInternal.mockClear();
    mockExposure.mockClear();

    // Ensure messageBus exists before publishing
    if ((client as any).messageBus) {
      // Simulate URL change event after redirect
      (client as any).messageBus.publish('url_change', {});

      // Verify exposureInternal was called with the correct flag key
      expect(mockExposureInternal).toHaveBeenCalledTimes(1);
      expect(mockExposureInternal.mock.calls[0][0]).toBe('test');

      // Check that the sourceVariant parameter contains the expected properties
      const sourceVariant: any = mockExposureInternal.mock.calls[0][1];
      expect(sourceVariant).toBeDefined();
      expect(sourceVariant.variant).toBeDefined();
      expect(sourceVariant.variant.key).toBe('treatment');

      // Verify sessionStorage was cleared after tracking
      expect(mockGlobal.sessionStorage.getItem(redirectStorageKey)).toBeNull();
    }
  });

  test('on non-targeted page, should not call exposure', () => {
    Object.defineProperty(global, 'location', {
      value: {
        href: 'http://non-targeted.com',
      },
      writable: true,
    });
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2',
          undefined,
          DEFAULT_REDIRECT_SCOPE,
        ),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );
    expect(mockExposure).not.toHaveBeenCalled();
  });

  test('remote evaluation - request web remote flags', () => {
    const mockUser = { user_id: 'user_id', device_id: 'device_id' };
    jest.spyOn(ExperimentClient.prototype, 'getUser').mockReturnValue(mockUser);

    const initialFlags = [
      // remote flag
      createMutateFlag('test', 'treatment', [], [], 'remote'),
    ];

    const mockHttpClient = new MockHttpClient(JSON.stringify([]));

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
      {
        httpClient: mockHttpClient,
      },
    )
      .start()
      .then(() => {
        expect(mockHttpClient.requestUrl).toBe(
          'https://flag.lab.amplitude.com/sdk/v2/flags?delivery_method=web',
        );
        // check flag fetch called with correct query param and header
        expect(mockHttpClient.requestHeader['X-Amp-Exp-User']).toBe(
          Base64.encodeURL(JSON.stringify(mockUser)),
        );
      });
  });

  test('remote evaluation - fetch successful, antiflicker applied', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag(
        'test-2',
        'treatment',
        [DEFAULT_MUTATE_SCOPE],
        [],
        'remote',
      ),
      // local flag
      createMutateFlag('test-1', 'treatment', [DEFAULT_MUTATE_SCOPE]),
    ];
    const remoteFlags = [
      createMutateFlag('test-2', 'treatment', [DEFAULT_MUTATE_SCOPE]),
    ];
    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags));
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify({
        'test-1': createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
        'test-2': createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
      }),
      {
        httpClient: mockHttpClient,
      },
    )
      .start()
      .then(() => {
        // check remote flag variant actions called after successful fetch
        expect(mockExposure).toHaveBeenCalledTimes(2);
        expect(mockExposure).toHaveBeenCalledWith('test-2');
      });
    // check local flag variant actions called
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test-1');
    expect(antiFlickerSpy).toHaveBeenCalledTimes(1);
  });

  test('remote evaluation - fetch fail, locally evaluate remote and local flags success', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag(
        'test-2',
        'treatment',
        [DEFAULT_MUTATE_SCOPE],
        [],
        'remote',
        true,
        {},
      ),
      // local flag
      createMutateFlag(
        'test-1',
        'treatment',
        [DEFAULT_MUTATE_SCOPE],
        [],
        'local',
        true,
        {},
      ),
    ];
    const remoteFlags = [createMutateFlag('test-2', 'treatment')];

    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags), 404);

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify({
        'test-1': createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
        'test-2': createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
      }),
      {
        httpClient: mockHttpClient,
      },
    )
      .start()
      .then(() => {
        // check remote fetch failed safely
        expect(mockExposure).toHaveBeenCalledTimes(2);
      });
    // check local flag variant actions called
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test-1');
    expect(antiFlickerSpy).toHaveBeenCalledTimes(1);
  });

  test('remote evaluation - fetch fail, test initialFlags variant actions called', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag(
        'test',
        'treatment',
        [DEFAULT_MUTATE_SCOPE],
        [],
        'remote',
      ),
    ];

    const mockHttpClient = new MockHttpClient('', 404);

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
      {
        httpClient: mockHttpClient,
      },
    )
      .start()
      .then(() => {
        // check remote variant actions applied
        expect(mockExposure).toHaveBeenCalledTimes(1);
        expect(mockExposure).toHaveBeenCalledWith('test');
      });
    // check local flag variant actions called
    expect(mockExposure).toHaveBeenCalledTimes(0);
    expect(antiFlickerSpy).toHaveBeenCalledTimes(1);
  });

  test('remote evaluation - test preview successful, does not fetch remote flags', () => {
    const mockGlobal = newMockGlobal({
      location: {
        href: 'http://test.com/',
        replace: jest.fn(),
        search: '?test=treatment&PREVIEW=true',
      },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);
    const initialFlags = [
      // remote flag
      createMutateFlag('test', 'treatment', [], [], 'remote'),
    ];
    const remoteFlags = [createMutateFlag('test', 'treatment')];
    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags), 200);
    const doFlagsMock = jest.spyOn(
      ExperimentClient.prototype as any,
      'doFlags',
    );
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
      {
        httpClient: mockHttpClient,
      },
    )
      .start()
      .then(() => {
        // check remote fetch not called
        expect(doFlagsMock).toHaveBeenCalledTimes(0);
      });
    expect(antiFlickerSpy).toHaveBeenCalledTimes(0);
  });

  test('remote evaluation - fetch successful, fetched flag overwrites initial flag', async () => {
    const initialFlags = [
      // remote flag
      createRedirectFlag(
        'test',
        'control',
        'http://test.com/2',
        undefined,
        DEFAULT_REDIRECT_SCOPE,
        undefined,
        'remote',
      ),
    ];
    const remoteFlags = [
      createRedirectFlag(
        'test',
        'treatment',
        'http://test.com/2',
        undefined,
        DEFAULT_REDIRECT_SCOPE,
      ),
    ];
    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags), 200);
    const mockGlobal = newMockGlobal();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);

    const redirectStorageKey = `EXP_${apiKey.toString().slice(0, 10)}_REDIRECT`;

    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
      {
        httpClient: mockHttpClient,
      },
    );

    await client.start();

    // check treatment variant called
    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );

    // Check if redirect info was stored in sessionStorage
    const storedValue = mockGlobal.sessionStorage.getItem(redirectStorageKey);
    expect(storedValue).not.toBeNull();

    if (storedValue) {
      const storedRedirects = JSON.parse(storedValue);
      expect(storedRedirects).toHaveProperty('test');
    }

    // Clear exposure tracking before simulating URL change
    mockExposureInternal.mockClear();
    mockExposure.mockClear();

    // Simulate URL change event after redirect
    (client as any).messageBus.publish('url_change', {});

    // Verify exposureInternal was called with the correct flag key
    expect(mockExposureInternal).toHaveBeenCalledTimes(1);
    expect(mockExposureInternal.mock.calls[0][0]).toBe('test');

    // Check that the sourceVariant parameter contains the expected properties
    const sourceVariant: any = mockExposureInternal.mock.calls[0][1];
    expect(sourceVariant).toBeDefined();
    expect(sourceVariant.variant).toBeDefined();
    expect(sourceVariant.variant.key).toBe('treatment');

    // Verify sessionStorage was cleared after tracking
    expect(mockGlobal.sessionStorage.getItem(redirectStorageKey)).toBeNull();
  });

  test('scoped mutations - experiment active, both mutations active on same page', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag(
        'test',
        'treatment',
        [DEFAULT_MUTATE_SCOPE, DEFAULT_MUTATE_SCOPE],
        [],
      ),
    ];
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );
    client.start().then();
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test');
    const appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).includes('test')).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test']).includes('treatment'),
    ).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test']['treatment']).includes('mutate'),
    ).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test']['treatment']['mutate']).length,
    ).toEqual(2);
  });

  test('scoped mutations - experiment active, both mutations active on different pages', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag('test', 'treatment', [
        { metadata: { scope: ['A'] } },
        { metadata: { scope: ['B'] } },
      ]),
    ];
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify({
        test: {
          ...createPageObject('A', 'url_change', undefined, 'http://test.com'),
          ...createPageObject('B', 'url_change', undefined, 'http://test.com'),
        },
      }),
    );
    client.start().then();
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test');
    const appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).includes('test')).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test']).includes('treatment'),
    ).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test']['treatment']).includes('mutate'),
    ).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test']['treatment']['mutate']).length,
    ).toEqual(2);
    expect(
      Object.keys(appliedMutations['test']['treatment']['mutate']),
    ).toEqual(['0', '1']);
  });

  test('Visual editor mode - active pages updated but variant actions not applied', () => {
    const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
    mockGetGlobalScope.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      newMockGlobal({
        location: {
          href: 'http://A.com',
          search: '?VISUAL_EDITOR=true',
        },
      }),
    );
    const test1Page = createPageObject(
      'A',
      'url_change',
      undefined,
      'http://A.com',
    );
    const test2Page = createPageObject(
      'B',
      'url_change',
      undefined,
      'http://B.com',
    );
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createMutateFlag('test-1', 'treatment', [{ metadata: {} }]),
        createMutateFlag('test-2', 'treatment', [{ metadata: {} }]),
      ]),
      JSON.stringify({
        'test-1': test1Page,
        'test-2': test2Page,
      }),
    );
    client.start().then();
    let activePages = (client as any).activePages;
    expect(activePages).toEqual({ 'test-1': test1Page });
    (client as any).subscriptionManager.globalScope = newMockGlobal({
      location: {
        href: 'http://B.com',
      },
    });
    activePages = (client as any).activePages;
    (client as any).messageBus.publish('url_change', {});
    expect(activePages).toEqual({ 'test-2': test2Page });
    expect(mockExposure).toHaveBeenCalledTimes(0);
    const appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).length).toEqual(0);
  });

  test('scoped mutations - experiment active, subset of mutations active', () => {
    const initialFlags = [
      createMutateFlag('test', 'treatment', [
        { metadata: { scope: ['B'] } },
        { metadata: { scope: ['A'] } },
      ]),
    ];
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );
    client.start().then();
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test');
    const appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).includes('test')).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test']).includes('treatment'),
    ).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test']['treatment']).includes('mutate'),
    ).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test']['treatment']['mutate']).length,
    ).toEqual(1);
    expect(
      Object.keys(appliedMutations['test']['treatment']['mutate']),
    ).toEqual(['1']);
  });

  test('scoped mutations - experiment active, neither mutation active', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag('test', 'treatment', [
        { metadata: { scope: ['B'] } },
        { metadata: { scope: ['C'] } },
      ]),
    ];
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );
    client.start().then();
    expect(mockExposure).toHaveBeenCalledTimes(0);
    const appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).length).toEqual(0);
  });

  test('scoped mutations - experiment active, 1 active mutation with no scope, 1 mutation inactive', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag('test', 'treatment', [
        { metadata: {} },
        { metadata: { scope: ['B'] } },
      ]),
    ];
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );
    client.start().then();
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test');
    const appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).includes('test')).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test']).includes('treatment'),
    ).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test']['treatment']).includes('mutate'),
    ).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test']['treatment']['mutate']).length,
    ).toEqual(1);
    expect(
      Object.keys(appliedMutations['test']['treatment']['mutate']),
    ).toEqual(['0']);
  });

  test('page object - update activePages and applyVariants upon navigation', () => {
    const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
    mockGetGlobalScope.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      newMockGlobal({
        location: {
          href: 'http://A.com',
        },
      }),
    );
    const test1Page = createPageObject(
      'A',
      'url_change',
      undefined,
      'http://A.com',
    );
    const test2Page = createPageObject(
      'B',
      'url_change',
      undefined,
      'http://B.com',
    );
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createMutateFlag('test-1', 'treatment', [{ metadata: {} }]),
        createMutateFlag('test-2', 'treatment', [{ metadata: {} }]),
      ]),
      JSON.stringify({
        'test-1': test1Page,
        'test-2': test2Page,
      }),
    );
    client.start().then();
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test-1');
    let appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).includes('test-1')).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test-1']).includes('treatment'),
    ).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test-1']['treatment']).includes('mutate'),
    ).toBeTruthy();
    const activePages = (client as any).activePages;
    expect(activePages).toEqual({ 'test-1': test1Page });
    expect(Object.keys(appliedMutations['test-1']['treatment']).length).toEqual(
      1,
    );
    (client as any).subscriptionManager.globalScope = newMockGlobal({
      location: {
        href: 'http://B.com',
      },
    });
    (client as any).messageBus.publish('url_change', {});
    expect(activePages).toEqual({ 'test-2': test2Page });
    expect(mockExposure).toHaveBeenCalledTimes(2);
    expect(mockExposure).toHaveBeenCalledWith('test-2');
    appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).includes('test-2')).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test-2']).includes('treatment'),
    ).toBeTruthy();
    expect(
      Object.keys(appliedMutations['test-2']['treatment']).includes('mutate'),
    ).toBeTruthy();
    expect(Object.keys(appliedMutations['test-2']['treatment']).length).toEqual(
      1,
    );
  });

  test('applyVariants should fire stored redirect impressions', () => {
    // Create a fresh mock global
    const mockGlobal = newMockGlobal({
      location: {
        href: 'http://test.com/2',
      },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);

    const redirectStorageKey = `EXP_${apiKey.toString().slice(0, 10)}_REDIRECT`;

    // Set up stored redirect data in sessionStorage
    const storedRedirects = {
      'test-redirect': {
        variant: { key: 'treatment' },
        redirectUrl: 'http://test.com/2',
      },
    };
    mockGlobal.sessionStorage.setItem(
      redirectStorageKey,
      JSON.stringify(storedRedirects),
    );

    // Create client with some flags (not the stored redirect flag)
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createMutateFlag('other-flag', 'treatment', [DEFAULT_MUTATE_SCOPE]),
      ]),
      JSON.stringify({
        'other-flag': createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
      }),
    );

    // Clear exposure tracking before test
    mockExposureInternal.mockClear();
    mockExposure.mockClear();

    client.applyVariants();

    // Verify exposureInternal was called with the correct flag key
    expect(mockExposureInternal).toHaveBeenCalledTimes(1);
    expect(mockExposureInternal.mock.calls[0][0]).toBe('test-redirect');

    // Check that the sourceVariant parameter contains the expected properties
    const sourceVariant: any = mockExposureInternal.mock.calls[0][1];
    expect(sourceVariant).toBeDefined();
    expect(sourceVariant.variant).toBeDefined();
    expect(sourceVariant.variant.key).toBe('treatment');

    // Verify sessionStorage was cleared
    expect(mockGlobal.sessionStorage.getItem(redirectStorageKey)).toBeNull();
  });

  describe('remote evaluation - flag already stored in session storage', () => {
    const sessionStorageMock = () => {
      let store = {};
      return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => {
          store[key] = value;
        }),
        removeItem: jest.fn((key) => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        }),
      };
    };
    beforeEach(() => {
      Object.defineProperty(safeGlobal, 'sessionStorage', {
        value: sessionStorageMock(),
      });
    });
    afterEach(() => {
      safeGlobal.sessionStorage.clear();
    });
    test('evaluated, applied, and impression tracked, start updates flag in storage, applied, impression deduped', async () => {
      const apiKey = 'api1';
      const storageKey = `amp-exp-$default_instance-web-${apiKey}-flags`;
      // Create mock session storage with initial value
      const storedFlag = createMutateFlag(
        'test',
        'treatment',
        [DEFAULT_MUTATE_SCOPE],
        [],
        'local',
        false,
        {
          flagVersion: 2,
        },
      );
      safeGlobal.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ test: storedFlag }),
      );
      const initialFlags = [
        createMutateFlag('test', 'treatment', [], [], 'remote', false, {
          flagVersion: 3,
        }),
      ];
      const remoteFlags = [
        createMutateFlag(
          'test',
          'treatment',
          [DEFAULT_MUTATE_SCOPE],
          [],
          'local',
          false,
          {
            flagVersion: 4,
          },
        ),
      ];
      const client = DefaultWebExperimentClient.getInstance(
        apiKey,
        JSON.stringify(initialFlags),
        JSON.stringify(DEFAULT_PAGE_OBJECTS),
        {
          httpClient: new MockHttpClient(JSON.stringify(remoteFlags), 200),
        },
      );
      const integrationManagerTrack = jest.spyOn(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        client.getExperimentClient().integrationManager,
        'track',
      );
      let version = client.getExperimentClient().variant('test')
        .metadata?.flagVersion;
      expect(version).toEqual(2);
      await client.start();
      version = client.getExperimentClient().variant('test')
        .metadata?.flagVersion;
      expect(version).toEqual(4);
      // check exposure tracked once
      expect(mockExposure).toHaveBeenCalledTimes(1);
      // Check remote flag store in storage
      const flags = JSON.parse(
        safeGlobal.sessionStorage.getItem(storageKey) as string,
      );
      expect(flags['test'].metadata.flagVersion).toEqual(4);
      expect(flags['test'].metadata.evaluationMode).toEqual('local');
      expect(integrationManagerTrack).toBeCalledTimes(1);
      const call = integrationManagerTrack.mock.calls[0][0] as unknown as {
        flag_key: string;
        metadata: Record<string, unknown>;
      };
      expect(call.flag_key).toEqual('test');
      expect(call.metadata.flagVersion).toEqual(2);
    });
    test('evaluated, applied, and impression tracked, start updates flag in storage, applied, impression re-tracked', async () => {
      const apiKey = 'api2';
      const storageKey = `amp-exp-$default_instance-web-${apiKey}-flags`;
      // Create mock session storage with initial value
      const storedFlag = createMutateFlag(
        'test',
        'treatment',
        [DEFAULT_MUTATE_SCOPE],
        [],
        'local',
        false,
        {
          flagVersion: 2,
        },
      );
      safeGlobal.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ test: storedFlag }),
      );
      const initialFlags = [
        createMutateFlag(
          'test',
          'treatment',
          [DEFAULT_MUTATE_SCOPE],
          [],
          'remote',
          false,
          {
            flagVersion: 3,
          },
        ),
      ];
      const remoteFlags = [
        createMutateFlag(
          'test',
          'control',
          [DEFAULT_MUTATE_SCOPE],
          [],
          'local',
          false,
          {
            flagVersion: 4,
          },
        ),
      ];
      const client = DefaultWebExperimentClient.getInstance(
        apiKey,
        JSON.stringify(initialFlags),
        JSON.stringify(DEFAULT_PAGE_OBJECTS),
        {
          httpClient: new MockHttpClient(JSON.stringify(remoteFlags), 200),
        },
      );
      const integrationManagerTrack = jest.spyOn(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        client.getExperimentClient().integrationManager,
        'track',
      );
      let version = client.getExperimentClient().variant('test')
        .metadata?.flagVersion;
      expect(version).toEqual(2);
      await client.start();
      version = client.getExperimentClient().variant('test')
        .metadata?.flagVersion;
      expect(version).toEqual(4);
      // check exposure tracked once
      expect(mockExposure).toHaveBeenCalledTimes(2);
      // Check remote flag store in storage
      const flags = JSON.parse(
        safeGlobal.sessionStorage.getItem(storageKey) as string,
      );
      expect(flags['test'].metadata.flagVersion).toEqual(4);
      expect(flags['test'].metadata.evaluationMode).toEqual('local');
      expect(integrationManagerTrack).toBeCalledTimes(2);
      const call1 = integrationManagerTrack.mock.calls[0][0] as unknown as {
        flag_key: string;
        variant: string;
        metadata: Record<string, unknown>;
      };
      const call2 = integrationManagerTrack.mock.calls[1][0] as unknown as {
        flag_key: string;
        variant: string;
        metadata: Record<string, unknown>;
      };
      expect(call1.flag_key).toEqual('test');
      expect(call1.variant).toEqual('treatment');
      expect(call1.metadata.flagVersion).toEqual(2);
      expect(call2.flag_key).toEqual('test');
      expect(call2.variant).toEqual('control');
      expect(call2.metadata.flagVersion).toEqual(4);
    });
  });
});

test('feature experiment on global Experiment object', () => {
  expect(safeGlobal.Experiment).toBeDefined();
});

describe('helper methods', () => {
  beforeEach(() => {
    const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
    const mockGlobal = newMockGlobal();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);
    apiKey++;
    jest.spyOn(uuid, 'UUID').mockReturnValue('mock');
    jest.clearAllMocks();
  });

  const originalLocation = global.location;

  afterEach(() => {
    Object.defineProperty(global, 'location', {
      value: originalLocation,
      writable: true,
    });
    jest.restoreAllMocks();
  });

  test('get active experiments on current page', () => {
    Object.defineProperty(global, 'location', {
      value: {
        href: 'http://test.com',
      },
      writable: true,
    });
    jest.spyOn(experimentCore, 'getGlobalScope');
    const webExperiment = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createMutateFlag(
          'targeted',
          'treatment',
          [DEFAULT_MUTATE_SCOPE],
          [],
          'local',
        ),
      ]),
      JSON.stringify({
        targeted: createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
        'non-targeted': createPageObject(
          'A',
          'url_change',
          undefined,
          'http://not-targeted.com',
        ),
      }),
    );
    webExperiment.start();
    const activeExperiments = webExperiment.getActiveExperiments();
    expect(activeExperiments).toEqual(['targeted']);
  });

  test('get variants', () => {
    const targetedSegment = [
      {
        metadata: {
          segmentName: 'match segment',
        },
        variant: 'treatment',
      },
    ];
    const webExperiment = new DefaultWebExperimentClient(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'flag-1',
          'control',
          '',
          undefined,
          {},
          targetedSegment,
        ),
        createRedirectFlag('flag-2', 'control', '', undefined),
      ]),
      JSON.stringify({}),
    );
    const variants = webExperiment.getVariants();
    expect(variants['flag-1'].key).toEqual('treatment');
    expect(variants['flag-2'].key).toEqual('control');
  });
});
