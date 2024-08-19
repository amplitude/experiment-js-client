import * as coreUtil from '@amplitude/experiment-core';
import { ExperimentClient } from '@amplitude/experiment-js-client';
import { initializeExperiment } from 'src/experiment';
import * as experiment from 'src/experiment';
import * as util from 'src/util';

jest.mock('src/messenger', () => {
  return {
    WindowMessenger: {
      setup: jest.fn(),
    },
  };
});

jest.spyOn(experiment, 'setUrlChangeListener').mockReturnValue(undefined);

describe('initializeExperiment', () => {
  const mockGetGlobalScope = jest.spyOn(coreUtil, 'getGlobalScope');
  jest.spyOn(ExperimentClient.prototype, 'setUser');
  jest.spyOn(ExperimentClient.prototype, 'all');
  const mockExposure = jest.spyOn(ExperimentClient.prototype, 'exposure');
  jest.spyOn(util, 'UUID').mockReturnValue('mock');
  let mockGlobal;

  beforeEach(() => {
    jest.spyOn(coreUtil, 'isLocalStorageAvailable').mockReturnValue(true);
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
    initializeExperiment(
      'apiKey_1',
      JSON.stringify([
        {
          key: 'test',
          metadata: {
            deployed: true,
            evaluationMode: 'local',
            experimentKey: 'exp-1',
            flagType: 'experiment',
            flagVersion: 20,
            urlMatch: ['http://test.com'],
            deliveryMethod: 'web',
          },
          segments: [
            {
              metadata: {
                segmentName: 'All Other Users',
              },
              variant: 'treatment',
            },
          ],
          variants: {
            control: {
              key: 'control',
              payload: [
                {
                  action: 'redirect',
                  data: {
                    url: 'http://test.com',
                  },
                },
              ],
              value: 'control',
            },
            off: {
              key: 'off',
              metadata: {
                default: true,
              },
            },
            treatment: {
              key: 'treatment',
              payload: [
                {
                  action: 'redirect',
                  data: {
                    url: 'http://test.com/2',
                  },
                },
              ],
              value: 'treatment',
            },
          },
        },
      ]),
    );
    expect(ExperimentClient.prototype.setUser).toHaveBeenCalledWith({
      device_id: 'mock',
    });
    expect(mockGlobal.localStorage.setItem).toHaveBeenCalledWith(
      'EXP_apiKey_1',
      JSON.stringify({ device_id: 'mock' }),
    );
  });

  test('experiment should not run without localStorage', () => {
    jest.spyOn(coreUtil, 'isLocalStorageAvailable').mockReturnValue(false);
    initializeExperiment('no_local', '');
    expect(mockGlobal.localStorage.getItem).toHaveBeenCalledTimes(0);
  });

  test('should redirect and call exposure', () => {
    initializeExperiment(
      'apiKey_2',
      JSON.stringify([
        {
          key: 'test',
          metadata: {
            deployed: true,
            evaluationMode: 'local',
            experimentKey: 'exp-1',
            flagType: 'experiment',
            flagVersion: 20,
            urlMatch: ['http://test.com'],
            deliveryMethod: 'web',
          },
          segments: [
            {
              metadata: {
                segmentName: 'All Other Users',
              },
              variant: 'treatment',
            },
          ],
          variants: {
            control: {
              key: 'control',
              payload: [
                {
                  action: 'redirect',
                  data: {
                    url: 'http://test.com',
                  },
                },
              ],
              value: 'control',
            },
            off: {
              key: 'off',
              metadata: {
                default: true,
              },
            },
            treatment: {
              key: 'treatment',
              payload: [
                {
                  action: 'redirect',
                  data: {
                    url: 'http://test.com/2',
                  },
                },
              ],
              value: 'treatment',
            },
          },
        },
      ]),
    );

    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('should not redirect but call exposure', () => {
    initializeExperiment(
      'apiKey_3',
      JSON.stringify([
        {
          key: 'test',
          metadata: {
            deployed: true,
            evaluationMode: 'local',
            experimentKey: 'exp-1',
            flagType: 'experiment',
            flagVersion: 20,
            urlMatch: ['http://test.com'],
            deliveryMethod: 'web',
          },
          segments: [
            {
              metadata: {
                segmentName: 'All Other Users',
              },
              variant: 'control',
            },
          ],
          variants: {
            control: {
              key: 'control',
              payload: [],
              value: 'control',
            },
            treatment: {
              key: 'treatment',
              payload: [
                {
                  action: 'redirect',
                  data: {
                    url: 'http://test.com/2',
                  },
                },
              ],
              value: 'treatment',
            },
          },
        },
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
      'prev_control',
      JSON.stringify([
        {
          key: 'test',
          metadata: {
            deployed: true,
            evaluationMode: 'local',
            experimentKey: 'exp-1',
            flagType: 'experiment',
            flagVersion: 20,
            deliveryMethod: 'web',
          },
          segments: [
            {
              metadata: {
                segmentName: 'All Other Users',
              },
              variant: 'treatment',
            },
          ],
          variants: {
            control: {
              key: 'control',
              payload: [],
              value: 'control',
            },
            off: {
              key: 'off',
              metadata: {
                default: true,
              },
            },
            treatment: {
              key: 'treatment',
              payload: [
                {
                  action: 'redirect',
                  data: {
                    url: 'http://test.com/2',
                  },
                },
              ],
              value: 'treatment',
            },
          },
        },
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
      'prev_treatment',
      JSON.stringify([
        {
          key: 'test',
          metadata: {
            deployed: true,
            evaluationMode: 'local',
            experimentKey: 'exp-1',
            flagType: 'experiment',
            flagVersion: 20,
            urlMatch: ['http://test.com'],
            deliveryMethod: 'web',
          },
          segments: [
            {
              metadata: {
                segmentName: 'All Other Users',
              },
              variant: 'control',
            },
          ],
          variants: {
            control: {
              key: 'treatment',
              payload: [
                {
                  action: 'redirect',
                  data: {
                    url: 'http://test.com',
                  },
                },
              ],
              value: 'control',
            },
            off: {
              key: 'off',
              metadata: {
                default: true,
              },
            },
            treatment: {
              key: 'treatment',
              payload: [
                {
                  action: 'redirect',
                  data: {
                    url: 'http://test.com/2',
                  },
                },
              ],
              value: 'treatment',
            },
          },
        },
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

    initializeExperiment(
      'prev_treatment',
      JSON.stringify([
        {
          key: 'test',
          metadata: {
            deployed: true,
            evaluationMode: 'local',
            experimentKey: 'exp-1',
            flagType: 'experiment',
            flagVersion: 1,
            deliveryMethod: 'web',
          },
          segments: [
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
            {
              metadata: {
                segmentName: 'All Other Users',
              },
              variant: 'off',
            },
          ],
          variants: {
            control: {
              key: 'control',
              payload: [],
              value: 'control',
            },
            off: {
              key: 'off',
              metadata: {
                default: true,
              },
            },
            treatment: {
              key: 'treatment',
              payload: [
                {
                  action: 'redirect',
                  data: {
                    url: 'http://test.com/2',
                  },
                },
              ],
              value: 'treatment',
            },
          },
        },
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
      'merge_query',
      JSON.stringify([
        {
          key: 'test',
          metadata: {
            deployed: true,
            evaluationMode: 'local',
            experimentKey: 'exp-1',
            flagType: 'experiment',
            flagVersion: 20,
            urlMatch: ['http://test.com'],
            deliveryMethod: 'web',
          },
          segments: [
            {
              metadata: {
                segmentName: 'All Other Users',
              },
              variant: 'treatment',
            },
          ],
          variants: {
            control: {
              key: 'control',
              payload: [
                {
                  action: 'redirect',
                  data: {
                    url: 'http://test.com',
                  },
                },
              ],
              value: 'control',
            },
            off: {
              key: 'off',
              metadata: {
                default: true,
              },
            },
            treatment: {
              key: 'treatment',
              payload: [
                {
                  action: 'redirect',
                  data: {
                    url: 'http://test.com/2?param3=c',
                  },
                },
              ],
              value: 'treatment',
            },
          },
        },
      ]),
    );

    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2?param3=c&param1=a&param2=b',
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('should behave as control variant when payload is empty', () => {
    initializeExperiment(
      'empty_payload',
      JSON.stringify([
        {
          key: 'test',
          metadata: {
            deployed: true,
            evaluationMode: 'local',
            experimentKey: 'exp-1',
            flagType: 'experiment',
            flagVersion: 20,
            deliveryMethod: 'web',
          },
          segments: [
            {
              metadata: {
                segmentName: 'All Other Users',
              },
              variant: 'control',
            },
          ],
          variants: {
            control: {
              key: 'control',
              payload: [],
              value: 'control',
            },
            treatment: {
              key: 'treatment',
              payload: [
                {
                  action: 'redirect',
                  data: {
                    url: 'http://test.com/2',
                  },
                },
              ],
              value: 'treatment',
            },
          },
        },
      ]),
    );

    expect(mockGlobal.location.replace).not.toHaveBeenCalled();
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('on targeted page, should call exposure', () => {
    initializeExperiment(
      'target',
      JSON.stringify([
        {
          key: 'test',
          metadata: {
            deployed: true,
            evaluationMode: 'local',
            flagType: 'experiment',
            deliveryMethod: 'web',
          },
          segments: [
            {
              conditions: [
                [
                  {
                    op: 'regex does not match',
                    selector: ['context', 'page', 'url'],
                    values: ['^https:\\/\\/test.*'],
                  },
                ],
              ],
              metadata: {
                segmentName: 'Page not targeted',
                trackExposure: false,
              },
              variant: 'off',
            },
            {
              metadata: {
                segmentName: 'All Other Users',
              },
              variant: 'treatment',
            },
          ],
          variants: {
            off: {
              key: 'off',
              metadata: {
                default: true,
              },
            },
            treatment: {
              value: 'treatment',
            },
          },
        },
      ]),
    );
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('on non-targeted page, should not call exposure', () => {
    initializeExperiment(
      'non_target',
      JSON.stringify([
        {
          key: 'test',
          metadata: {
            deployed: true,
            evaluationMode: 'local',
            flagType: 'experiment',
            deliveryMethod: 'web',
          },
          segments: [
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
            {
              metadata: {
                segmentName: 'All Other Users',
              },
              variant: 'treatment',
            },
          ],
          variants: {
            off: {
              key: 'off',
              metadata: {
                default: true,
              },
            },
            treatment: {
              key: 'treatment',
              value: 'treatment',
            },
          },
        },
      ]),
    );
    expect(mockExposure).not.toHaveBeenCalled();
  });

  test('test regex', () => {
    const v = ['.*\\\\Qtest\\\\E.*'].some((filterValue) =>
      Boolean(new RegExp(filterValue).exec('https://test.com')),
    );
    console.log(v);
  });
});
