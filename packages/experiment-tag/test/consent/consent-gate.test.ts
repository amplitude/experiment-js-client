import * as experimentCore from '@amplitude/experiment-core';

import { createMockGlobal } from '../util/mocks';

import { consentGate } from 'src/consent/consent-gate';
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
import { DebugRecorder } from 'src/util/debug-recorder';
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
  ])(
    'starts under pending with the persistence gate armed: %s',
    (_label, config) => {
      init(config);
      // The client runs (experiments apply, no flicker); everything it would
      // persist or send is held back by the gated layers below.
      expect(getInstance).toHaveBeenCalledTimes(1);
      expect(start).toHaveBeenCalledTimes(1);
      expect(consentGate.required).toBe(true);
      expect(consentGate.manager.getStatus()).toBe('pending');
      expect(consentGate.deferredStart).toBeNull();
    },
  );

  test('does not construct or start: required + denied', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    });
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

  test('denial after a pending start does not stash a deferral or relaunch', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    expect(getInstance).toHaveBeenCalledTimes(1);

    // Mid-session refusal: the running client stays up (gated layers drop its
    // writes); nothing is parked for a later grant to release.
    setConsentStatus('denied');
    expect(consentGate.deferredStart).toBeNull();

    setConsentStatus('granted');
    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  test('transition to pending is ignored after grant (no-op)', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    setConsentStatus('granted');
    setConsentStatus('pending'); // invalid: pending is only an initial state
    expect(consentGate.manager.getStatus()).toBe('granted');
    expect(getInstance).toHaveBeenCalledTimes(1);
  });

  test('grant BEFORE initialize: starts as soon as initialize runs', () => {
    setConsentStatus('granted'); // CMP resolved before script fully loaded
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    expect(getInstance).toHaveBeenCalledTimes(1);
  });

  test('window.experimentConfig.consentOptions wins over the initialize arg', () => {
    globalScope.experimentConfig = {
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    };
    // initialize arg says granted, but window says denied -> should not start
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

  test('a second initialize with consentRequired=false cannot bypass a denied deferral', () => {
    // First init defers on consent.
    init({
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
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
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
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

  test('grant via a later initialize drops events tracked while deferred on denial', async () => {
    const plugin = createPlugin();
    init({
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    });

    // Analytics during a denied deferral is not buffered (must not replay on
    // a later re-opt-in).
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

  test('invalid consentStatus in config warns and runs gated like pending', () => {
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
    // Fail closed: the unrecognized value falls back to pending, so the client
    // runs with persistence gated rather than treating the typo as a grant.
    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(consentGate.manager.getStatus()).toBe('pending');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('setConsentStatus with an unknown status warns and is a no-op', () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    setConsentStatus('grantd' as ConsentStatus);
    // The pending start already ran once; the bad value must not change the
    // status (which would flush the gated buffers) or relaunch anything.
    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(consentGate.manager.getStatus()).toBe('pending');
    expect(consentGate.manager.hasExplicitStatus()).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('setConsentStatus with an unknown status keeps an existing grant', () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    setConsentStatus('granted');
    expect(getInstance).toHaveBeenCalledTimes(1);

    setConsentStatus('grantd' as ConsentStatus);
    expect(consentGate.manager.getStatus()).toBe('granted');
    expect(start).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test('events during a denied deferral are not buffered or replayed on re-opt-in', async () => {
    const plugin = createPlugin();
    init({
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    });
    await plugin.execute?.({
      event_type: 'while_denied',
      event_properties: {},
    } as never);

    // Re-opt-in launches the client; the denied-era event must not replay.
    setConsentStatus('granted');
    const trackEvent = jest.fn();
    flushEventBuffer({ trackEvent } as never);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  test('a pending start keeps startup-buffered events (gated below, not dropped)', async () => {
    const plugin = createPlugin();
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    // The client is starting (not deferred), so a racing event buffers like
    // the non-consent path; consent gating happens in the storage/impression
    // layers it flows into, not here.
    await plugin.execute?.({
      event_type: 'while_pending',
      event_properties: {},
    } as never);

    const trackEvent = jest.fn();
    flushEventBuffer({ trackEvent } as never);
    expect(trackEvent).toHaveBeenCalledTimes(1);
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
        consentOptions: { consentRequired: true, consentStatus: 'denied' },
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

  describe('debug state', () => {
    test('getDebugState().consent tracks the gate through pending -> granted', () => {
      init({
        consentOptions: { consentRequired: true, consentStatus: 'pending' },
      });
      expect(DebugRecorder.getDebugState().consent).toEqual({
        status: 'pending',
        required: true,
        started: false,
        startDeferred: true,
        impressionBuffers: [],
      });

      setConsentStatus('granted');
      expect(DebugRecorder.getDebugState().consent).toEqual({
        status: 'granted',
        required: true,
        started: true,
        startDeferred: false,
        impressionBuffers: [],
      });
    });

    test('without gating the consent section reads inert', () => {
      init({});
      expect(DebugRecorder.getDebugState().consent).toEqual({
        status: 'pending',
        required: false,
        started: true,
        startDeferred: false,
        impressionBuffers: [],
      });
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
