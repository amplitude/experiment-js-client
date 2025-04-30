import * as experimentCore from '@amplitude/experiment-core';
import { safeGlobal } from '@amplitude/experiment-core';
import { ExperimentClient } from '@amplitude/experiment-js-client';
import { Base64 } from 'js-base64';
import {
  PAGE_IS_EXCLUDED_SEGMENT_NAME,
  PAGE_NOT_TARGETED_SEGMENT_NAME,
  DefaultWebExperimentClient,
} from 'src/experiment';
import * as util from 'src/util';
import { stringify } from 'ts-jest';

import {
  createFlag,
  createMutateFlag,
  createRedirectFlag,
} from './util/create-flag';
import { MockHttpClient } from './util/mock-http-client';

let apiKey = 0;

jest.mock('src/messenger', () => {
  return {
    WindowMessenger: {
      setup: jest.fn(),
    },
  };
});

const newMockGlobal = (overrides?: Record<string, unknown>) => {
  return {
    localStorage: {
      getItem: jest.fn().mockReturnValue(undefined),
      setItem: jest.fn(),
    },
    sessionStorage: {
      getItem: jest.fn().mockReturnValue(undefined),
      setItem: jest.fn(),
    },
    location: {
      href: 'http://test.com',
      replace: jest.fn(),
      search: '',
    },
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
    ...overrides,
  };
};

