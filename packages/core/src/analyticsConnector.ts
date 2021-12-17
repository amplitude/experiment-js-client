export type AnalyticsEvent = {
  eventType: string;
  eventProperties?: Record<string, unknown>;
  userProperties?: Record<string, unknown>;
};

export type AnalyticsEventReceiver = (event: AnalyticsEvent) => void;

export interface AnalyticsConnector {
  logEvent(event: AnalyticsEvent): void;
  setEventReceiver(listener: AnalyticsEventReceiver): void;
}

export class AnalyticsConnectorImpl implements AnalyticsConnector {
  private receiver: AnalyticsEventReceiver;
  private queue: AnalyticsEvent[] = [];

  logEvent(event: AnalyticsEvent): void {
    if (!this.receiver) {
      if (this.queue.length < 512) {
        this.queue.push(event);
      }
    } else {
      this.receiver(event);
    }
  }

  setEventReceiver(receiver: AnalyticsEventReceiver): void {
    this.receiver = receiver;
    if (this.queue.length > 0) {
      this.queue.forEach((event) => {
        receiver(event);
      });
      this.queue = [];
    }
  }
}
