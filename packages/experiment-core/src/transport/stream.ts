import { FetchError } from '../evaluation/error';

const KEEP_ALIVE_DATA = ' ';
const KEEP_ALIVE_INTERVAL_MILLIS = 33000; // 30 seconds with a 3 seconds buffer
const RECONNECTION_INTERVAL_MILLIS = 30 * 60 * 1000;
export const DEFAULT_EVENT_TYPE = 'message';

type ErrorEvent = {
  status?: number;
  message: string;
};

export interface SSE {
  addEventListener(
    event: string,
    callback: (event: MessageEvent | ErrorEvent) => void,
  ): void;
  close(): void;
}
export type SSEProvider = (url: string, headers: Record<string, string>) => SSE;

export class SSEStream {
  streamProvider: SSEProvider;
  url: string;
  headers: Record<string, string>;

  es?: SSE;
  onEventTypeUpdate: Record<string, (data: string) => void> = {};
  onError?: (error: Error) => void;
  keepAliveInterval: number;
  keepAliveTimer?: NodeJS.Timeout;
  reconnectionIntervalMillisMin: number;
  reconnectionIntervalMillisRange: number;
  reconnectionTimeout?: NodeJS.Timeout;

  constructor(
    streamProvider: SSEProvider,
    url: string,
    headers: Record<string, string>,
    keepAliveInterval = KEEP_ALIVE_INTERVAL_MILLIS,
    reconnectionIntervalMillis = RECONNECTION_INTERVAL_MILLIS,
  ) {
    this.streamProvider = streamProvider;
    this.url = url;
    this.headers = headers;
    this.keepAliveInterval = keepAliveInterval;
    // Make the jitter range to be 0.9 to 1.1 of the reconnection interval.
    this.reconnectionIntervalMillisMin = Math.floor(
      reconnectionIntervalMillis * 0.9,
    );
    this.reconnectionIntervalMillisRange =
      Math.ceil(reconnectionIntervalMillis * 1.1) -
      this.reconnectionIntervalMillisMin;
  }

  /**
   * Connect to the stream and listen for updates.
   * Autonmatically handles keep alive packets and reconnection after a long period of time.
   * Whenever there's an error, the stream is closed, then onError callback is called.
   * @param onUpdate If onUpdate is provided, it will be called with the data received from the stream with DEFAULT_EVENT_TYPE.
   * @param onEventTypeUpdate A mapping from event type to callbacks. Routes the event data for different event types received from the stream to different callbacks.
   * @param onError If onError is provided, it will be called with the error received from the stream.
   */
  connect(
    onUpdate: (data: string) => void,
    onError?: (error: Error) => void,
  ): void;
  connect(
    onEventTypeUpdate: Record<string, (data: string) => void>,
    onError?: (error: Error) => void,
  ): void;
  connect(
    onUpdateCb:
      | ((data: string) => void)
      | Record<string, (data: string) => void>,
    onError?: (error: Error) => void,
  ): void {
    if (typeof onUpdateCb === 'function') {
      // onUpdate: (data: string) => void,
      this.onEventTypeUpdate = { [DEFAULT_EVENT_TYPE]: onUpdateCb };
    } else {
      // onEventTypeUpdate: Record<string, (data: string) => void>,
      this.onEventTypeUpdate = onUpdateCb as Record<
        string,
        (data: string) => void
      >;
      if (!(DEFAULT_EVENT_TYPE in this.onEventTypeUpdate)) {
        // Ensure there's always a default to receive keep alive data.
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        this.onEventTypeUpdate[DEFAULT_EVENT_TYPE] = () => {};
      }
    }
    this.onError = onError;
    if (this.es) {
      this.close();
    }

    this.es = this.streamProvider(this.url, this.headers);
    for (const eventType in this.onEventTypeUpdate) {
      this.es.addEventListener(eventType, (event) => {
        this.resetKeepAlive();
        const msgEvent = event as MessageEvent;
        if (msgEvent.data === KEEP_ALIVE_DATA) {
          // This is a keep-alive message, ignore it
          return;
        }
        try {
          this.onEventTypeUpdate[eventType](msgEvent.data);
        } catch {
          // Don't care about errors in the callback.
        }
      });
    }
    this.es.addEventListener('error', (err) => {
      this.close();
      const error = err as ErrorEvent;
      const newError = error.status
        ? new FetchError(error.status, error.message)
        : new Error(`Error in stream: ${JSON.stringify(error)}`);
      try {
        this.onError?.(newError);
      } catch {
        // Don't care about errors in the callback.
      }
    });
    this.resetKeepAlive();
    this.setReconnectionTimeout();
  }

  resetKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearTimeout(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
    if (this.es) {
      this.keepAliveTimer = setTimeout(() => {
        this.close();
        this.onError?.(Error('Keep-alive timeout'));
      }, this.keepAliveInterval * 1.1);
    }
  }

  setReconnectionTimeout(): void {
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = undefined;
    }
    if (this.es) {
      if (
        this.reconnectionIntervalMillisMin > 0 &&
        this.reconnectionIntervalMillisRange > 0
      ) {
        this.reconnectionTimeout = setTimeout(() => {
          this.connect(this.onEventTypeUpdate, this.onError);
        }, Math.ceil(Math.random() * this.reconnectionIntervalMillisRange + this.reconnectionIntervalMillisMin));
      }
    }
  }

  close(): void {
    if (this.keepAliveTimer) {
      clearTimeout(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = undefined;
    }
    this.es?.close();
    this.es = undefined;
  }
}
