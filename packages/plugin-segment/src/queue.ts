import { ExperimentEvent } from '@amplitude/experiment-js-client';
import {
  isLocalStorageAvailable,
  safeGlobal,
} from '@amplitude/experiment-core';

const MAX_QUEUE_SIZE = 512;

export class PersistentTrackingQueue {
  private readonly storageKey: string;
  private readonly maxQueueSize: number;
  private readonly isLocalStorageAvailable = isLocalStorageAvailable();
  private inMemoryQueue: ExperimentEvent[] = [];
  private poller: any | undefined;
  private tracker: ((event: ExperimentEvent) => boolean) | undefined;

  constructor(
    instanceKey = 'analytics',
    maxQueueSize: number = MAX_QUEUE_SIZE,
  ) {
    this.storageKey = `EXP_segment_unsent_${instanceKey}`;
    this.maxQueueSize = maxQueueSize;
    this.loadQueue();
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

    const successfulEvents: ExperimentEvent[] = [];
    for (const event of this.inMemoryQueue) {
      if (this.tracker(event)) {
        successfulEvents.push(event);
      } else {
        break;
      }
    }

    // Remove successfully tracked events
    this.inMemoryQueue = this.inMemoryQueue.slice(successfulEvents.length);

    if (this.inMemoryQueue.length === 0 && this.poller) {
      safeGlobal.clearInterval(this.poller);
      this.poller = undefined;
    }
  }

  private loadQueue(): void {
    if (this.isLocalStorageAvailable) {
      try {
        const storedQueue = safeGlobal.localStorage.getItem(this.storageKey);
        this.inMemoryQueue = storedQueue ? JSON.parse(storedQueue) : [];
      } catch (e) {
        this.inMemoryQueue = [];
      }
    }
  }

  private storeQueue(): void {
    if (this.isLocalStorageAvailable) {
      try {
        // Trim the queue if it is too large
        if (this.inMemoryQueue.length > this.maxQueueSize) {
          this.inMemoryQueue = this.inMemoryQueue.slice(
            this.inMemoryQueue.length - this.maxQueueSize,
          );
        }
        safeGlobal.localStorage.setItem(
          this.storageKey,
          JSON.stringify(this.inMemoryQueue),
        );
      } catch (e) {
        // Ignore storage errors
      }
    }
  }

  private loadFlushStore(): void {
    this.loadQueue();
    this.flush();
    this.storeQueue();
  }
}
