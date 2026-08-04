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
    user_agent: 'Googlebot',
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

  test('get from local and session storage', async () => {
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

  describe('persistenceAllowed guard', () => {
    test('gated: user fields populated, nothing read or written', async () => {
      mockLocalStorage['EXP_apikey_DEFAULT_USER_PROVIDER'] =
        '{"first_seen": 99}';
      mockSessionStorage['EXP_apikey_DEFAULT_USER_PROVIDER'] =
        '{"landing_url": "http://testtest.com"}';

      const defaultUserProvider = mockProvider(
        new DefaultUserProvider(undefined, 'apikey', () => false),
      );
      const actualUser = defaultUserProvider.getUser();
      // Stored values are ignored; both fields come from the current page/time.
      expect(actualUser.first_seen).toEqual('1000');
      expect(actualUser.landing_url).toEqual(mockGlobal.location.href);
      // Stored values are left exactly as they were.
      expect(mockLocalStorage).toEqual({
        EXP_apikey_DEFAULT_USER_PROVIDER: '{"first_seen": 99}',
      });
      expect(mockSessionStorage).toEqual({
        EXP_apikey_DEFAULT_USER_PROVIDER:
          '{"landing_url": "http://testtest.com"}',
      });
    });

    test('gated with empty storage: no keys are created', async () => {
      const defaultUserProvider = mockProvider(
        new DefaultUserProvider(undefined, 'apikey', () => false),
      );
      const actualUser = defaultUserProvider.getUser();
      expect(actualUser.first_seen).toEqual('1000');
      expect(actualUser.landing_url).toEqual(mockGlobal.location.href);
      expect(mockLocalStorage).toEqual({});
      expect(mockSessionStorage).toEqual({});
    });

    test('gated landing_url survives an SPA navigation and persists on grant', async () => {
      const landingHref = mockGlobal.location.href;
      let allowed = false;
      const defaultUserProvider = mockProvider(
        new DefaultUserProvider(undefined, 'apikey', () => allowed),
      );
      expect(defaultUserProvider.getUser().landing_url).toEqual(landingHref);

      // SPA route change while consent is still undecided.
      mockGlobal.location.href = 'http://test.com/spa-page';
      expect(defaultUserProvider.getUser().landing_url).toEqual(landingHref);

      // Grant after the navigation: the true landing page is what persists.
      allowed = true;
      expect(defaultUserProvider.getUser().landing_url).toEqual(landingHref);
      expect(mockSessionStorage).toEqual({
        EXP_apikey_DEFAULT_USER_PROVIDER: `{"landing_url":"${landingHref}"}`,
      });
    });

    test('guard reopening resumes normal persistence', async () => {
      let allowed = false;
      const defaultUserProvider = mockProvider(
        new DefaultUserProvider(undefined, 'apikey', () => allowed),
      );
      defaultUserProvider.getUser();
      expect(mockLocalStorage).toEqual({});
      expect(mockSessionStorage).toEqual({});

      allowed = true;
      defaultUserProvider.getUser();
      expect(mockLocalStorage).toEqual({
        EXP_apikey_DEFAULT_USER_PROVIDER: '{"first_seen":"1000"}',
      });
      expect(mockSessionStorage).toEqual({
        EXP_apikey_DEFAULT_USER_PROVIDER: `{"landing_url":"${mockGlobal.location.href}"}`,
      });
    });
  });
});

const mockProvider = (provider: DefaultUserProvider): DefaultUserProvider => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  provider['userAgent'] = 'Googlebot';
  provider['getLanguage'] = () => 'en-US';
  provider['getBrowser'] = () => 'WebKit';
  provider['getOs'] = () => 'WebKit 537';
  provider['getDeviceModel'] = () => 'iPhone';
  return provider;
};
