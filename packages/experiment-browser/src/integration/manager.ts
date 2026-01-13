import {
  getGlobalScope,
  isLocalStorageAvailable,
  safeGlobal,
} from '@amplitude/experiment-core';

import { Defaults, ExperimentConfig } from '../config';
import { Client } from '../types/client';
import { Exposure } from '../types/exposure';
import { ExperimentEvent, IntegrationPlugin } from '../types/plugin';
import { ExperimentUser } from '../types/user';

const MAX_QUEUE_SIZE = 512;

/**
 * Handles integration plugin management, event persistence and deduplication.
 */
export class IntegrationManager {
  private readonly config: ExperimentConfig;
  private readonly client: Client;
  private integration: IntegrationPlugin;
  private readonly queue: PersistentTrackingQueue;
  private readonly cache: SessionDedupeCache;

  private resolve: () => void;
  private readonly isReady: Promise<void> = new Promise((resolve) => {
    this.resolve = resolve;
  });

  constructor(config: ExperimentConfig, client: Client) {
    this.config = config;
    this.client = client;
    const instanceName = config.instanceName ?? Defaults.instanceName;
    this.queue = new PersistentTrackingQueue(instanceName);
    this.cache = new SessionDedupeCache(instanceName);
  }

  /**
   * Returns a promise when the integration has completed setup. If no
   * integration has been set, returns a resolved promise.
   */
  ready(): Promise<void> {
    if (!this.integration) {
      return Promise.resolve();
    }
    return this.isReady;
  }

  /**
   * Set the integration to be managed. An existing integration is torndown,
   * and the new integration is setup. This function resolves the promise
   * returned by ready() if it has not already been resolved.
   *
   * @param integration the integration to manage.
   */
  setIntegration(integration: IntegrationPlugin): void {
    if (this.integration && this.integration.teardown) {
      void this.integration.teardown();
    }
    this.integration = integration;
    if (integration.setup) {
      this.integration.setup(this.config, this.client).then(
        () => {
          this.queue.setTracker(this.integration.track.bind(integration));
          this.resolve();
        },
        () => {
          this.queue.setTracker(this.integration.track.bind(integration));
          this.resolve();
        },
      );
    } else {
      this.queue.setTracker(this.integration.track.bind(integration));
      this.resolve();
    }
  }

  /**
   * Get the user from the integration. If no integration is set, returns an
   * empty object.
   */
  getUser(): ExperimentUser {
    if (!this.integration) {
      return {};
    }
    return this.integration.getUser();
  }

  /**
   * Deduplicates exposures using session storage, then tracks the event to the
   * integration. If no integration is set, or if the integration returns false,
   * the event is persisted in local storage.
   *
   * @param exposure
   */
  track(exposure: Exposure): void {
    if (this.cache.shouldTrack(exposure)) {
      const event = this.getExposureEvent(exposure);
      this.queue.push(event);
    }
  }

  private getExposureEvent(exposure: Exposure): ExperimentEvent {
    let event: ExperimentEvent = {
      eventType: '$exposure',
      eventProperties: exposure,
    };
    if (exposure.metadata?.exposureEvent) {
      // Metadata specifically passes the exposure event definition
      event = {
        eventType: exposure.metadata?.exposureEvent as string,
        eventProperties: exposure,
      };
    } else if (exposure.metadata?.deliveryMethod === 'web') {
      // Web experiments track impression events by default
      event = {
        eventType: '$impression',
        eventProperties: exposure,
      };
    }
    return event;
  }
}

export class SessionDedupeCache {
  private readonly storageKey: string;
  private readonly isSessionStorageAvailable = checkIsSessionStorageAvailable();
  private inMemoryCache: Record<string, string | null> = {};

  constructor(instanceName: string) {
    this.storageKey = `EXP_sent_v3_${instanceName}`;
    // Remove previous versions of storage if they exist.
    if (this.isSessionStorageAvailable) {
      safeGlobal.sessionStorage.removeItem(`EXP_sent_${instanceName}`);
      safeGlobal.sessionStorage.removeItem(`EXP_sent_v2_${instanceName}`);
    }
  }

