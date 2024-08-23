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

  setInstanceName(instanceName: string): void;
}

export class EventBridgeImpl implements EventBridge {
  private instanceName = '';
  private receiver: AnalyticsEventReceiver;
  private inMemoryQueue: AnalyticsEvent[] = [];
  private globalScope = getGlobalScope();

  private getStorageKey(): string {
    return `EXP_unsent_${this.instanceName}`;
  }

  private getQueue(): AnalyticsEvent[] {
    if (isLocalStorageAvailable()) {
      const storageKey = this.getStorageKey();
      const storedQueue = this.globalScope.localStorage.getItem(storageKey);
      this.inMemoryQueue = storedQueue ? JSON.parse(storedQueue) : [];
    }
    return this.inMemoryQueue;
  }

  private setQueue(queue: AnalyticsEvent[]): void {
    this.inMemoryQueue = queue;
    if (isLocalStorageAvailable()) {
      this.globalScope.localStorage.setItem(
        this.getStorageKey(),
        JSON.stringify(queue),
      );
    }
  }

  logEvent(event: AnalyticsEvent): void {
    if (!this.receiver) {
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

  public setInstanceName(instanceName: string): void {
    this.instanceName = instanceName;
  }
}
