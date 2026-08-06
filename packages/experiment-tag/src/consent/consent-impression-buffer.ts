import { getClearInterval, getSetInterval } from '@amplitude/experiment-core';
import type {
  ExperimentEvent,
  IntegrationPlugin,
} from '@amplitude/experiment-js-client';

import type { ImpressionBufferDebugInfo } from '../types/debug';

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

/**
 * The integration's original `track`, captured before the buffer replaces it.
 * The boolean is `IntegrationPlugin.track`'s contract: whether the downstream
 * integration accepted the event — the analytics SDK it forwards to may not
 * have a receiver attached yet. `flush` relies on it: a `false` (or a throw)
 * stops the replay, keeps the remainder buffered, and hands off to the retry
 * poller.
 */
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

  /** @param realTrack The wrapped integration's original `track` — see {@link Tracker}. */
  constructor(private readonly realTrack: Tracker) {}

  getDebugState(): ImpressionBufferDebugInfo {
    return {
      buffered: this.buffered.length,
      flushArmed: this.flushArmed,
      retrying: this.poller !== undefined,
    };
  }

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
        this.discardBuffered();
      }
    });
  }

  private discardBuffered(): void {
    this.buffered.length = 0;
    this.stopRetry();
  }

  /**
   * Replays the deferred impressions in the order they occurred, stopping at the
   * first one the integration will not take — the analytics SDK it forwards to
   * may not have a receiver attached yet. The rest stay buffered and a poller
   * retries, mirroring how the SDK's own queue drains.
   */
  private flush(): void {
    if (isConsentWithheld()) {
      if (!isConsentPending()) {
        this.discardBuffered();
      }
      return;
    }
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
 *
 * The `time` key is a cross-SDK contract, not a label: the analytics SDK's
 * event-bridge receiver destructures `time` out of `eventProperties` and
 * promotes it to the canonical event timestamp (`setEventReceiver` in
 * Amplitude-TypeScript's browser-client). The client already stamps it on web
 * experiment exposures, so this is a fallback for events that arrive without
 * one.
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
 * Live buffers, one per wrapped integration, for `getDebugState()`. Buffers
 * live as long as the integration they wrap (the page), so holding them here
 * does not extend anything's lifetime.
 */
const registry: ImpressionBuffer[] = [];

/** Per-buffer state for the debug snapshot's consent section. */
export const getImpressionBufferDebugState =
  (): ImpressionBufferDebugInfo[] => {
    return registry.map((buffer) => buffer.getDebugState());
  };

/** Test-only: clears the registry between cases. */
export const resetImpressionBufferRegistry = (): void => {
  registry.length = 0;
};

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
  registry.push(buffer);
  integration.track = (event: ExperimentEvent) => buffer.track(event);
  Object.defineProperty(marked, WRAPPED_KEY, { value: true });
}
