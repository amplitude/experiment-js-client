import * as experimentCore from '@amplitude/experiment-core';

import { createMockGlobal } from '../util/mocks';

import { consentGate } from 'src/consent-gate';
import { DefaultWebExperimentClient } from 'src/experiment';
import {
  createPlugin,
  flushEventBuffer,
  initialize,
  setConsentStatus,
} from 'src/index';
import { SdkPreviewApi } from 'src/preview/preview-api';
import { ConsentStatus, InitConfigs, WebExperimentConfig } from 'src/types';
import * as antiFlickerUtils from 'src/util/anti-flicker';
import * as urlUtils from 'src/util/url';

const API_KEY = 'test-api-key-1234567890';
const INIT_CONFIGS: InitConfigs = {
  initialFlags: '[]',
  pageObjects: '{}',
  behavioralTargetingRules: '{}',
};

describe('index.ts consent gate', () => {
  let globalScope: Record<string, unknown>;
  let start: jest.Mock;
  let getInstance: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    consentGate.reset();
    globalScope = createMockGlobal({ experimentConfig: {} });
    jest
      .spyOn(experimentCore, 'getGlobalScope')
      .mockReturnValue(globalScope as never);

    start = jest.fn().mockResolvedValue(undefined);
    const fakeClient = {
      start,
      isRedirecting: false,
    } as unknown as DefaultWebExperimentClient;
    getInstance = jest
      .spyOn(DefaultWebExperimentClient, 'getInstance')
      .mockReturnValue(fakeClient);
    jest
      .spyOn(antiFlickerUtils, 'removeAntiFlickerCss')
      .mockImplementation(jest.fn());
    jest
      .spyOn(antiFlickerUtils, 'applyAntiFlickerCss')
      .mockImplementation(jest.fn());
  });

  const init = (config: WebExperimentConfig) =>
    initialize(API_KEY, INIT_CONFIGS, config);

  it.each<[string, WebExperimentConfig]>([
    ['consentRequired absent (unchanged path)', {}],
    ['consentRequired false', { consentOptions: { consentRequired: false } }],
    [
      'required + initial granted',
      { consentOptions: { consentRequired: true, consentStatus: 'granted' } },
    ],
  ])('starts immediately: %s', (_label, config) => {
    init(config);
    expect(getInstance).toHaveBeenCalledTimes(1);
  });

  it.each<[string, WebExperimentConfig]>([
    [
      'pending',
      { consentOptions: { consentRequired: true, consentStatus: 'pending' } },
    ],
    [
      'no status (defaults to pending)',
      { consentOptions: { consentRequired: true } },
    ],
    [
      'denied',
      { consentOptions: { consentRequired: true, consentStatus: 'denied' } },
    ],
  ])('does not construct or start: required + %s', (_label, config) => {
    init(config);
    expect(getInstance).not.toHaveBeenCalled();
  });

  it.each<[string, ConsentStatus, ConsentStatus[]]>([
    ['pending -> granted', 'pending', ['granted']],
    ['idempotent double grant', 'pending', ['granted', 'granted']],
    [
      'pending -> denied -> granted (re-opt-in)',
      'pending',
      ['denied', 'granted'],
    ],
    ['denied at load -> granted (re-opt-in)', 'denied', ['granted']],
    [
      'pending -> denied -> pending -> granted',
      'pending',
      ['denied', 'pending', 'granted'],
    ],
  ])(
    'starts exactly once for a sequence ending in granted: %s',
    (_label, initial, sequence) => {
      init({
        consentOptions: { consentRequired: true, consentStatus: initial },
      });
      sequence.forEach((status) => setConsentStatus(status));
      expect(getInstance).toHaveBeenCalledTimes(1);
      expect(start).toHaveBeenCalledTimes(1);
    },
  );

  test('grant BEFORE initialize: starts as soon as initialize runs', () => {
    setConsentStatus('granted'); // CMP resolved before script fully loaded
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    expect(getInstance).toHaveBeenCalledTimes(1);
  });

  test('window.experimentConfig.consentOptions wins over the initialize arg', () => {
    globalScope.experimentConfig = {
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    };
    // initialize arg says granted, but window says pending -> should not start
    init({
      consentOptions: { consentRequired: true, consentStatus: 'granted' },
    });
    expect(getInstance).not.toHaveBeenCalled();
  });

  test('runtime denied wins over a later initialize granted config, until a re-opt-in', () => {
    setConsentStatus('denied'); // CMP declined before the script loaded
    init({
      consentOptions: { consentRequired: true, consentStatus: 'granted' },
    });
    expect(getInstance).not.toHaveBeenCalled();

    // Preference-center re-opt-in starts the client in-session.
    setConsentStatus('granted');
    expect(getInstance).toHaveBeenCalledTimes(1);
  });

  it.each<[string, WebExperimentConfig]>([
    ['consentOptions absent', {}],
    ['consentRequired false', { consentOptions: { consentRequired: false } }],
  ])(
    'a stray pre-init denial does not block start when gating is off: %s',
    (_label, config) => {
      setConsentStatus('denied'); // CMP wired up, but consent gating never enabled
      init(config);
      expect(getInstance).toHaveBeenCalledTimes(1);
      expect(start).toHaveBeenCalledTimes(1);
    },
  );

  test('a second initialize with consentRequired=false cannot bypass a pending deferral', () => {
    // First init defers on consent.
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    expect(getInstance).not.toHaveBeenCalled();

    // A later init resolving consentRequired=false must not release the
    // parked start — only a grant may.
    init({ consentOptions: { consentRequired: false } });
    expect(getInstance).not.toHaveBeenCalled();

    setConsentStatus('granted');
    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  test('a non-consent launch blocks a later consent-gated init from re-arming a deferral', () => {
    // First init runs with gating off and launches the client.
    init({});
    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(consentGate.deferredStart).toBeNull();

    // A later init turns gating on with a non-granted status. The client is
    // already running, so this must not stash a deferral.
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    expect(consentGate.deferredStart).toBeNull();

    // A subsequent grant therefore has nothing to release — no second launch.
    setConsentStatus('granted');
    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  test('grant via a later initialize starts once and does not relaunch', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    expect(getInstance).not.toHaveBeenCalled();

    // Grant arrives as a second initialize resolving to granted.
    init({
      consentOptions: { consentRequired: true, consentStatus: 'granted' },
    });
    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(consentGate.deferredStart).toBeNull();

    // Further initialize calls must not relaunch (no extra fetch/start work).
    init({
      consentOptions: { consentRequired: true, consentStatus: 'granted' },
    });
    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  test('grant via a later initialize drops events buffered while deferred', async () => {
    const plugin = createPlugin();
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });

    // Analytics during a consent deferral is not buffered (would be discarded on grant).
    await plugin.execute?.({
      event_type: 'pre_grant',
      event_properties: {},
    } as never);

    init({
      consentOptions: { consentRequired: true, consentStatus: 'granted' },
    });

    const trackEvent = jest.fn();
    flushEventBuffer({ trackEvent } as never);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  test('invalid consentStatus in config defers like pending', () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    globalScope.experimentConfig = {
      consentOptions: {
        consentRequired: true,
        consentStatus: 'grantd',
      },
    };
    init({
      consentOptions: { consentRequired: true, consentStatus: 'granted' },
    });
    expect(getInstance).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('setConsentStatus with an unknown status is a no-op', () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    setConsentStatus('grantd' as ConsentStatus);
    expect(getInstance).not.toHaveBeenCalled();
    expect(consentGate.status).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('setConsentStatus denied while deferred does not retain analytics buffer', async () => {
    const plugin = createPlugin();
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    await plugin.execute?.({
      event_type: 'while_pending',
      event_properties: {},
    } as never);
    setConsentStatus('denied');
    const trackEvent = jest.fn();
    flushEventBuffer({ trackEvent } as never);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  test('grant from the start keeps startup-buffered events (no deferral window)', async () => {
    const plugin = createPlugin();
    // Consent granted immediately: there was no consent-withheld window, so
    // startup events that race in should replay like the non-consent path.
    init({
      consentOptions: { consentRequired: true, consentStatus: 'granted' },
    });
    await plugin.execute?.({
      event_type: 'startup',
      event_properties: {},
    } as never);

    const trackEvent = jest.fn();
    flushEventBuffer({ trackEvent } as never);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  describe('preview mode', () => {
    const flushAsync = async () => {
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
    };

    beforeEach(() => {
      jest.spyOn(urlUtils, 'isPreviewMode').mockReturnValue(true);
      jest
        .spyOn(SdkPreviewApi.prototype, 'getPreviewFlagsAndPageViewObjects')
        .mockResolvedValue({
          flags: [],
          pageViewObjects: {},
          behavioralTargetingRules: [],
        } as never);
    });

    test('deferred grant goes through the preview path (anti-flicker + config fetch)', async () => {
      init({
        consentOptions: { consentRequired: true, consentStatus: 'pending' },
      });
      expect(antiFlickerUtils.applyAntiFlickerCss).not.toHaveBeenCalled();

      setConsentStatus('granted');
      await flushAsync();

      expect(antiFlickerUtils.applyAntiFlickerCss).toHaveBeenCalled();
      expect(
        SdkPreviewApi.prototype.getPreviewFlagsAndPageViewObjects,
      ).toHaveBeenCalled();
      expect(getInstance).toHaveBeenCalledTimes(1);
    });

    test('denial during the in-flight config fetch does not abort the start (reload to reset after grant)', async () => {
      init({
        consentOptions: { consentRequired: true, consentStatus: 'granted' },
      });
      // Fetch is in flight; the user denies before it resolves. Mid-session
      // denial does not tear down an in-flight start — reload to reset.
      setConsentStatus('denied');
      await flushAsync();

      expect(getInstance).toHaveBeenCalledTimes(1);
    });
  });

  test('stub exposes setConsentStatus before the client exists', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    expect(globalScope.webExperiment).toBeDefined();
    expect(
      typeof (globalScope.webExperiment as { setConsentStatus?: unknown })
        .setConsentStatus,
    ).toBe('function');
  });
});
