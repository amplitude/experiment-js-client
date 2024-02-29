export type StreamErrorEvent = { message?: string; status?: number };
export type StreamOpenEvent = { type?: string };
export type StreamMessageEvent = { data?: string };
export type StreamEvent =
  | StreamErrorEvent
  | StreamOpenEvent
  | StreamMessageEvent;

/**
 * The EventSource client interface.
 * https://html.spec.whatwg.org/multipage/server-sent-events.html#eventsource
 */
export interface StreamEventSource {
  // These are static members usable without new.
  readonly CLOSED: number;
  readonly CONNECTING: number;
  readonly OPEN: number;

  readonly url: string;
  readonly readyState: number;
  readonly withCredentials: boolean;
  onopen: (evt: StreamOpenEvent) => unknown;
  onmessage: (evt: StreamMessageEvent) => unknown;
  onerror: (evt: StreamErrorEvent) => unknown;
  // The following are in specs but not currently used. Uncomment as we start to use them.
  //   addEventListener(type: string, listener: (evt: StreamEvent) => void): void;
  //   dispatchEvent(evt: Event): boolean;
  //   removeEventListener(type: string, listener: (evt: StreamEvent) => void): void;
  close(): void;
}

// A factory type for StreamEventSource.
export type StreamEventSourceFactory = (
  url: string,
  params: unknown,
) => StreamEventSource;

/**
 * Default error events.
 */
export const DEFAULT_STREAM_ERR_EVENTS = {
  TIMEOUT: { message: 'timeout' } as StreamErrorEvent,
  DATA_UNPARSABLE: {
    message: 'stream data parse error',
  } as StreamErrorEvent,
  KEEP_ALIVE_FAILURE: {
    message: 'keep alive fail',
  } as StreamErrorEvent,
};

export type StreamOptions = {
  libraryName: string;
  libraryVersion: string;
};
export type StreamOnUpdateCallback = (data: string) => unknown;
export type StreamOnErrorCallback = (err: StreamErrorEvent) => unknown;

export interface Stream {
  /**
   * Initiate a connection. If an existing connection exists, it does nothing.
   */
  connect(options?: StreamOptions): void;
  /**
   * Close a connection. If there is no existing connection, it does nothing.
   */
  close(): void;
  /**
   * Any message will be sent to this callback.
   */
  onUpdate?: StreamOnUpdateCallback;
  /**
   * Any error, including connection errors, will be sent to this callback.
   */
  onError?: StreamOnErrorCallback;
}

const DEFAULT_INITIAL_CONN_TIMEOUT = 1000; // Initial connection timeout.
const MAX_CONN_MS_MIN = 12 * 60 * 1000; // Min of max connection timeout and wants to automatically disconnect and reconnects.
const MAX_CONN_MS_MAX = 18 * 60 * 1000; // Max of the above timeout.
const KEEP_ALIVE_INTERVAL = (15 + 2) * 1000; // 15 seconds plus 2 seconds grace period. // 0 or neg value disables keep alive.
const KEEP_ALIVE_DATA = ' ';

/**
 * This class handles connecting to an server-side event source.
 * It handles keep alives from server, automatically disconnect and reconnect after a set random interval.
 * It will propagate any error to onError. It will not handle any error or retries.
 * (automatic disconnect does not count as error, but if any reconnect errors will propagate).
 */
export class SdkStream implements Stream {
  private eventSource: StreamEventSource | undefined;
  private reconnectionTimeout?: NodeJS.Timeout;
  private initConnTimeout?: NodeJS.Timeout;
  private keepAliveTimeout?: NodeJS.Timeout;

  public onUpdate?: StreamOnUpdateCallback;
  public onError?: StreamOnErrorCallback;

  private readonly deploymentKey: string;
  private readonly serverUrl: string;
  private readonly eventSourceFactory: StreamEventSourceFactory;
  private streamConnTimeoutMillis: number; // Timeout for connecting the stream. Aka, http connection timeout.

