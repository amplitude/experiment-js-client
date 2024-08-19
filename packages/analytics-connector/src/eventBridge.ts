import {
  getGlobalScope,
  isLocalStorageAvailable,
} from '@amplitude/experiment-core';

export type AnalyticsEvent = {
  eventType: string;
  eventProperties?: Record<string, unknown>;
  userProperties?: Record<string, unknown>;
};

export type AnalyticsEventReceiver = (event: AnalyticsEvent) => void;

export interface EventBridge {
  logEvent(event: AnalyticsEvent): void;
  setEventReceiver(listener: AnalyticsEventReceiver): void;
  setApiKey(apiKey: string): void;
}

export class EventBridgeImpl implements EventBridge {
  private apiKey = '';
  private receiver: AnalyticsEventReceiver;
  private inMemoryQueue: AnalyticsEvent[] = [];
  private globalScope = getGlobalScope();

  private getStorageKey(): string {
    return `EXP_unsent_${this.apiKey.slice(0, 10)}`;
  }

  private initializeStorage(): void {
    if (isLocalStorageAvailable()) {
      const storageKey = this.getStorageKey();
      const storedQueue = this.globalScope.localStorage.getItem(storageKey);
      if (storedQueue === null) {
        // Initialize with an empty array if no queue is found
        this.globalScope.localStorage.setItem(storageKey, JSON.stringify([]));
      }
    }
  }

  private getQueue(): AnalyticsEvent[] {
    if (isLocalStorageAvailable()) {
      const storageKey = this.getStorageKey();
      const storedQueue = this.globalScope.localStorage.getItem(storageKey);
      return storedQueue ? JSON.parse(storedQueue) : [];
    } else {
      return this.inMemoryQueue;
    }
  }

  private setQueue(queue: AnalyticsEvent[]): void {
    if (isLocalStorageAvailable()) {
      this.globalScope.localStorage.setItem(
        this.getStorageKey(),
        JSON.stringify(queue),
      );
    } else {
      this.inMemoryQueue = queue;
    }
  }

  logEvent(event: AnalyticsEvent): void {
    if (!this.receiver) {
      this.initializeStorage(); // Ensure storage is initialized
      const queue = this.getQueue();
      if (queue.length < 512) {
        queue.push(event);
        this.setQueue(queue);
      }
    } else {
      this.receiver(event);
    }
  }

  setEventReceiver(receiver: AnalyticsEventReceiver): void {
    this.receiver = receiver;
    const queue = this.getQueue();
    if (queue.length > 0) {
      queue.forEach((event) => {
        receiver(event);
      });
      this.setQueue([]);
    }
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    // Initialize storage when the API key is set, if necessary
    this.initializeStorage();
  }
}
