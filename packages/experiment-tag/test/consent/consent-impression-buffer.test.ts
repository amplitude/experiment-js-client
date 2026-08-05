import type {
  ExperimentEvent,
  ExperimentUser,
  IntegrationPlugin,
} from '@amplitude/experiment-js-client';

import { activateConsent } from './consent-test-util';

import { consentGate } from 'src/consent/consent-gate';
import {
  getImpressionBufferDebugState,
  resetImpressionBufferRegistry,
  wrapIntegrationTrack,
} from 'src/consent/consent-impression-buffer';

interface FakeIntegration extends IntegrationPlugin {
  tracked: ExperimentEvent[];
  /** What the integration reports back; false means "not taken". */
  accepts: boolean;
  /** Stands in for an analytics SDK that blows up mid-track. */
  throws: boolean;
}

const fakeIntegration = (): FakeIntegration => ({
  type: 'integration' as IntegrationPlugin['type'],
  tracked: [],
  accepts: true,
  throws: false,
  getUser: (): ExperimentUser => ({}),
  track(event: ExperimentEvent): boolean {
    if (this.throws) {
      throw new Error('analytics blew up');
    }
    if (!this.accepts) {
      return false;
    }
    this.tracked.push(event);
    return true;
  },
});

const impression = (flagKey: string): ExperimentEvent => ({
  eventType: '$impression',
  eventProperties: { flag_key: flagKey, variant: 'treatment' },
});

const trackedFlagKeys = (integration: FakeIntegration): unknown[] =>
  integration.tracked.map((e) => e.eventProperties?.flag_key);

