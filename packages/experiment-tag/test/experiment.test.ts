import * as experimentCore from '@amplitude/experiment-core';
import { ExperimentClient } from '@amplitude/experiment-js-client';
import { Base64 } from 'js-base64';
import { WebExperiment } from 'src/experiment';
import * as util from 'src/util';
import { stringify } from 'ts-jest';

import { createMutateFlag, createRedirectFlag } from './util/create-flag';
import { MockHttpClient } from './util/mock-http-client';

let apiKey = 0;

jest.mock('src/messenger', () => {
  return {
    WindowMessenger: {
      setup: jest.fn(),
    },
  };
});

describe('initializeExperiment', () => {
  const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
  jest.spyOn(ExperimentClient.prototype, 'setUser');
  jest.spyOn(ExperimentClient.prototype, 'all');
  jest
    .spyOn(WebExperiment.prototype, 'setUrlChangeListener')
    .mockReturnValue(undefined);
  const mockExposure = jest.spyOn(ExperimentClient.prototype, 'exposure');
  jest.spyOn(util, 'UUID').mockReturnValue('mock');
  let mockGlobal;

  beforeEach(() => {
    apiKey++;
    jest.clearAllMocks();
    jest.spyOn(experimentCore, 'isLocalStorageAvailable').mockReturnValue(true);
    mockGlobal = {
      localStorage: {
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
    };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);
  });

  test('should initialize experiment with empty user', () => {
    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify([]),
    );
    webExperiment.initializeExperiment();
    expect(ExperimentClient.prototype.setUser).toHaveBeenCalledWith({
      device_id: 'mock',
      web_exp_id: 'mock',
    });
    expect(mockGlobal.localStorage.setItem).toHaveBeenCalledWith(
      'EXP_' + stringify(apiKey),
      JSON.stringify({ device_id: 'mock', web_exp_id: 'mock' }),
    );
  });

  test('experiment should not run without localStorage', () => {
    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify([]),
    );
    jest
      .spyOn(experimentCore, 'isLocalStorageAvailable')
      .mockReturnValue(false);
    webExperiment.initializeExperiment();
    expect(mockGlobal.localStorage.getItem).toHaveBeenCalledTimes(0);
  });

  test('treatment variant on control page - should redirect and call exposure', () => {
    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'treatment', 'http://test.com/2'),
      ]),
    );
    webExperiment.initializeExperiment();

    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('control variant on control page - should not redirect but call exposure', () => {
    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'control', 'http://test.com/2'),
      ]),
    );
    webExperiment.initializeExperiment();
    expect(mockGlobal.location.replace).toBeCalledTimes(0);
    expect(mockExposure).toHaveBeenCalledWith('test');
    expect(mockGlobal.history.replaceState).toBeCalledTimes(0);
  });

  test('preview - force control variant', () => {
    const mockGlobal = {
      localStorage: {
        getItem: jest.fn().mockReturnValue(undefined),
        setItem: jest.fn(),
      },
      location: {
        href: 'http://test.com',
        replace: jest.fn(),
        search: '?test=control&PREVIEW=true',
      },

      document: { referrer: '' },
      history: { replaceState: jest.fn() },
    };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);

    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'treatment', 'http://test.com/2'),
      ]),
    );
    webExperiment.initializeExperiment();
    expect(mockGlobal.location.replace).toHaveBeenCalledTimes(0);
    expect(mockGlobal.history.replaceState).toHaveBeenCalledWith(
      {},
      '',
      'http://test.com/',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('preview - force treatment variant when on control page', () => {
    const mockGlobal = {
      localStorage: {
        getItem: jest.fn().mockReturnValue(undefined),
        setItem: jest.fn(),
      },
      location: {
        href: 'http://test.com/',
        replace: jest.fn(),
        search: '?test=treatment&PREVIEW=true',
      },
      document: { referrer: '' },
      history: { replaceState: jest.fn() },
    };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);

    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'treatment', 'http://test.com/2'),
      ]),
    );
    webExperiment.initializeExperiment();

    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('preview - force treatment variant when on treatment page', () => {
    const mockGlobal = {
      localStorage: {
        getItem: jest.fn().mockReturnValue(undefined),
        setItem: jest.fn(),
      },
      location: {
        href: 'http://test.com/2',
        replace: jest.fn(),
        search: '?test=treatment&PREVIEW=true',
      },
      document: { referrer: '' },
      history: { replaceState: jest.fn() },
    };
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
          segmentName: 'Page not targeted',
          trackExposure: false,
        },
        variant: 'off',
      },
    ];

    const webExperiment = new WebExperiment(
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
    webExperiment.initializeExperiment();

    expect(mockGlobal.location.replace).toHaveBeenCalledTimes(0);
    expect(mockExposure).toHaveBeenCalledTimes(0);
    expect(mockGlobal.history.replaceState).toHaveBeenCalledWith(
      {},
      '',
      'http://test.com/2',
    );
  });

  test('concatenate query params from original and redirected url', () => {
    const mockGlobal = {
      localStorage: {
        getItem: jest.fn().mockReturnValue(undefined),
        setItem: jest.fn(),
      },
      location: {
        href: 'http://test.com/?param1=a&param2=b',
        replace: jest.fn(),
        search: '?param1=a&param2=b',
      },
      document: { referrer: '' },
      history: { replaceState: jest.fn() },
    };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);

    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2?param3=c',
          'http://test.com/',
        ),
      ]),
    );
    webExperiment.initializeExperiment();

    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2?param3=c&param1=a&param2=b',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('should behave as control variant when payload is empty', () => {
    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'control', 'http://test.com/2?param3=c'),
      ]),
    );
    webExperiment.initializeExperiment();

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
          segmentName: 'Page not targeted',
          trackExposure: false,
        },
        variant: 'off',
      },
    ];
    const webExperiment = new WebExperiment(
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
    webExperiment.initializeExperiment();
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
          segmentName: 'Page is excluded',
          trackExposure: false,
        },
        variant: 'off',
      },
    ];
    const webExperiment = new WebExperiment(
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
    webExperiment.initializeExperiment();
    expect(mockExposure).not.toHaveBeenCalled();
  });

  test('remote evaluation - request web remote flags', () => {
    const mockUser = { user_id: 'user_id', device_id: 'device_id' };
    jest.spyOn(ExperimentClient.prototype, 'getUser').mockReturnValue(mockUser);

    const initialFlags = [
      // remote flag
      createMutateFlag('test-2', 'treatment', [], [], [], 'remote'),
    ];

    const mockHttpClient = new MockHttpClient(JSON.stringify([]));

    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      {
        httpClient: mockHttpClient,
      },
    );
    webExperiment.initializeExperiment().then(() => {
      expect(mockHttpClient.requestUrl).toBe(
        'https://flag.lab.amplitude.com/sdk/v2/flags?delivery_method=web',
      );
      // check flag fetch called with correct query param and header
      expect(mockHttpClient.requestHeader['X-Amp-Exp-User']).toBe(
        Base64.encodeURL(JSON.stringify(mockUser)),
      );
    });
  });

  test('remote evaluation - fetch successful', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag('test-2', 'treatment', [], [], [], 'remote'),
      // local flag
      createMutateFlag('test-1', 'treatment'),
    ];
    const remoteFlags = [createMutateFlag('test-2', 'treatment')];

    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags));

    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      {
        httpClient: mockHttpClient,
      },
    );
    webExperiment.initializeExperiment().then(() => {
      // check remote flag variant actions called after successful fetch
      expect(mockExposure).toHaveBeenCalledTimes(2);
      expect(mockExposure).toHaveBeenCalledWith('test-2');
    });
    // check local flag variant actions called
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test-1');
  });

  test('remote evaluation - fetch fail, locally evaluate remote and local flags success', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag('test-2', 'treatment', [], [], [], 'remote'),
      // local flag
      createMutateFlag('test-1', 'treatment'),
    ];
    const remoteFlags = [createMutateFlag('test-2', 'treatment')];

    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags), 404);

    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      {
        httpClient: mockHttpClient,
      },
    );
    webExperiment.initializeExperiment().then(() => {
      // check remote fetch failed safely
      expect(mockExposure).toHaveBeenCalledTimes(2);
    });
    // check local flag variant actions called
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test-1');
  });

  test('remote evaluation - fetch fail, test initialFlags variant actions called', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag('test', 'treatment', [], [], [], 'remote'),
    ];

    const mockHttpClient = new MockHttpClient('', 404);

    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      {
        httpClient: mockHttpClient,
      },
    );
    webExperiment.initializeExperiment().then(() => {
      // check remote variant actions applied
      expect(mockExposure).toHaveBeenCalledTimes(1);
      expect(mockExposure).toHaveBeenCalledWith('test');
    });
    // check local flag variant actions called
    expect(mockExposure).toHaveBeenCalledTimes(0);
  });

  test('remote evaluation - test preview successful, does not fetch remote flags', () => {
    const mockGlobal = {
      localStorage: {
        getItem: jest.fn().mockReturnValue(undefined),
        setItem: jest.fn(),
      },
      location: {
        href: 'http://test.com/',
        replace: jest.fn(),
        search: '?test=treatment&PREVIEW=true',
      },
      document: { referrer: '' },
      history: { replaceState: jest.fn() },
    };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);
    const initialFlags = [
      // remote flag
      createMutateFlag('test', 'treatment', [], [], [], 'remote'),
    ];
    const remoteFlags = [createMutateFlag('test', 'treatment')];
    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags), 200);
    const doFlagsMock = jest.spyOn(
      ExperimentClient.prototype as any,
      'doFlags',
    );
    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      {
        httpClient: mockHttpClient,
      },
    );
    webExperiment.initializeExperiment().then(() => {
      // check remote fetch not called
      expect(doFlagsMock).toHaveBeenCalledTimes(0);
    });
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

    const webExperiment = new WebExperiment(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      {
        httpClient: mockHttpClient,
      },
    );
    await webExperiment.initializeExperiment();
    // check treatment variant called
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test');
    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );
  });
});
