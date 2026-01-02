export interface AnalyticsEvent {
  event: string;
  properties: Record<string, unknown>;
}

type Subscriber<T extends MessageType> = {
  identifier?: string;
  callback: (payload: MessagePayloads[T]) => void;
};

export type ElementAppearedPayload = { mutationList: MutationRecord[] };
export type ElementVisiblePayload = Record<string, never>;
export type AnalyticsEventPayload = AnalyticsEvent;
export type ManualTriggerPayload = { name: string };
export type UrlChangePayload = { updateActivePages?: boolean };
export type TimeOnPagePayload = { durationMs: number };
export type ExitIntentPayload = { durationMs: number };
export type UserInteractionPayload = Record<string, never>;
export type ScrolledToPayload = Record<string, never>;

export type MessagePayloads = {
  element_appeared: ElementAppearedPayload;
  element_visible: ElementVisiblePayload;
  url_change: UrlChangePayload;
  analytics_event: AnalyticsEventPayload;
  manual: ManualTriggerPayload;
  time_on_page: TimeOnPagePayload;
  user_interaction: UserInteractionPayload;
  exit_intent: ExitIntentPayload;
  scrolled_to: ScrolledToPayload;
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
  ): void {
    // Subscribe individual callback for this message type
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
    entry.subscribers.push(subscriber);
  }

  groupSubscribe<T extends MessageType>(
    messageType: T,
    groupCallback: (payload: MessagePayloads[T]) => void,
  ): void {
    // Subscribe groupCallback that runs once after all individual subscribers
    // Only one groupCallback per message type - subsequent calls overwrite
    this.subscriberGroupCallback.set(messageType, groupCallback);

    // Ensure entry exists for this message type
    if (!this.messageToSubscriberGroup.has(messageType)) {
      this.messageToSubscriberGroup.set(messageType, { subscribers: [] });
    }
  }

  publish<T extends MessageType>(
    messageType: T,
    payload?: MessagePayloads[T],
  ): void {
    const entry = this.messageToSubscriberGroup.get(
      messageType,
    ) as SubscriberGroup<T>;
    if (!entry) return;

    // Ensure payload is initialized before use
    payload = payload || ({} as MessagePayloads[T]);

    entry.subscribers.forEach((subscriber) => {
      subscriber.callback(payload);
    });
    this.subscriberGroupCallback.get(messageType)?.(payload);
  }

  unsubscribeAll(): void {
    this.messageToSubscriberGroup = new Map();
    this.subscriberGroupCallback = new Map();
  }
}