  constructor(
    deploymentKey: string,
    serverUrl: string,
    eventSourceFactory: StreamEventSourceFactory,
    streamConnTimeoutMillis: number = DEFAULT_INITIAL_CONN_TIMEOUT, // Timeout for connecting the stream. Aka, http connection timeout.
  ) {
    this.deploymentKey = deploymentKey;
    this.serverUrl = serverUrl;
    this.eventSourceFactory = eventSourceFactory;
    this.streamConnTimeoutMillis = streamConnTimeoutMillis;
  }

  public async connect(options?: StreamOptions) {
    if (this.eventSource) {
      return;
    }

    const headers: Record<string, string> = {
      Authorization: `Api-Key ${this.deploymentKey}`,
    };
    if (options?.libraryName && options?.libraryVersion) {
      headers[
        'X-Amp-Exp-Library'
      ] = `${options.libraryName}/${options.libraryVersion}`;
    }

    // Create connection. It starts connection on new.
    const es = this.eventSourceFactory(this.serverUrl, {
      headers: headers,
    });
    this.eventSource = es; // Set eventSource here so more connect should only creates one eventSource.

    // Handlers.
    es.onerror = (err) => err && this.error(err);
    es.onmessage = (evt) => this.handleNewMsg(evt);
    es.onopen = (evt) => {
      if (!evt || !evt?.type || evt.type != 'open') {
        return;
      }

      // Reconnect connections after certain amount of time.
      const randomReconnectionTimeout = Math.floor(
        Math.random() * (MAX_CONN_MS_MAX - MAX_CONN_MS_MIN) + MAX_CONN_MS_MIN,
      );
      if (this.reconnectionTimeout) {
        clearTimeout(this.reconnectionTimeout);
      }
      this.reconnectionTimeout = setTimeout(async () => {
        if (es.readyState == es.OPEN) {
          // The es is being checked, not this.eventSource. So it won't affect new connections.
          this.close();
          this.connect();
        }
      }, randomReconnectionTimeout);

      // Set keep alive checks.
      this.setKeepAliveExpiry();
    };

    // Timeout initial connection, ensures promise returns.
    // Force close after timeout only if stream is still connecting.
    // Error state should already handled by error handler.
    if (this.initConnTimeout) {
      clearTimeout(this.initConnTimeout);
    }
    this.initConnTimeout = setTimeout(() => {
      es.readyState == es.CONNECTING && // The es is being checked, not this.eventSource. So it won't affect new connections.
        this.error(DEFAULT_STREAM_ERR_EVENTS.TIMEOUT);
    }, this.streamConnTimeoutMillis);
  }

  public close() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }

    // Clear timers so program won't hang if want to terminate early.
    if (this.initConnTimeout) {
      clearTimeout(this.initConnTimeout);
      this.initConnTimeout = undefined;
    }
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = undefined;
    }
    if (this.keepAliveTimeout) {
      clearTimeout(this.keepAliveTimeout);
      this.keepAliveTimeout = undefined;
    }
  }

  private async error(err: StreamErrorEvent) {
    this.close();
    if (this.onError) {
      try {
        await this.onError(err);
        // eslint-disable-next-line no-empty
      } catch {} // Don't care about errors after handoff.
    }
  }

  private async handleNewMsg(response: StreamMessageEvent) {
    if (!response.data) {
      return;
    }
    this.setKeepAliveExpiry(); // Reset keep alive as there is data.
    if (response.data == KEEP_ALIVE_DATA) {
      // Data solely for keep alive. Don't pass on to client.
      return;
    }
    if (this.onUpdate) {
      try {
        await this.onUpdate(response.data);
        // eslint-disable-next-line no-empty
      } catch {} // Don't care about errors after handoff.
    }
  }

  private setKeepAliveExpiry() {
    if (this.keepAliveTimeout) {
      clearTimeout(this.keepAliveTimeout);
      this.keepAliveTimeout = undefined;
    }
    if (this.eventSource) {
      this.keepAliveTimeout = setTimeout(() => {
        this.error(DEFAULT_STREAM_ERR_EVENTS.KEEP_ALIVE_FAILURE);
      }, KEEP_ALIVE_INTERVAL);
    }
  }
}
