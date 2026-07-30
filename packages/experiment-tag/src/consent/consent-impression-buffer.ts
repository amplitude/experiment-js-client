import { getClearInterval, getSetInterval } from '@amplitude/experiment-core';
import type {
  ExperimentEvent,
  IntegrationPlugin,
} from '@amplitude/experiment-js-client';

import {
  isConsentPending,
  isConsentWithheld,
  onConsentDecision,
} from './consent-gate';

/** Matches the cap on the SDK's own PersistentTrackingQueue. */
const MAX_BUFFERED_EVENTS = 512;
const RETRY_INTERVAL_MS = 1000;

/**
 * Marks an integration whose `track` is already gated. A string key rather than
 * a symbol so that two copies of the tag on one page recognize each other's
 * wrapper and the integration is not gated twice.
 */
const WRAPPED_KEY = '__ampConsentGatedTrack';

type Tracker = (event: ExperimentEvent) => boolean;

/**
 * Holds impressions in memory while the visitor has yet to answer the consent
 * banner, and sends them once consent is granted.
 *
 * This sits upstream of the SDK's PersistentTrackingQueue, which would otherwise
 * park an unsent impression in localStorage. Every deferred impression therefore
 * reports itself as tracked, so the queue lets go of it and the payload never
 * reaches the device — this buffer becomes the only thing keeping it.
 */
class ImpressionBuffer {
  private readonly buffered: ExperimentEvent[] = [];
  private flushArmed = false;
  private poller: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly realTrack: Tracker) {}

  track(event: ExperimentEvent): boolean {
    if (!isConsentWithheld()) {
      return this.realTrack(event);
    }
    if (isConsentPending()) {
      this.buffer(event);
      this.armFlush();
    }
    // A refusal discards the impression: it is the one outcome where the event
    // must never be sent, so there is nothing to hold on to.
    return true;
  }

  private buffer(event: ExperimentEvent): void {
    if (this.buffered.length >= MAX_BUFFERED_EVENTS) {
      this.buffered.shift();
    }
    this.buffered.push(stampTime(event));
  }

  private armFlush(): void {
    if (this.flushArmed) {
      return;
    }
    this.flushArmed = true;
    onConsentDecision((granted) => {
      if (granted) {
        this.flush();
      } else {
        this.buffered.length = 0;
      }
    });
  }

  /**
   * Replays the deferred impressions in the order they occurred, stopping at the
   * first one the integration will not take — the analytics SDK it forwards to
   * may not have a receiver attached yet. The rest stay buffered and a poller
   * retries, mirroring how the SDK's own queue drains.
   */
  private flush(): void {
    let sent = 0;
    for (; sent < this.buffered.length; sent++) {
      try {
        if (!this.realTrack(this.buffered[sent])) {
          break;
        }
      } catch {
        break;
      }
    }
    this.buffered.splice(0, sent);
    if (this.buffered.length > 0) {
      this.startRetry();
    } else {
      this.stopRetry();
    }
  }

  private startRetry(): void {
    if (this.poller !== undefined) {
      return;
    }
    const setInterval = getSetInterval();
    if (!setInterval) {
      return;
    }
    this.poller = setInterval(() => {
      this.flush();
    }, RETRY_INTERVAL_MS);
  }

  private stopRetry(): void {
    if (this.poller === undefined) {
      return;
    }
    getClearInterval()?.(this.poller);
    this.poller = undefined;
  }
}

/**
 * Records when the impression happened. The analytics SDK timestamps an event
 * as it receives it, which for a replay is the moment of the grant — long after
 * the variant was shown for a visitor who leaves the banner up.
 */
function stampTime(event: ExperimentEvent): ExperimentEvent {
  if (event.eventProperties?.time !== undefined) {
    return event;
  }
  return {
    ...event,
    eventProperties: { ...event.eventProperties, time: Date.now() },
  };
}

/**
 * Routes an integration's impressions through a consent buffer, in place. The
 * integration is shared with the customer (they may have supplied it), so the
 * wrapper is applied at most once.
 */
export function wrapIntegrationTrack(integration: IntegrationPlugin): void {
  const marked = integration as IntegrationPlugin & Record<string, unknown>;
  if (marked[WRAPPED_KEY]) {
    return;
  }
  const buffer = new ImpressionBuffer(integration.track.bind(integration));
  integration.track = (event: ExperimentEvent) => buffer.track(event);
  Object.defineProperty(marked, WRAPPED_KEY, { value: true });
}
