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
    this.queue = new PersistentTrackingQueue(
      instanceName,
      MAX_QUEUE_SIZE,
      config['internalPersistenceAllowed'],
    );
    this.cache = new SessionDedupeCache(
      instanceName,
      config['internalPersistenceAllowed'],
    );
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
  private readonly instanceName: string;
  // Lazy: the availability check writes a probe key, so it must not run
  // before the persistence guard allows storage access.
  private isSessionStorageAvailable?: boolean;
  private legacyKeysRemoved = false;
  /** A clearCache() arrived while gated; drop the stored copy on reopen. */
  private clearStoredOnReopen = false;
  /** Entries were recorded while gated; merge them into the stored copy on reopen. */
  private hasGatedEntries = false;
  private inMemoryCache: Record<string, string | null> = {};
  private identity: Identity = {};

  constructor(
    instanceName: string,
    /**
     * When provided and returning false, deduplication runs purely in memory:
     * no sessionStorage reads, writes, probes, or legacy-key cleanup. Used by
     * experiment-tag while cookie consent is withheld.
     */
    private readonly persistenceAllowed?: () => boolean,
  ) {
    this.instanceName = instanceName;
    this.storageKey = `EXP_sent_v3_${instanceName}`;
  }

  /**
   * The sessionStorage to use for this operation, or undefined while the
   * guard is closed or storage is unusable. First allowed call runs the
   * availability probe and the one-time legacy-key cleanup.
   */
  private isGated(): boolean {
    return this.persistenceAllowed !== undefined && !this.persistenceAllowed();
  }

  private usableStorage(): Storage | undefined {
    if (this.isGated()) {
      return undefined;
    }
    if (this.isSessionStorageAvailable === undefined) {
      this.isSessionStorageAvailable = checkIsSessionStorageAvailable();
    }
    const sessionStorage = getSessionStorage();
    if (!this.isSessionStorageAvailable || !sessionStorage) {
      return undefined;
    }
    if (!this.legacyKeysRemoved) {
      this.legacyKeysRemoved = true;
      sessionStorage.removeItem(`EXP_sent_${this.instanceName}`);
      sessionStorage.removeItem(`EXP_sent_v2_${this.instanceName}`);
    }
    if (this.clearStoredOnReopen) {
      this.clearStoredOnReopen = false;
      sessionStorage.removeItem(this.storageKey);
    }
    return sessionStorage;
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
      if (this.isGated()) {
        this.hasGatedEntries = true;
      }
    }
    this.storeCache();
    return shouldTrack;
  }

  private clearCache(): void {
    this.inMemoryCache = {};
    this.hasGatedEntries = false;
    const sessionStorage = this.usableStorage();
    if (sessionStorage) {
      sessionStorage.removeItem(this.storageKey);
    } else if (this.isGated()) {
      // An identity change while gated must not let a pre-gate stored cache
      // suppress the new identity's exposures once the guard reopens.
      this.clearStoredOnReopen = true;
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
    const sessionStorage = this.usableStorage();
    // While gated the in-memory cache is the only tier, so leaving it in
    // place (rather than resetting to {}) is what keeps dedupe working.
    if (sessionStorage) {
      const storedCache = sessionStorage.getItem(this.storageKey);
      const stored = storedCache ? JSON.parse(storedCache) : {};
      if (this.hasGatedEntries) {
        // Entries recorded while the guard was closed exist only in memory;
        // letting the stored copy replace them would re-track those exposures.
        this.inMemoryCache = { ...stored, ...this.inMemoryCache };
        this.hasGatedEntries = false;
      } else {
        this.inMemoryCache = stored;
      }
    }
  }

  private storeCache(): void {
    const sessionStorage = this.usableStorage();
    if (sessionStorage) {
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
  // Lazy: the availability check writes a probe key, so it must not run
  // before the persistence guard allows storage access.
  private isLocalStorageAvailable?: boolean;
  private inMemoryQueue: ExperimentEvent[] = [];
  /** Events were pushed while gated; merge them with the stored copy on reopen. */
  private holdsGatedEvents = false;
  private poller: any | undefined;
  private tracker: ((event: ExperimentEvent) => boolean) | undefined;

  constructor(
    instanceName: string,
    maxQueueSize: number = MAX_QUEUE_SIZE,
    /**
     * When provided and returning false, the queue neither reads nor writes
     * localStorage — events live only in memory. Used by experiment-tag while
     * cookie consent is withheld, so an unsent event can't be parked on the
     * device before the visitor has agreed to storage.
     */
    private readonly persistenceAllowed?: () => boolean,
  ) {
    this.storageKey = `EXP_unsent_${instanceName}`;
    this.maxQueueSize = maxQueueSize;
  }

  push(event: ExperimentEvent): void {
    this.loadQueue();
    this.inMemoryQueue.push(event);
    if (!this.canPersist()) {
      this.holdsGatedEvents = true;
    }
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

  private canPersist(): boolean {
    return this.persistenceAllowed ? this.persistenceAllowed() : true;
  }

  private usableStorage(): Storage | undefined {
    if (!this.canPersist()) return undefined;
    if (this.isLocalStorageAvailable === undefined) {
      this.isLocalStorageAvailable = isLocalStorageAvailable();
    }
    const localStorage = getLocalStorage();
    return this.isLocalStorageAvailable && localStorage
      ? localStorage
      : undefined;
  }

  private loadQueue(): void {
    // While persistence is gated the device copy is not consulted (reading is
    // access to device data too); events pushed in the meantime exist only in
    // memory and remain the queue.
    const localStorage = this.usableStorage();
    if (localStorage) {
      const storedQueue = localStorage.getItem(this.storageKey);
      const stored: ExperimentEvent[] = storedQueue
        ? JSON.parse(storedQueue)
        : [];
      if (this.holdsGatedEvents) {
        // Events pushed while the guard was closed exist only in memory;
        // append them after the (older) stored ones rather than letting
        // either copy clobber the other.
        this.inMemoryQueue = [...stored, ...this.inMemoryQueue];
        this.holdsGatedEvents = false;
      } else {
        this.inMemoryQueue = stored;
      }
    }
  }

  private storeQueue(): void {
    const localStorage = this.usableStorage();
    if (localStorage) {
      // An empty queue is represented by the key's absence rather than a
      // stored `[]` — loadQueue treats both the same, and this keeps the queue
      // from putting anything on the device when every event was handed to
      // the tracker immediately (which also matters under consent gating,
      // where the write itself is the problem).
      if (this.inMemoryQueue.length === 0) {
        localStorage.removeItem(this.storageKey);
        return;
      }
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