describe('initializeExperiment', () => {
  const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
  jest.spyOn(ExperimentClient.prototype, 'setUser');
  jest.spyOn(ExperimentClient.prototype, 'all');
  const mockExposure = jest.spyOn(ExperimentClient.prototype, 'exposure');
  jest.spyOn(util, 'UUID').mockReturnValue('mock');
  let mockGlobal;
  let antiFlickerSpy;

  beforeEach(() => {
    apiKey++;
    jest.clearAllMocks();
    jest.spyOn(experimentCore, 'isLocalStorageAvailable').mockReturnValue(true);
    mockGlobal = newMockGlobal();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);
    antiFlickerSpy = jest
      .spyOn(DefaultWebExperimentClient.prototype as any, 'applyAntiFlickerCss')
      .mockImplementation(jest.fn());
    // Mock runAfterHydration to execute callbacks immediately
    jest.spyOn(util, 'runAfterHydration').mockImplementation((callback) => {
      callback();
    });
  });

  test('should initialize experiment with empty user', () => {
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([]),
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
    const setDefaultSpy = jest.spyOn(
      DefaultWebExperimentClient.prototype as any,
      'setDefaultNavigationHandler',
    );
    const initialFlags = [
      // remote flag
      createMutateFlag('test-2', 'treatment', [], [], 'remote'),
      // local flag
      createMutateFlag('test-1', 'treatment'),
    ];
    const remoteFlags = [createMutateFlag('test-2', 'treatment')];

    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags));

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      {
        httpClient: mockHttpClient,
      },
    )
      .start()
      .then();
    expect(setDefaultSpy).not.toHaveBeenCalled();
  });

  test('experiment should not run without localStorage', async () => {
    jest
      .spyOn(experimentCore, 'isLocalStorageAvailable')
      .mockReturnValue(false);
    try {
      await DefaultWebExperimentClient.getInstance(
        stringify(apiKey),
        JSON.stringify([]),
      ).start();
    } catch (error: any) {
      expect(error.message).toBe(
        'Amplitude Web Experiment Client could not be initialized.',
      );
    }
    expect(mockGlobal.localStorage.getItem).toHaveBeenCalledTimes(0);
  });

  test('treatment variant on control page - should redirect and call exposure', () => {
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'treatment', 'http://test.com/2'),
      ]),
    ).start();
    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('control variant on control page - should not redirect but call exposure', () => {
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'control', 'http://test.com/2'),
      ]),
    ).start();
    expect(mockGlobal.location.replace).toBeCalledTimes(0);
    expect(mockExposure).toHaveBeenCalledWith('test');
    expect(mockGlobal.history.replaceState).toBeCalledTimes(0);
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
    ).start();
    expect(mockGlobal.location.replace).toHaveBeenCalledTimes(0);
    expect(mockGlobal.history.replaceState).toHaveBeenCalledWith(
      {},
      '',
      'http://test.com/',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('preview - force treatment variant when on control page', () => {
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

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'treatment', 'http://test.com/2'),
      ]),
    ).start();

    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
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

    const pageTargetingSegments = [
      {
        conditions: [
          [
            {
              op: 'regex does not match',
              selector: ['context', 'page', 'url'],
              values: ['^http:\\/\\/test.com/$'],
            },
          ],
        ],
        metadata: {
          segmentName: PAGE_NOT_TARGETED_SEGMENT_NAME,
          trackExposure: false,
        },
        variant: 'off',
      },
    ];

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2',
          undefined,
          pageTargetingSegments,
        ),
      ]),
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

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2?param3=c',
          'http://test.com/',
        ),
      ]),
    ).start();

    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2?param3=c&param1=a&param2=b',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('should behave as control variant when payload is empty', () => {
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'control', 'http://test.com/2?param3=c'),
      ]),
    ).start();

    expect(mockGlobal.location.replace).not.toHaveBeenCalled();
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('on targeted page, should call exposure', () => {
    Object.defineProperty(global, 'location', {
      value: {
        href: 'http://test.com',
      },
      writable: true,
    });
    jest.spyOn(experimentCore, 'getGlobalScope');
    const pageTargetingSegments = [
      {
        conditions: [
          [
            {
              op: 'regex does not match',
              selector: ['context', 'page', 'url'],
              values: ['^http:\\/\\/test.*'],
            },
          ],
        ],
        metadata: {
          segmentName: PAGE_NOT_TARGETED_SEGMENT_NAME,
          trackExposure: false,
        },
        variant: 'off',
      },
    ];
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2',
          undefined,
          pageTargetingSegments,
        ),
      ]),
    ).start();
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('on non-targeted page, should not call exposure', () => {
    Object.defineProperty(global, 'location', {
      value: {
        href: 'http://test.com',
      },
      writable: true,
    });
    const pageTargetingSegments = [
      {
        conditions: [
          [
            {
              op: 'regex match',
              selector: ['context', 'page', 'url'],
              values: ['.*test\\.com$'],
            },
          ],
        ],
        metadata: {
          segmentName: PAGE_IS_EXCLUDED_SEGMENT_NAME,
          trackExposure: false,
        },
        variant: 'off',
      },
    ];
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2',
          undefined,
          pageTargetingSegments,
        ),
      ]),
    );
    expect(mockExposure).not.toHaveBeenCalled();
  });

  test('remote evaluation - request web remote flags', () => {
    const mockUser = { user_id: 'user_id', device_id: 'device_id' };
    jest.spyOn(ExperimentClient.prototype, 'getUser').mockReturnValue(mockUser);

    const initialFlags = [
      // remote flag
      createMutateFlag('test-2', 'treatment', [], [], 'remote'),
    ];

    const mockHttpClient = new MockHttpClient(JSON.stringify([]));

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
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
      createMutateFlag('test-2', 'treatment', [{}], [], 'remote'),
      // local flag
      createMutateFlag('test-1', 'treatment', [{}]),
    ];
    const remoteFlags = [createMutateFlag('test-2', 'treatment', [{}])];
    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags));
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
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
      createMutateFlag('test-2', 'treatment', [{}], [], 'remote'),
      // local flag
      createMutateFlag('test-1', 'treatment', [{}]),
    ];
    const remoteFlags = [createMutateFlag('test-2', 'treatment')];

    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags), 404);

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
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
      createMutateFlag('test', 'treatment', [{}], [], 'remote'),
    ];

    const mockHttpClient = new MockHttpClient('', 404);

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
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
        [],
        'remote',
      ),
    ];
    const remoteFlags = [
      createRedirectFlag('test', 'treatment', 'http://test.com/2'),
    ];
    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags), 200);

    await DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      {
        httpClient: mockHttpClient,
      },
    ).start();
    // check treatment variant called
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test');
    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );
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
        [{}],
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
        createMutateFlag('test', 'treatment', [{}], [], 'remote', false, {
          flagVersion: 3,
        }),
      ];
      const remoteFlags = [
        createMutateFlag('test', 'treatment', [{}], [], 'local', false, {
          flagVersion: 4,
        }),
      ];
      const client = DefaultWebExperimentClient.getInstance(
        apiKey,
        JSON.stringify(initialFlags),
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
        [{}],
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
      Object.defineProperty(safeGlobal, 'sessionStorage', {
        value: sessionStorageMock,
      });
      const initialFlags = [
        createMutateFlag('test', 'treatment', [{}], [], 'remote', false, {
          flagVersion: 3,
        }),
      ];
      const remoteFlags = [
        createMutateFlag('test', 'control', [{}], [], 'local', false, {
          flagVersion: 4,
        }),
      ];
      const client = DefaultWebExperimentClient.getInstance(
        apiKey,
        JSON.stringify(initialFlags),
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
    jest.spyOn(util, 'UUID').mockReturnValue('mock');
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
    const targetedSegment = [
      {
        conditions: [
          [
            {
              op: 'regex does not match',
              selector: ['context', 'page', 'url'],
              values: ['^http:\\/\\/test.*'],
            },
          ],
        ],
        metadata: {
          segmentName: PAGE_NOT_TARGETED_SEGMENT_NAME,
          trackExposure: false,
        },
        variant: 'off',
      },
    ];
    const nonTargetedSegment = [
      {
        conditions: [
          [
            {
              op: 'regex match',
              selector: ['context', 'page', 'url'],
              values: ['.*test\\.com$'],
            },
          ],
        ],
        metadata: {
          segmentName: PAGE_IS_EXCLUDED_SEGMENT_NAME,
          trackExposure: false,
        },
        variant: 'off',
      },
    ];
    const webExperiment = new DefaultWebExperimentClient(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'targeted',
          'treatment',
          '',
          undefined,
          targetedSegment,
        ),
        createRedirectFlag(
          'non-targeted',
          'treatment',
          '',
          undefined,
          nonTargetedSegment,
        ),
      ]),
    );
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
        createRedirectFlag('flag-1', 'control', '', undefined, targetedSegment),
        createRedirectFlag('flag-2', 'control', '', undefined),
      ]),
    );
    const variants = webExperiment.getVariants();
    expect(variants['flag-1'].key).toEqual('treatment');
    expect(variants['flag-2'].key).toEqual('control');
  });
});
