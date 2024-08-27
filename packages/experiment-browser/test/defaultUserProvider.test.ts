import { ApplicationContext } from '@amplitude/analytics-connector';
import * as coreUtil from '@amplitude/experiment-core';

import { ExperimentUser } from '../src';
import { DefaultUserProvider } from '../src/integration/default';

describe('DefaultUserProvider', () => {
  const mockGetGlobalScope = jest.spyOn(coreUtil, 'getGlobalScope');
  let mockGlobal;
  const defaultUser = {
    language: 'language',
    platform: 'platform',
    os: 'os',
    device_model: 'deviceModel',
    version: 'versionName',
    browser: 'WebKit',
    device_category: 'desktop',
    referring_url: '',
    first_seen: '1000',
    landing_url: 'http://test.com?p1=p1v1,p1v2&p2=p2v1&p2=p2v2&p3=p3v1',
    cookie: {
      c1: 'v1',
      c2: 'v2',
    },
    url_param: { p1: ['p1v1', 'p1v2'], p2: ['p2v1', 'p2v2'], p3: 'p3v1' },
  };
  const defaultApplicationContext = {
    language: 'language',
    platform: 'platform',
    os: 'os',
    deviceModel: 'deviceModel',
    versionName: 'versionName',
  };
  let mockLocalStorage;
  let mockSessionStorage;

  beforeEach(() => {
    mockLocalStorage = {};
    mockSessionStorage = {};
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    mockGlobal = {
      localStorage: {
        getItem: (k) => mockLocalStorage[k],
        setItem: (k, v) => (mockLocalStorage[k] = v),
      },
      sessionStorage: {
        getItem: (k) => mockSessionStorage[k],
        setItem: (k, v) => (mockSessionStorage[k] = v),
      },
      location: {
        href: 'http://test.com?p1=p1v1,p1v2&p2=p2v1&p2=p2v2&p3=p3v1',
        replace: jest.fn(),
        search: '?p1=p1v1,p1v2&p2=p2v1&p2=p2v2&p3=p3v1',
      },
      document: { referrer: '', cookie: 'c1=v1; c2=v2' },
      history: { replaceState: jest.fn() },
    };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockGetGlobalScope.mockReturnValue(mockGlobal);
  });

  test('basic wrapped provider', async () => {
    const user: ExperimentUser = {
      user_id: 'user_id',
      device_id: 'device_id',
      user_properties: {
        k1: 'v1',
      },
    };
    const applicationContext: ApplicationContext = defaultApplicationContext;
    const defaultUserProvider = new DefaultUserProvider(
      {
        versionName: 'versionName',
        getApplicationContext(): ApplicationContext {
          return applicationContext;
        },
      },
      {
        getUser(): ExperimentUser {
          return user;
        },
      },
      'apikey',
    );
    const actualUser = defaultUserProvider.getUser();
    const expectedUser = {
      ...defaultUser,
      ...user,
    };
    expect(actualUser).toEqual(expectedUser);
    expect(mockLocalStorage).toEqual({
      EXP_apikey_DEFAULT_USER_PROVIDER: '{"first_seen":"1000"}',
    });
    expect(mockSessionStorage).toEqual({
      EXP_apikey_DEFAULT_USER_PROVIDER: `{"landing_url":"${mockGlobal.location.href}"}`,
    });
  });

  test('wrapped provider not set', async () => {
    const applicationContext: ApplicationContext = defaultApplicationContext;
    const defaultUserProvider = new DefaultUserProvider({
      versionName: 'versionName',
      getApplicationContext(): ApplicationContext {
        return applicationContext;
      },
    });
    const actualUser = defaultUserProvider.getUser();
    const expectedUser = defaultUser;
    expect(actualUser).toEqual(expectedUser);
  });

  test('wrapped provider undefined', async () => {
    const applicationContext: ApplicationContext = defaultApplicationContext;
    const defaultUserProvider = new DefaultUserProvider(
      {
        versionName: 'versionName',
        getApplicationContext(): ApplicationContext {
          return applicationContext;
        },
      },
      undefined,
    );
    const actualUser = defaultUserProvider.getUser();
    const expectedUser = defaultUser;
    expect(actualUser).toEqual(expectedUser);
  });

  test('wrapped provider null', async () => {
    const applicationContext: ApplicationContext = defaultApplicationContext;
    const defaultUserProvider = new DefaultUserProvider(
      {
        versionName: 'versionName',
        getApplicationContext(): ApplicationContext {
          return applicationContext;
        },
      },
      undefined,
    );
    const actualUser = defaultUserProvider.getUser();
    const expectedUser = defaultUser;
    expect(actualUser).toEqual(expectedUser);
  });

  test('default value overwritten by wrapped provider', async () => {
    const user: ExperimentUser = {
      user_id: 'user_id',
      device_id: 'device_id',
      user_properties: {
        k1: 'v1',
      },
      device_model: 'deviceModel2',
    };
    const applicationContext: ApplicationContext = defaultApplicationContext;
    const defaultUserProvider = new DefaultUserProvider(
      {
        versionName: 'versionName',
        getApplicationContext(): ApplicationContext {
          return applicationContext;
        },
      },
      {
        getUser(): ExperimentUser {
          return user;
        },
      },
    );
    const actualUser = defaultUserProvider.getUser();
    const expectedUser = {
      ...defaultUser,
      ...user,
    };
    expect(actualUser).toEqual(expectedUser);
  });

  test('test get from local and session storage', async () => {
    mockLocalStorage['EXP_apikey_DEFAULT_USER_PROVIDER'] = '{"first_seen": 99}';
    mockSessionStorage['EXP_apikey_DEFAULT_USER_PROVIDER'] =
      '{"landing_url": "http://testtest.com"}';

    const applicationContext: ApplicationContext = defaultApplicationContext;
    const defaultUserProvider = new DefaultUserProvider(
      {
        versionName: 'versionName',
        getApplicationContext(): ApplicationContext {
          return applicationContext;
        },
      },
      undefined,
      'apikey',
    );
    const actualUser = defaultUserProvider.getUser();
    const expectedUser = {
      ...defaultUser,
      first_seen: 99,
      landing_url: 'http://testtest.com',
    };
    expect(actualUser).toEqual(expectedUser);
  });
});
