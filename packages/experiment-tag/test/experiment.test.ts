import {Experiment, ExperimentClient} from '@amplitude/experiment-js-client';
import { initializeExperiment } from 'src/experiment';
import * as util from 'src/util';

describe('initializeExperiment', () => {
  const mockGetGlobalScope = jest.spyOn(util, 'getGlobalScope');
  jest.spyOn(ExperimentClient.prototype, 'setUser');
  jest.spyOn(ExperimentClient.prototype, 'all');
  const mockExposure = jest.spyOn(ExperimentClient.prototype, 'exposure');
  const mockGetUrlParams = jest.spyOn(util, 'getUrlParams');
  jest.spyOn(util, 'UUID').mockReturnValue('mock');
  jest.spyOn(util, 'isLocalStorageAvailable').mockReturnValue(true);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize experiment with empty user', () => {
    const mockGlobal = {
      localStorage: {
        getItem: jest.fn().mockReturnValue(undefined),
        setItem: jest.fn(),
      },
      location: {
        href: 'http://test.com',
        replace: jest.fn(),
        search: '',
      },
      document: { referrer: 'referrer' },
    };
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);
    mockGetUrlParams.mockReturnValue({});

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
      device_id: expect.any(String),
    });
    expect(mockGlobal.localStorage.setItem).toHaveBeenCalledWith(
      'EXP_apiKey_1',
      JSON.stringify({ device_id: 'mock' }),
    );
  });

  test('should redirect and not call exposure', () => {
    const mockGlobal = {
      localStorage: {
        getItem: jest.fn().mockReturnValue(undefined),
        setItem: jest.fn(),
      },
      location: {
        href: 'http://test.com',
        replace: jest.fn(),
        search: '',
      },
      document: { referrer: 'referrer' },
    };
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);
    mockGetUrlParams.mockReturnValue({});

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

    expect(mockGlobal.location.replace).toHaveBeenCalledWith('http://test.com/2');
    expect(mockExposure).toHaveBeenCalledTimes(0);
  });

  test('should not redirect but call exposure', () => {
    const mockGlobal = {
      localStorage: {
        getItem: jest.fn().mockReturnValue(undefined),
        setItem: jest.fn(),
      },
      location: {
        href: 'http://test.com',
        replace: jest.fn(),
        search: '',
      },
      document: { referrer: 'referrer' },
    };
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);
    mockGetUrlParams.mockReturnValue({});

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

    expect(mockGlobal.location.replace).toBeCalledTimes(0);
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('should not redirect or exposure', () => {
    const mockGlobal = {
      localStorage: {
        getItem: jest.fn().mockReturnValue(undefined),
        setItem: jest.fn(),
      },
      location: {
        href: 'http://test.com',
        replace: jest.fn(),
        search: '',
      },
      document: { referrer: 'referrer' },
    };
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);
    mockGetUrlParams.mockReturnValue({});

    initializeExperiment(
      'apiKey_4',
      JSON.stringify([
        {
          key: 'test',
          metadata: {
            deployed: true,
            evaluationMode: 'local',
            experimentKey: 'exp-1',
            flagType: 'experiment',
            flagVersion: 20,
            urlMatch: ['http://should.not.match'],
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

    expect(mockGlobal.location.replace).toBeCalledTimes(0);
    expect(mockExposure).toHaveBeenCalledTimes(0);
  });

  test('exposure fired when on redirected page', () => {
    const mockGlobal = {
      localStorage: {
        getItem: jest.fn().mockReturnValue(undefined),
        setItem: jest.fn(),
      },
      location: {
        href: 'http://test.com/2',
        replace: jest.fn(),
        search: '',
      },
      document: { referrer: 'http://test.com' },
    };
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);
    mockGetUrlParams.mockReturnValue({});

    initializeExperiment(
      'apiKey_5',
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

    expect(mockGlobal.location.replace).toHaveBeenCalledTimes(0);
    expect(mockExposure).toHaveBeenCalledWith('test');
  });
});
