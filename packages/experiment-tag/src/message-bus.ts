export interface EventProperties {
  [k: string]: unknown;
}

export interface AnalyticsEvent {
  event_type: string;
  event_properties: EventProperties;
}

type Subscriber<T extends MessageType> = {
  identifier?: string;
  callback: (payload: MessagePayloads[T]) => void;
};

type DomMutationPayload = { mutationList: MutationRecord[] };
type LocationChangePayload = Record<string, never>;
type AnalyticsEventPayload = AnalyticsEvent;
type ManualTriggerPayload = { name: string };

export type MessagePayloads = {
  dom_mutation: DomMutationPayload;
  location_change: LocationChangePayload;
  analytics_event: AnalyticsEventPayload;
  manual_trigger: ManualTriggerPayload;
  immediately: undefined;
};

export type MessageType = keyof MessagePayloads;

interface SubscriberGroup<T extends MessageType> {
  subscribers: Subscriber<T>[];
}

export class MessageBus {
  private messageToSubscriberGroup: Map<MessageType, SubscriberGroup<any>>;

  constructor() {
    this.messageToSubscriberGroup = new Map();
  }

  subscribe<T extends MessageType>(
    messageType: T,
    listener: Subscriber<T>['callback'],
    listenerId: string | undefined = undefined,
    debounceTimeout: number | undefined = undefined,
  ): void {
    // this happens upon init, page objects "listen" to triggers relevant to them
    let entry = this.messageToSubscriberGroup.get(
      messageType,
    ) as SubscriberGroup<T>;
    if (!entry) {
      entry = { subscribers: [] };
      this.messageToSubscriberGroup.set(messageType, entry);
    }

    const subscriber: Subscriber<T> = {
      identifier: listenerId,
      callback: listener,
    };
    // if (debounceTimeout !== undefined) {
    //   subscriber.debouncedCallback = debounce(listener, debounceTimeout);
    // }
    entry.subscribers.push(subscriber);
  }

  publish<T extends MessageType>(
    messageType: T,
    payload?: MessagePayloads[T],
  ): void {
    const entry = this.messageToSubscriberGroup.get(
      messageType,
    ) as SubscriberGroup<T>;
    if (!entry) return;

    entry.subscribers.forEach((subscriber) => {
      payload = payload || ({} as MessagePayloads[T]);
      try {
        // if (subscriber.debouncedCallback) {
        //   subscriber.debouncedCallback(payload);
        // } else {
        subscriber.callback(payload);
        // }
      } catch (error) {
        // logger.error('Error in message subscriber:', error);
      }
    });
  }

  unsubscribe<T extends MessageType>(
    messageType: T,
    subscriberIdentifier: string,
  ): void {
    const entry = this.messageToSubscriberGroup.get(messageType);
    if (!entry) return;

    const activeSubscribers: typeof entry.subscribers = [];

    for (const subscriber of entry.subscribers) {
      if (subscriber.identifier === subscriberIdentifier) {
        // subscriber.debouncedCallback?.cancel();
      } else {
        activeSubscribers.push(subscriber);
      }
    }

    entry.subscribers = activeSubscribers;
  }
}
