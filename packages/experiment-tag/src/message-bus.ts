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

export type ElementAppearedPayload = { mutationList: MutationRecord[] };
export type ElementVisiblePayload = { mutationList: MutationRecord[] };
export type AnalyticsEventPayload = AnalyticsEvent;
export type ManualTriggerPayload = { name: string };
export type UrlChangePayload = { updateActivePages?: boolean };

export type MessagePayloads = {
  element_appeared: ElementAppearedPayload;
  element_visible: ElementVisiblePayload;
  url_change: UrlChangePayload;
  analytics_event: AnalyticsEventPayload;
  manual: ManualTriggerPayload;
};

export type MessageType = keyof MessagePayloads;

interface SubscriberGroup<T extends MessageType> {
  subscribers: Subscriber<T>[];
  callback?: (payload: MessagePayloads[T]) => void;
}

export class MessageBus {
  private messageToSubscriberGroup: Map<MessageType, SubscriberGroup<any>>;
  private subscriberGroupCallback: Map<MessageType, (any) => void>;

  constructor() {
    this.messageToSubscriberGroup = new Map();
    this.subscriberGroupCallback = new Map();
  }

  subscribe<T extends MessageType>(
    messageType: T,
    listener: Subscriber<T>['callback'],
    listenerId: string | undefined = undefined,
    groupCallback?: (payload: MessagePayloads[T]) => void,
  ): void {
    // this happens upon init, page objects "listen" to triggers relevant to them
    let entry = this.messageToSubscriberGroup.get(
      messageType,
    ) as SubscriberGroup<T>;
    if (!entry) {
      entry = { subscribers: [] };
      this.messageToSubscriberGroup.set(messageType, entry);
      groupCallback &&
        this.subscriberGroupCallback.set(messageType, groupCallback);
    }

    const subscriber: Subscriber<T> = {
      identifier: listenerId,
      callback: listener,
    };
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
      subscriber.callback(payload);
    });
    this.subscriberGroupCallback.get(messageType)?.(payload);
  }

  unsubscribeAll(): void {
    this.messageToSubscriberGroup = new Map();
    this.subscriberGroupCallback = new Map();
  }
}
