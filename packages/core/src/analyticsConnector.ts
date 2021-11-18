export type AnalyticsEvent = {
  eventType: string;
  eventProperties?: Record<string, unknown>;
  userProperties?: Record<string, unknown>;
};

export type AnalyticsEventListener = (event: AnalyticsEvent) => void;

export interface AnalyticsConnector {
  logEvent(event: AnalyticsEvent): void;
  addEventListener(listener: AnalyticsEventListener): void;
  removeEventListener(listener: AnalyticsEventListener): void;
}

export class AnalyticsConnectorImpl implements AnalyticsConnector {
  private listeners = new Set<AnalyticsEventListener>();
  private queue: AnalyticsEvent[] = [];

  logEvent(event: AnalyticsEvent): void {
    if (this.listeners.size == 0) {
      this.queue.push(event);
    } else {
      this.listeners.forEach((listener) => {
        listener(event);
      });
    }
  }

  addEventListener(listener: AnalyticsEventListener): void {
    this.listeners.add(listener);
    if (this.queue.length > 0) {
      this.queue.forEach((event) => {
        listener(event);
      });
    }
  }

  removeEventListener(listener: AnalyticsEventListener): void {
    this.listeners.delete(listener);
  }
}