describe('impression consent buffer', () => {
  beforeEach(() => {
    consentGate.reset();
    resetImpressionBufferRegistry();
    jest.useRealTimers();
  });

  it('tracks through when consent was granted from the start', () => {
    activateConsent('granted');
    const integration = fakeIntegration();
    wrapIntegrationTrack(integration);

    expect(integration.track(impression('flag-1'))).toBe(true);

    expect(trackedFlagKeys(integration)).toEqual(['flag-1']);
  });

  it('relays what the integration reports, so the SDK can retry a refusal', () => {
    activateConsent('granted');
    const integration = fakeIntegration();
    integration.accepts = false;
    wrapIntegrationTrack(integration);

    expect(integration.track(impression('flag-1'))).toBe(false);
  });

  it('leaves an already-wrapped integration alone', () => {
    activateConsent('pending');
    const integration = fakeIntegration();
    wrapIntegrationTrack(integration);
    const wrapped = integration.track;

    wrapIntegrationTrack(integration);

    expect(integration.track).toBe(wrapped);
  });

  describe('pending', () => {
    it('withholds the impression and reports it as tracked', () => {
      activateConsent('pending');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);

      // Reporting success is what stops the SDK's queue from parking the
      // impression in localStorage.
      expect(integration.track(impression('flag-1'))).toBe(true);
      expect(integration.tracked).toEqual([]);
    });

    it('stamps the time the impression occurred', () => {
      activateConsent('pending');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);
      const now = jest.spyOn(Date, 'now').mockReturnValue(1000);

      integration.track(impression('flag-1'));
      now.mockReturnValue(9000);
      consentGate.manager.setStatus('granted');

      expect(integration.tracked[0].eventProperties).toEqual({
        flag_key: 'flag-1',
        variant: 'treatment',
        time: 1000,
      });
      now.mockRestore();
    });

    it('keeps an explicit time rather than overwriting it', () => {
      activateConsent('pending');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);

      integration.track({
        eventType: '$impression',
        eventProperties: { flag_key: 'flag-1', time: 42 },
      });
      consentGate.manager.setStatus('granted');

      expect(integration.tracked[0].eventProperties?.time).toEqual(42);
    });

    it('does not mutate the caller\u2019s event object', () => {
      activateConsent('pending');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);
      const event = impression('flag-1');

      integration.track(event);

      expect(event.eventProperties).toEqual({
        flag_key: 'flag-1',
        variant: 'treatment',
      });
    });
  });

  describe('grant', () => {
    it('sends the deferred impressions in the order they occurred', () => {
      activateConsent('pending');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);
      integration.track(impression('flag-1'));
      integration.track(impression('flag-2'));

      consentGate.manager.setStatus('granted');

      expect(trackedFlagKeys(integration)).toEqual(['flag-1', 'flag-2']);
    });

    it('tracks through directly afterwards', () => {
      activateConsent('pending');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);
      consentGate.manager.setStatus('granted');

      integration.track(impression('flag-1'));

      expect(trackedFlagKeys(integration)).toEqual(['flag-1']);
    });

    it('retries impressions the integration is not yet ready to take', () => {
      jest.useFakeTimers();
      activateConsent('pending');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);
      integration.track(impression('flag-1'));
      integration.accepts = false;

      consentGate.manager.setStatus('granted');
      expect(integration.tracked).toEqual([]);

      integration.accepts = true;
      jest.advanceTimersByTime(1000);

      expect(trackedFlagKeys(integration)).toEqual(['flag-1']);
    });

    it('stops retrying once the buffer drains', () => {
      jest.useFakeTimers();
      activateConsent('pending');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);
      integration.track(impression('flag-1'));
      integration.accepts = false;
      consentGate.manager.setStatus('granted');
      integration.accepts = true;
      jest.advanceTimersByTime(1000);

      jest.advanceTimersByTime(5000);

      expect(trackedFlagKeys(integration)).toEqual(['flag-1']);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('survives an integration that throws, retrying it later', () => {
      jest.useFakeTimers();
      activateConsent('pending');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);
      integration.track(impression('flag-1'));
      integration.throws = true;

      consentGate.manager.setStatus('granted');
      expect(integration.tracked).toEqual([]);

      integration.throws = false;
      jest.advanceTimersByTime(1000);

      expect(trackedFlagKeys(integration)).toEqual(['flag-1']);
    });
  });

  describe('denial', () => {
    it('drops the impressions deferred while consent was pending', () => {
      activateConsent('pending');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);
      integration.track(impression('flag-1'));

      consentGate.manager.setStatus('denied');

      expect(integration.tracked).toEqual([]);
    });

    it('does not send those impressions if consent arrives later', () => {
      activateConsent('pending');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);
      integration.track(impression('flag-1'));
      consentGate.manager.setStatus('denied');

      consentGate.manager.setStatus('granted');

      expect(integration.tracked).toEqual([]);
    });

    it('discards later impressions rather than tracking them', () => {
      // Revocation leaves a running client, which must stop reporting.
      activateConsent('granted');
      consentGate.manager.setStatus('denied');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);

      expect(integration.track(impression('flag-1'))).toBe(true);
      expect(integration.tracked).toEqual([]);
    });
  });

  it('tracks through when consent gating was never activated', () => {
    const integration = fakeIntegration();
    wrapIntegrationTrack(integration);

    integration.track(impression('flag-1'));

    expect(trackedFlagKeys(integration)).toEqual(['flag-1']);
  });

  describe('debug state', () => {
    it('reports one entry per wrapped integration with live counts', () => {
      activateConsent('pending');
      const first = fakeIntegration();
      const second = fakeIntegration();
      wrapIntegrationTrack(first);
      wrapIntegrationTrack(second);
      first.track(impression('flag-1'));
      first.track(impression('flag-2'));

      expect(getImpressionBufferDebugState()).toEqual([
        { buffered: 2, flushArmed: true, retrying: false },
        { buffered: 0, flushArmed: false, retrying: false },
      ]);
    });

    it('reflects a drained buffer after a grant, and a live retry poller', () => {
      jest.useFakeTimers();
      activateConsent('pending');
      const integration = fakeIntegration();
      wrapIntegrationTrack(integration);
      integration.track(impression('flag-1'));
      integration.accepts = false;

      consentGate.manager.setStatus('granted');
      expect(getImpressionBufferDebugState()).toEqual([
        { buffered: 1, flushArmed: true, retrying: true },
      ]);

      integration.accepts = true;
      jest.advanceTimersByTime(1000);
      expect(getImpressionBufferDebugState()).toEqual([
        { buffered: 0, flushArmed: true, retrying: false },
      ]);
    });
  });
});
