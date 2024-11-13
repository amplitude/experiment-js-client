import * as experimentCore from '@amplitude/experiment-core';
import { ExperimentClient } from '@amplitude/experiment-js-client';
import { initializeExperiment } from 'src/experiment';
import * as experiment from 'src/experiment';
import * as util from 'src/util';
import { MockHttpClient } from './util/mock-http-client';
import { createRedirectFlag } from './util/create-flag';

jest.mock('src/messenger', () => {
  return {
    WindowMessenger: {
      setup: jest.fn(),
    },
  };
});

jest.spyOn(experiment, 'setUrlChangeListener').mockReturnValue(undefined);

describe('initializeExperiment', () => {
  const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
  jest.spyOn(ExperimentClient.prototype, 'setUser');
  jest.spyOn(ExperimentClient.prototype, 'all');
  const mockExposure = jest.spyOn(ExperimentClient.prototype, 'exposure');
  jest.spyOn(util, 'UUID').mockReturnValue('mock');
  let mockGlobal;

  beforeEach(() => {
    jest.spyOn(experimentCore, 'isLocalStorageAvailable').mockReturnValue(true);
    jest.clearAllMocks();
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
    initializeExperiment('1', JSON.stringify([]));
    expect(ExperimentClient.prototype.setUser).toHaveBeenCalledWith({
      web_exp_id: 'mock',
    });
    expect(mockGlobal.localStorage.setItem).toHaveBeenCalledWith(
      'EXP_1',
      JSON.stringify({ web_exp_id: 'mock' }),
    );
  });

  test('experiment should not run without localStorage', () => {
    jest
      .spyOn(experimentCore, 'isLocalStorageAvailable')
      .mockReturnValue(false);
    initializeExperiment('2', '');
    expect(mockGlobal.localStorage.getItem).toHaveBeenCalledTimes(0);
  });

  test('treatment variant on control page - should redirect and call exposure', () => {
    initializeExperiment(
      '3',
      JSON.stringify([
        createRedirectFlag('test', 'treatment', 'http://test.com/2'),
      ]),
    );

    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('control variant on control page - should not redirect but call exposure', () => {
    initializeExperiment(
      '4',
      JSON.stringify([
        createRedirectFlag('test', 'control', 'http://test.com/2'),
      ]),
    );

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

    initializeExperiment(
      '5',
      JSON.stringify([
        createRedirectFlag('test', 'treatment', 'http://test.com/2'),
      ]),
    );

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

    initializeExperiment(
      '6',
      JSON.stringify([
        createRedirectFlag('test', 'treatment', 'http://test.com/2'),
      ]),
    );

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

    initializeExperiment(
      '7',
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

    initializeExperiment(
      '8',
      JSON.stringify([
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2?param3=c',
          'http://test.com/',
        ),
      ]),
    );

    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2?param3=c&param1=a&param2=b',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('should behave as control variant when payload is empty', () => {
    initializeExperiment(
      '9',
      JSON.stringify([
        createRedirectFlag('test', 'control', 'http://test.com/2?param3=c'),
      ]),
    );

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
    initializeExperiment(
      '10',
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
    initializeExperiment(
      '11',
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

  test('test remote evaluation successful', async () => {
    const initialRemoteFlags = [
      createRedirectFlag(
        'test',
        'treatment',
        'http://test.com/2',
        undefined,
        undefined,
        'remote',
      ),
    ];
    const remoteFlags = [
      createRedirectFlag('test', 'treatment', 'http://test.com/2'),
    ];

    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags));

    initializeExperiment('12', JSON.stringify(initialRemoteFlags), {
      httpClient: mockHttpClient,
    }).then(() => {
      expect(mockGlobal.location.replace).toHaveBeenCalledWith(
        'http://test.com/2',
      );
      expect(mockExposure).toHaveBeenCalledWith('test');
    });
    // exposure should not have been called before the remote fetch resolves
    expect(mockExposure).toHaveBeenCalledTimes(0);
  });
});
