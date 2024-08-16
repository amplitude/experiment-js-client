import { ApplicationContext } from '@amplitude/analytics-connector';

import { ExperimentUser } from '../src';
import { DefaultUserProvider } from '../src/integration/default';

describe('DefaultUserProvider', () => {
  test('basic wrapped provider', async () => {
    const user: ExperimentUser = {
      user_id: 'user_id',
      device_id: 'device_id',
      user_properties: {
        k1: 'v1',
      },
    };
    const applicationContext: ApplicationContext = {
      language: 'language',
      platform: 'platform',
      os: 'os',
      deviceModel: 'deviceModel',
      versionName: 'versionName',
    };
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
      user_id: 'user_id',
      device_id: 'device_id',
      user_properties: {
        k1: 'v1',
      },
      language: 'language',
      platform: 'platform',
      os: 'os',
      device_model: 'deviceModel',
      version: 'versionName',
      browser: 'WebKit',
      device_category: 'desktop',
      landing_url: 'http://localhost',
      referring_url: '',
    };
    expect(actualUser).toEqual(expectedUser);
  });

  test('wrapped provider not set', async () => {
    const applicationContext: ApplicationContext = {
      language: 'language',
      platform: 'platform',
      os: 'os',
      deviceModel: 'deviceModel',
      versionName: 'versionName',
    };
    const defaultUserProvider = new DefaultUserProvider({
      versionName: 'versionName',
      getApplicationContext(): ApplicationContext {
        return applicationContext;
      },
    });
    const actualUser = defaultUserProvider.getUser();
    const expectedUser = {
      language: 'language',
      platform: 'platform',
      os: 'os',
      device_model: 'deviceModel',
      version: 'versionName',
      browser: 'WebKit',
      device_category: 'desktop',
      landing_url: 'http://localhost',
      referring_url: '',
    };
    expect(actualUser).toEqual(expectedUser);
  });

  test('wrapped provider undefined', async () => {
    const applicationContext: ApplicationContext = {
      language: 'language',
      platform: 'platform',
      os: 'os',
      deviceModel: 'deviceModel',
      versionName: 'versionName',
    };
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
    const expectedUser = {
      language: 'language',
      platform: 'platform',
      os: 'os',
      device_model: 'deviceModel',
      version: 'versionName',
      browser: 'WebKit',
      device_category: 'desktop',
      landing_url: 'http://localhost',
      referring_url: '',
    };
    expect(actualUser).toEqual(expectedUser);
  });

  test('wrapped provider null', async () => {
    const applicationContext: ApplicationContext = {
      language: 'language',
      platform: 'platform',
      os: 'os',
      deviceModel: 'deviceModel',
      versionName: 'versionName',
    };
    const defaultUserProvider = new DefaultUserProvider(
      {
        versionName: 'versionName',
        getApplicationContext(): ApplicationContext {
          return applicationContext;
        },
      },
      null,
    );
    const actualUser = defaultUserProvider.getUser();
    const expectedUser = {
      language: 'language',
      platform: 'platform',
      os: 'os',
      device_model: 'deviceModel',
      version: 'versionName',
      browser: 'WebKit',
      device_category: 'desktop',
      landing_url: 'http://localhost',
      referring_url: '',
    };
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
    const applicationContext: ApplicationContext = {
      language: 'language',
      platform: 'platform',
      os: 'os',
      deviceModel: 'deviceModel',
      versionName: 'versionName',
    };
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
      user_id: 'user_id',
      device_id: 'device_id',
      user_properties: {
        k1: 'v1',
      },
      language: 'language',
      platform: 'platform',
      os: 'os',
      device_model: 'deviceModel2',
      version: 'versionName',
      browser: 'WebKit',
      device_category: 'desktop',
      landing_url: 'http://localhost',
      referring_url: '',
    };
    expect(actualUser).toEqual(expectedUser);
  });
});
