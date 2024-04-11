import { ExperimentClient } from '@amplitude/experiment-js-client';
import { initializeExperiment } from 'src/experiment';
import * as util from 'src/util';

describe('initializeExperiment', () => {
  const mockGetGlobalScope = jest.spyOn(util, 'getGlobalScope');
  jest.spyOn(ExperimentClient.prototype, 'setUser');
  jest.spyOn(ExperimentClient.prototype, 'all');
  const mockExposure = jest.spyOn(ExperimentClient.prototype, 'exposure');
  jest.spyOn(util, 'UUID').mockReturnValue('mock');
  let mockGlobal;

  beforeEach(() => {
    jest.spyOn(util, 'isLocalStorageAvailable').mockReturnValue(true);
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
    jest.spyOn(util, 'isLocalStorageAvailable').mockReturnValue(false);
    initializeExperiment('no_local', '');
    expect(mockGlobal.localStorage.getItem).toHaveBeenCalledTimes(0);
  });

  test('should redirect and not call exposure', () => {
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

    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );
    expect(mockExposure).toHaveBeenCalledTimes(0);
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
    expect(mockGlobal.history.replaceState).toBeCalledTimes(0);
  });

  test('should not redirect or exposure', () => {
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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);

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
    expect(mockExposure).toHaveBeenCalledTimes(0);
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

    expect(mockGlobal.location.replace).toHaveBeenCalledTimes(0);
    expect(mockExposure).toHaveBeenCalledTimes(0);
    expect(mockGlobal.history.replaceState).toHaveBeenCalledWith(
      {},
      '',
      'http://test.com/2',
    );
  });
});
