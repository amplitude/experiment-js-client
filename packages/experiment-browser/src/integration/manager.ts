import {
  getClearInterval,
  getGlobalScope,
  getLocalStorage,
  getSessionStorage,
  getSetInterval,
  isLocalStorageAvailable,
} from '@amplitude/experiment-core';

import { Defaults, ExperimentConfig } from '../config';
import { Client } from '../types/client';
import { Exposure } from '../types/exposure';
import { ExperimentEvent, IntegrationPlugin } from '../types/plugin';
import { ExperimentUser } from '../types/user';

const MAX_QUEUE_SIZE = 512;

interface Identity {
  userId?: string;
  deviceId?: string;
}

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
   * @param user
   */
  track(exposure: Exposure, user?: ExperimentUser): void {
    if (this.cache.shouldTrack(exposure, user)) {
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
  private identity: Identity = {};

  constructor(instanceName: string) {
    this.storageKey = `EXP_sent_v3_${instanceName}`;
    // Remove previous versions of storage if they exist.
    const sessionStorage = getSessionStorage();
    if (this.isSessionStorageAvailable && sessionStorage) {
      sessionStorage.removeItem(`EXP_sent_${instanceName}`);
      sessionStorage.removeItem(`EXP_sent_v2_${instanceName}`);
    }
  }

  shouldTrack(exposure: Exposure, user?: ExperimentUser): boolean {
    // Always track web impressions.
    if (exposure.metadata?.deliveryMethod === 'web') {
      return true;
    }

    const newIdentity: Identity = {
      userId: user?.user_id,
      deviceId: user?.device_id,
    };

    if (!this.identityEquals(this.identity, newIdentity)) {
      this.clearCache();
    }
    this.identity = newIdentity;

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

  private clearCache(): void {
    this.inMemoryCache = {};
    const sessionStorage = getSessionStorage();
    if (this.isSessionStorageAvailable && sessionStorage) {
      sessionStorage.removeItem(this.storageKey);
    }
  }

  private identityEquals(id1: Identity, id2: Identity): boolean {
    if (id1.userId && id2.userId) {
      return id1.userId === id2.userId;
    }
    if (!id1.userId && !id2.userId) {
      return id1.deviceId === id2.deviceId;
    }
    return false;
  }

  private loadCache(): void {
    const sessionStorage = getSessionStorage();
    if (this.isSessionStorageAvailable && sessionStorage) {
      const storedCache = sessionStorage.getItem(this.storageKey);
      this.inMemoryCache = storedCache ? JSON.parse(storedCache) : {};
    }
  }

  private storeCache(): void {
    const sessionStorage = getSessionStorage();
    if (this.isSessionStorageAvailable && sessionStorage) {
      try {
        sessionStorage.setItem(
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
    const setInterval = getSetInterval();
    if (setInterval) {
      this.poller = setInterval(() => {
        this.loadFlushStore();
      }, 1000);
    }
    this.loadFlushStore();
  }

  private flush(): void {
    if (!this.tracker) return;
    if (this.inMemoryQueue.length === 0) return;
    let i = 0;
    for (; i < this.inMemoryQueue.length; i++) {
      try {
        if (!this.tracker(this.inMemoryQueue[i])) {
          break;
        }
      } catch (e) {
        break;
      }
    }
    this.inMemoryQueue = this.inMemoryQueue.slice(i);
    if (this.inMemoryQueue.length === 0 && this.poller) {
      const clearInterval = getClearInterval();
      if (clearInterval) {
        clearInterval(this.poller);
      }
      this.poller = undefined;
    }
  }

  private loadQueue(): void {
    const localStorage = getLocalStorage();
    if (this.isLocalStorageAvailable && localStorage) {
      const storedQueue = localStorage.getItem(this.storageKey);
      this.inMemoryQueue = storedQueue ? JSON.parse(storedQueue) : [];
    }
  }

  private storeQueue(): void {
    const localStorage = getLocalStorage();
    if (this.isLocalStorageAvailable && localStorage) {
      // Trim the queue if it is too large.
      if (this.inMemoryQueue.length > this.maxQueueSize) {
        this.inMemoryQueue = this.inMemoryQueue.slice(
          this.inMemoryQueue.length - this.maxQueueSize,
        );
      }
      localStorage.setItem(this.storageKey, JSON.stringify(this.inMemoryQueue));
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
