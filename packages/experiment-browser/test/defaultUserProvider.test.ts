import * as coreUtil from '@amplitude/experiment-core';

import { ExperimentUser } from '../src';
import { DefaultUserProvider } from '../src/providers/default';

describe('DefaultUserProvider', () => {
  const mockGetGlobalScope = jest.spyOn(coreUtil, 'getGlobalScope');
  let mockGlobal;
  const defaultUser = {
    language: 'en-US',
    platform: 'Web',
    os: 'WebKit 537',
    browser: 'WebKit',
    device_model: 'iPhone',
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
    const defaultUserProvider = mockProvider(
      new DefaultUserProvider(
        {
          getUser(): ExperimentUser {
            return user;
          },
        },
        'apikey',
      ),
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
    const defaultUserProvider = mockProvider(new DefaultUserProvider());
    const actualUser = defaultUserProvider.getUser();
    const expectedUser = defaultUser;
    expect(actualUser).toEqual(expectedUser);
  });

  test('wrapped provider undefined', async () => {
    const defaultUserProvider = mockProvider(
      new DefaultUserProvider(undefined),
    );
    const actualUser = defaultUserProvider.getUser();
    const expectedUser = defaultUser;
    expect(actualUser).toEqual(expectedUser);
  });

  test('wrapped provider null', async () => {
    const defaultUserProvider = mockProvider(new DefaultUserProvider(null));
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
    const defaultUserProvider = mockProvider(
      new DefaultUserProvider({
        getUser(): ExperimentUser {
          return user;
        },
      }),
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

    const defaultUserProvider = mockProvider(
      new DefaultUserProvider(undefined, 'apikey'),
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

const mockProvider = (provider: DefaultUserProvider): DefaultUserProvider => {
  provider['getLanguage'] = () => 'en-US';
  provider['getBrowser'] = () => 'WebKit';
  provider['getOs'] = () => 'WebKit 537';
  provider['getDeviceModel'] = () => 'iPhone';
  return provider;
};