  shouldTrack(exposure: Exposure): boolean {
    // Always track web impressions.
    if (exposure.metadata?.deliveryMethod === 'web') {
      return true;
    }
    this.loadCache();
    const hasKey = exposure.flag_key in this.inMemoryCache;
    const cachedVariant = this.inMemoryCache[exposure.flag_key];
    // Normalize undefined to null for comparison and storage since JSON.stringify
    // omits keys with undefined values and converts undefined to null
    const normalizedExposureVariant = exposure.variant ?? null;
    const normalizedCachedVariant = cachedVariant ?? null;
    let shouldTrack = false;
    if (!hasKey || normalizedCachedVariant !== normalizedExposureVariant) {
      shouldTrack = true;
      this.inMemoryCache[exposure.flag_key] = normalizedExposureVariant;
    }
    this.storeCache();
    return shouldTrack;
  }

  private loadCache(): void {
    if (this.isSessionStorageAvailable) {
      const storedCache = safeGlobal.sessionStorage.getItem(this.storageKey);
      this.inMemoryCache = storedCache ? JSON.parse(storedCache) : {};
    }
  }

  private storeCache(): void {
    if (this.isSessionStorageAvailable) {
      try {
        safeGlobal.sessionStorage.setItem(
          this.storageKey,
          JSON.stringify(this.inMemoryCache),
        );
      } catch (e) {
        // Gracefully handle QuotaExceededError or other storage errors.
        // The in-memory cache will still work for deduplication within this session.
      }
    }
  }
}

export class PersistentTrackingQueue {
  private readonly storageKey: string;
  private readonly maxQueueSize: number;
  private readonly isLocalStorageAvailable = isLocalStorageAvailable();
  private inMemoryQueue: ExperimentEvent[] = [];
  private poller: any | undefined;
  private tracker: ((event: ExperimentEvent) => boolean) | undefined;

  constructor(instanceName: string, maxQueueSize: number = MAX_QUEUE_SIZE) {
    this.storageKey = `EXP_unsent_${instanceName}`;
    this.maxQueueSize = maxQueueSize;
  }

  push(event: ExperimentEvent): void {
    this.loadQueue();
    this.inMemoryQueue.push(event);
    this.flush();
    this.storeQueue();
  }

  setTracker(tracker: (event: ExperimentEvent) => boolean): void {
    this.tracker = tracker;
    this.poller = safeGlobal.setInterval(() => {
      this.loadFlushStore();
    }, 1000);
    this.loadFlushStore();
  }

  private flush(): void {
    if (!this.tracker) return;
    if (this.inMemoryQueue.length === 0) return;
    for (const event of this.inMemoryQueue) {
      try {
        if (!this.tracker(event)) {
          return;
        }
      } catch (e) {
        return;
      }
    }
    this.inMemoryQueue = [];
    if (this.poller) {
      safeGlobal.clearInterval(this.poller);
      this.poller = undefined;
    }
  }

  private loadQueue(): void {
    if (this.isLocalStorageAvailable) {
      const storedQueue = safeGlobal.localStorage.getItem(this.storageKey);
      this.inMemoryQueue = storedQueue ? JSON.parse(storedQueue) : [];
    }
  }

  private storeQueue(): void {
    if (this.isLocalStorageAvailable) {
      // Trim the queue if it is too large.
      if (this.inMemoryQueue.length > this.maxQueueSize) {
        this.inMemoryQueue = this.inMemoryQueue.slice(
          this.inMemoryQueue.length - this.maxQueueSize,
        );
      }
      safeGlobal.localStorage.setItem(
        this.storageKey,
        JSON.stringify(this.inMemoryQueue),
      );
    }
  }

  private loadFlushStore(): void {
    this.loadQueue();
    this.flush();
    this.storeQueue();
  }
}

const checkIsSessionStorageAvailable = (): boolean => {
  const globalScope = getGlobalScope();
  if (globalScope) {
    try {
      const testKey = 'EXP_test';
      globalScope.sessionStorage.setItem(testKey, testKey);
      globalScope.sessionStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
};
