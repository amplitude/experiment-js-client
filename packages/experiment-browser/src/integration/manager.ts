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

  ready(): Promise<void> {
    if (!this.integration) {
      return Promise.resolve();
    }
    return this.isReady;
  }

  setIntegration(integration: IntegrationPlugin): void {
    if (this.integration) {
      void this.integration.teardown();
    }
    this.integration = integration;
    if (integration.setup) {
      this.integration.setup(this.config, this.client).then(
        () => {
          this.queue.tracker = this.integration.track;
          this.resolve();
        },
        (e) => {
          console.error('Integration setup failed.', e);
          this.queue.tracker = this.integration.track;
          this.resolve();
        },
      );
    } else {
      this.queue.tracker = this.integration.track;
      this.resolve();
    }
  }

  getUser(): ExperimentUser {
    if (!this.integration) {
      return {};
    }
    return this.integration.getUser();
  }

  track(exposure: Exposure): void {
    if (this.cache.shouldTrack(exposure)) {
      this.queue.push({
        eventType: '$exposure',
        eventProperties: exposure,
      });
    }
  }
}

export class SessionDedupeCache {
  private readonly storageKey: string;
  private readonly isSessionStorageAvailable = isSessionStorageAvailable();
  private inMemoryCache: Record<string, string> = {};

  constructor(instanceName: string) {
    this.storageKey = `EXP_sent_${instanceName}`;
  }

  shouldTrack(exposure: Exposure): boolean {
    this.loadCache();
    const value = this.inMemoryCache[exposure.flag_key];
    let shouldTrack = false;
    if (!value) {
      shouldTrack = true;
      this.inMemoryCache[exposure.flag_key] = exposure.variant;
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
      safeGlobal.sessionStorage.setItem(
        this.storageKey,
        JSON.stringify(this.inMemoryCache),
      );
    }
  }
}

export class PersistentTrackingQueue {
  private readonly storageKey: string;
  private readonly isLocalStorageAvailable = isLocalStorageAvailable();
  private inMemoryQueue: ExperimentEvent[] = [];

  tracker: ((event: ExperimentEvent) => boolean) | undefined;

  constructor(instanceName: string) {
    this.storageKey = `EXP_unsent_${instanceName}`;
  }

  push(event: ExperimentEvent): void {
    this.loadQueue();
    this.inMemoryQueue.push(event);
    this.flush();
    this.storeQueue();
  }

  private flush(): void {
    if (!this.tracker) return;
    if (this.inMemoryQueue.length === 0) return;
    for (const event of this.inMemoryQueue) {
      if (!this.tracker(event)) return;
    }
    this.inMemoryQueue = [];
  }

  private loadQueue(): void {
    if (this.isLocalStorageAvailable) {
      const storedQueue = safeGlobal.localStorage.getItem(this.storageKey);
      this.inMemoryQueue = storedQueue ? JSON.parse(storedQueue) : [];
    }
  }

  private storeQueue(): void {
    if (this.isLocalStorageAvailable) {
      safeGlobal.localStorage.setItem(
        this.storageKey,
        JSON.stringify(this.inMemoryQueue),
      );
    }
  }
}

const isSessionStorageAvailable = (): boolean => {
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
