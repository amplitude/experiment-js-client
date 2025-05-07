import * as experimentCore from '@amplitude/experiment-core';
import { safeGlobal } from '@amplitude/experiment-core';
import { ExperimentClient } from '@amplitude/experiment-js-client';
import { Base64 } from 'js-base64';
import { DefaultWebExperimentClient } from 'src/experiment';
import * as util from 'src/util';
import { stringify } from 'ts-jest';

import { createMutateFlag, createRedirectFlag } from './util/create-flag';
import { createPageObject } from './util/create-page-object';
import { MockHttpClient } from './util/mock-http-client';

let apiKey = 0;
const DEFAULT_PAGE_OBJECTS = {
  test: createPageObject('A', 'url_change', undefined, 'http://test.com'),
};
const DEFAULT_REDIRECT_SCOPE = { treatment: ['A'], control: ['A'] };
const DEFAULT_MUTATE_SCOPE = { metadata: { scope: ['A'] } };

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

// disable mutation observer for tests
global.MutationObserver = class {
  observe() {
    // do nothing
  }

  disconnect() {
    // do nothing
  }

  takeRecords() {
    return [];
  }
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
  });

  test('should initialize experiment with empty user', () => {
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([]),
      JSON.stringify({}),
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
    const initialFlags = [
      // remote flag
      createMutateFlag('test-2', 'treatment', [], [], 'remote'),
      // local flag
      createMutateFlag('test-1', 'treatment'),
    ];
    const remoteFlags = [createMutateFlag('test-2', 'treatment')];

    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags));

    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify({}),
      {
        httpClient: mockHttpClient,
      },
    );
    expect((client as any).config.useDefaultNavigationHandler).toBe(false);
  });

  test('experiment should not run without localStorage', async () => {
    jest
      .spyOn(experimentCore, 'isLocalStorageAvailable')
      .mockReturnValue(false);
    try {
      await DefaultWebExperimentClient.getInstance(
        stringify(apiKey),
        JSON.stringify([]),
        JSON.stringify({}),
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
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2',
          undefined,
          DEFAULT_REDIRECT_SCOPE,
        ),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
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
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
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
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
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
        createRedirectFlag(
          'test',
          'control',
          'http://test.com/2',
          undefined,
          DEFAULT_REDIRECT_SCOPE,
        ),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
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

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag('test', 'treatment', 'http://test.com/2', undefined),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
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
          DEFAULT_REDIRECT_SCOPE,
        ),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
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
        createRedirectFlag(
          'test',
          'control',
          'http://test.com/2?param3=c',
          undefined,
          DEFAULT_REDIRECT_SCOPE,
        ),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
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
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2',
          undefined,
          DEFAULT_REDIRECT_SCOPE,
        ),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    ).start();
    expect(mockExposure).toHaveBeenCalledWith('test');
  });

  test('on non-targeted page, should not call exposure', () => {
    Object.defineProperty(global, 'location', {
      value: {
        href: 'http://non-targeted.com',
      },
      writable: true,
    });
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createRedirectFlag(
          'test',
          'treatment',
          'http://test.com/2',
          undefined,
          DEFAULT_REDIRECT_SCOPE,
        ),
      ]),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );
    expect(mockExposure).not.toHaveBeenCalled();
  });

  test('remote evaluation - request web remote flags', () => {
    const mockUser = { user_id: 'user_id', device_id: 'device_id' };
    jest.spyOn(ExperimentClient.prototype, 'getUser').mockReturnValue(mockUser);

    const initialFlags = [
      // remote flag
      createMutateFlag('test', 'treatment', [], [], 'remote'),
    ];

    const mockHttpClient = new MockHttpClient(JSON.stringify([]));

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
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
      createMutateFlag(
        'test-2',
        'treatment',
        [DEFAULT_MUTATE_SCOPE],
        [],
        'remote',
      ),
      // local flag
      createMutateFlag('test-1', 'treatment', [DEFAULT_MUTATE_SCOPE]),
    ];
    const remoteFlags = [
      createMutateFlag('test-2', 'treatment', [DEFAULT_MUTATE_SCOPE]),
    ];
    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags));
    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify({
        'test-1': createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
        'test-2': createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
      }),
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
      createMutateFlag(
        'test-2',
        'treatment',
        [DEFAULT_MUTATE_SCOPE],
        [],
        'remote',
        true,
        {},
      ),
      // local flag
      createMutateFlag(
        'test-1',
        'treatment',
        [DEFAULT_MUTATE_SCOPE],
        [],
        'local',
        true,
        {},
      ),
    ];
    const remoteFlags = [createMutateFlag('test-2', 'treatment')];

    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags), 404);

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify({
        'test-1': createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
        'test-2': createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
      }),
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
      createMutateFlag(
        'test',
        'treatment',
        [DEFAULT_MUTATE_SCOPE],
        [],
        'remote',
      ),
    ];

    const mockHttpClient = new MockHttpClient('', 404);

    DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
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
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
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
        DEFAULT_REDIRECT_SCOPE,
        undefined,
        'remote',
      ),
    ];
    const remoteFlags = [
      createRedirectFlag(
        'test',
        'treatment',
        'http://test.com/2',
        undefined,
        DEFAULT_REDIRECT_SCOPE,
      ),
    ];
    const mockHttpClient = new MockHttpClient(JSON.stringify(remoteFlags), 200);

    await DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
      {
        httpClient: mockHttpClient,
      },
    )
      .start()
      .then();
    // check treatment variant called
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test');
    expect(mockGlobal.location.replace).toHaveBeenCalledWith(
      'http://test.com/2',
    );
  });

  test('scoped mutations - experiment active, both mutations active on same page', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag(
        'test',
        'treatment',
        [DEFAULT_MUTATE_SCOPE, DEFAULT_MUTATE_SCOPE],
        [],
      ),
    ];
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );
    client.start().then();
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test');
    const appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).includes('test'));
    expect(Object.keys(appliedMutations['test']).includes('mutate'));
    expect(Object.keys(appliedMutations['test']['mutate']).length).toEqual(2);
  });

  test('scoped mutations - experiment active, both mutations active on different pages', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag('test', 'treatment', [
        { metadata: { scope: ['A'] } },
        { metadata: { scope: ['B'] } },
      ]),
    ];
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify({
        test: {
          ...createPageObject('A', 'url_change', undefined, 'http://test.com'),
          ...createPageObject('B', 'url_change', undefined, 'http://test.com'),
        },
      }),
    );
    client.start().then();
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test');
    const appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).includes('test'));
    expect(Object.keys(appliedMutations['test']).includes('mutate'));
    expect(Object.keys(appliedMutations['test']['mutate']).length).toEqual(2);
    expect(Object.keys(appliedMutations['test']['mutate'])).toEqual(['0', '1']);
  });

  test('Visual editor mode - active pages updated but variant actions not applied', () => {
    const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
    mockGetGlobalScope.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      newMockGlobal({
        location: {
          href: 'http://A.com',
          search: '?VISUAL_EDITOR=true',
        },
      }),
    );
    const test1Page = createPageObject(
      'A',
      'url_change',
      undefined,
      'http://A.com',
    );
    const test2Page = createPageObject(
      'B',
      'url_change',
      undefined,
      'http://B.com',
    );
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createMutateFlag('test-1', 'treatment', [{ metadata: {} }]),
        createMutateFlag('test-2', 'treatment', [{ metadata: {} }]),
      ]),
      JSON.stringify({
        'test-1': test1Page,
        'test-2': test2Page,
      }),
    );
    client.start().then();
    let activePages = (client as any).activePages;
    expect(activePages).toEqual({ 'test-1': test1Page });
    (client as any).subscriptionManager.globalScope = newMockGlobal({
      location: {
        href: 'http://B.com',
      },
    });
    activePages = (client as any).activePages;
    (client as any).messageBus.publish('url_change', {});
    expect(activePages).toEqual({ 'test-2': test2Page });
    expect(mockExposure).toHaveBeenCalledTimes(0);
    const appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).length).toEqual(0);
  });

  test('scoped mutations - experiment active, subset of mutations active', () => {
    const initialFlags = [
      createMutateFlag('test', 'treatment', [
        { metadata: { scope: ['B'] } },
        { metadata: { scope: ['A'] } },
      ]),
    ];
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );
    client.start().then();
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test');
    const appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).includes('test'));
    expect(Object.keys(appliedMutations['test']).includes('mutate'));
    expect(Object.keys(appliedMutations['test']['mutate']).length).toEqual(1);
    expect(Object.keys(appliedMutations['test']['mutate'])).toEqual(['1']);
  });

  test('scoped mutations - experiment active, neither mutation active', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag('test', 'treatment', [
        { metadata: { scope: ['B'] } },
        { metadata: { scope: ['C'] } },
      ]),
    ];
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );
    client.start().then();
    expect(mockExposure).toHaveBeenCalledTimes(0);
    const appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).length).toEqual(0);
  });

  test('scoped mutations - experiment active, 1 active mutation with no scope, 1 mutation inactive', () => {
    const initialFlags = [
      // remote flag
      createMutateFlag('test', 'treatment', [
        { metadata: {} },
        { metadata: { scope: ['B'] } },
      ]),
    ];
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify(initialFlags),
      JSON.stringify(DEFAULT_PAGE_OBJECTS),
    );
    client.start().then();
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test');
    const appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).includes('test'));
    expect(Object.keys(appliedMutations['test']).includes('mutate'));
    expect(Object.keys(appliedMutations['test']['mutate']).length).toEqual(1);
    expect(Object.keys(appliedMutations['test']['mutate'])).toEqual(['0']);
  });

  test('page object - update activePages and applyVariants upon navigation', () => {
    const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
    mockGetGlobalScope.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      newMockGlobal({
        location: {
          href: 'http://A.com',
        },
      }),
    );
    const test1Page = createPageObject(
      'A',
      'url_change',
      undefined,
      'http://A.com',
    );
    const test2Page = createPageObject(
      'B',
      'url_change',
      undefined,
      'http://B.com',
    );
    const client = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createMutateFlag('test-1', 'treatment', [{ metadata: {} }]),
        createMutateFlag('test-2', 'treatment', [{ metadata: {} }]),
      ]),
      JSON.stringify({
        'test-1': test1Page,
        'test-2': test2Page,
      }),
    );
    client.start().then();
    expect(mockExposure).toHaveBeenCalledTimes(1);
    expect(mockExposure).toHaveBeenCalledWith('test-1');
    let appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).includes('test-1'));
    expect(Object.keys(appliedMutations['test-1']).includes('mutate'));
    const activePages = (client as any).activePages;
    expect(activePages).toEqual({ 'test-1': test1Page });
    expect(Object.keys(appliedMutations['test-1']['mutate']).length).toEqual(1);
    (client as any).subscriptionManager.globalScope = newMockGlobal({
      location: {
        href: 'http://B.com',
      },
    });
    (client as any).messageBus.publish('url_change', {});
    expect(activePages).toEqual({ 'test-2': test2Page });
    expect(mockExposure).toHaveBeenCalledTimes(2);
    expect(mockExposure).toHaveBeenCalledWith('test-2');
    appliedMutations = (client as any).appliedMutations;
    expect(Object.keys(appliedMutations).includes('test-2'));
    expect(Object.keys(appliedMutations['test-2']).includes('mutate'));
    expect(Object.keys(appliedMutations['test-2']['mutate']).length).toEqual(1);
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
        [DEFAULT_MUTATE_SCOPE],
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
        createMutateFlag('test', 'treatment', [], [], 'remote', false, {
          flagVersion: 3,
        }),
      ];
      const remoteFlags = [
        createMutateFlag(
          'test',
          'treatment',
          [DEFAULT_MUTATE_SCOPE],
          [],
          'local',
          false,
          {
            flagVersion: 4,
          },
        ),
      ];
      const client = DefaultWebExperimentClient.getInstance(
        apiKey,
        JSON.stringify(initialFlags),
        JSON.stringify(DEFAULT_PAGE_OBJECTS),
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
        [DEFAULT_MUTATE_SCOPE],
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
        createMutateFlag(
          'test',
          'treatment',
          [DEFAULT_MUTATE_SCOPE],
          [],
          'remote',
          false,
          {
            flagVersion: 3,
          },
        ),
      ];
      const remoteFlags = [
        createMutateFlag(
          'test',
          'control',
          [DEFAULT_MUTATE_SCOPE],
          [],
          'local',
          false,
          {
            flagVersion: 4,
          },
        ),
      ];
      const client = DefaultWebExperimentClient.getInstance(
        apiKey,
        JSON.stringify(initialFlags),
        JSON.stringify(DEFAULT_PAGE_OBJECTS),
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
    const webExperiment = DefaultWebExperimentClient.getInstance(
      stringify(apiKey),
      JSON.stringify([
        createMutateFlag(
          'targeted',
          'treatment',
          [DEFAULT_MUTATE_SCOPE],
          [],
          'local',
        ),
      ]),
      JSON.stringify({
        targeted: createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
        'non-targeted': createPageObject(
          'A',
          'url_change',
          undefined,
          'http://not-targeted.com',
        ),
      }),
    );
    webExperiment.start();
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
        createRedirectFlag(
          'flag-1',
          'control',
          '',
          undefined,
          {},
          targetedSegment,
        ),
        createRedirectFlag('flag-2', 'control', '', undefined),
      ]),
      JSON.stringify({}),
    );
    const variants = webExperiment.getVariants();
    expect(variants['flag-1'].key).toEqual('treatment');
    expect(variants['flag-2'].key).toEqual('control');
  });
});
