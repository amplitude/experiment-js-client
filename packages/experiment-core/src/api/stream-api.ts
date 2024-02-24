/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable no-console */
import {
  StreamEventSource,
  StreamEventSourceClass,
  StreamErrorEvent,
  StreamMessageEvent,
} from '../transport/stream';

const DEFAULT_INITIAL_CONN_TIMEOUT = 1000;
const MAX_CONN_MS_MIN = 12 * 60 * 1000;
const MAX_CONN_MS_MAX = 18 * 60 * 1000;
const KEEP_ALIVE_INTERVAL = (15 + 2) * 1000; // 15 seconds plus 2 seconds grace period.
const KEEP_ALIVE_DATA = ' ';

export type StreamOptions = {
  libraryName: string;
  libraryVersion: string;
  streamConnTimeoutMillis?: number; // Timeout for connecting the stream. Aka, http connection timeout.
};
export type StreamOnUpdateCallback = (data: string) => void;
export type StreamOnErrorCallback = (err: StreamErrorEvent) => void;

export interface StreamApi {
  connect(options?: StreamOptions): void;
  close(): void;
  onUpdate?: StreamOnUpdateCallback;
  onError?: StreamOnErrorCallback;
}

export class SdkStreamApi implements StreamApi {
  private readonly eventSourceClass: StreamEventSourceClass;
  private readonly deploymentKey: string;
  private readonly serverUrl: string;
  private eventSource: StreamEventSource | undefined;
  private reconnectionTimeout?: NodeJS.Timeout;
  private initConnTimeout?: NodeJS.Timeout;
  private keepAliveTimeout?: NodeJS.Timeout;
  public onUpdate?: StreamOnUpdateCallback;
  public onError?: StreamOnErrorCallback;

  constructor(
    deploymentKey: string,
    serverUrl: string,
    eventSourceClass: StreamEventSourceClass,
    onUpdate?: StreamOnUpdateCallback,
    onError?: StreamOnErrorCallback,
  ) {
    this.deploymentKey = deploymentKey;
    this.serverUrl = serverUrl;
    this.eventSourceClass = eventSourceClass;
    if (onUpdate) {
      this.onUpdate = onUpdate;
    }
    if (onError) {
      this.onError = onError;
    }
  }

  public async connect(options?: StreamOptions) {
    if (this.eventSource) {
      return;
    }
    console.log('connect');

    const headers: Record<string, string> = {
      Authorization: `Api-Key ${this.deploymentKey}`,
    };
    if (options?.libraryName && options?.libraryVersion) {
      headers[
        'X-Amp-Exp-Library'
      ] = `${options.libraryName}/${options.libraryVersion}`;
    }

    // Create connection.
    const es = new this.eventSourceClass(this.serverUrl, {
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
      this.reconnectionTimeout = setTimeout(async () => {
        if (es.readyState == this.eventSourceClass.OPEN) {
          // The es is being checked, not this.eventSource. So it won't affect new connections.
          await this.close();
          this.connect();
        }
      }, randomReconnectionTimeout);

      // Set keep alive checks.
      this.setKeepAliveExpiry();
    };

    // Timeout initial connection, ensures promise returns.
    // Force close after timeout only if stream is still connecting.
    // Error state should already handled by error handler.

    this.initConnTimeout = setTimeout(() => {
      es.readyState == this.eventSourceClass.CONNECTING && // The es is being checked, not this.eventSource. So it won't affect new connections.
        this.error({ message: 'timeout' });
    }, options?.streamConnTimeoutMillis ?? DEFAULT_INITIAL_CONN_TIMEOUT);
  }

  public async close() {
    console.log('close');
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
    console.log('error', err);
    await this.close();
    if (this.onError) {
      this.onError(err);
    }
  }

  private async handleNewMsg(response: StreamMessageEvent) {
    if (!response.data) {
      return;
    }
    console.log('new message');
    this.setKeepAliveExpiry(); // Reset keep alive as there is data.
    if (response.data == KEEP_ALIVE_DATA) {
      // Data solely for keep alive. Don't pass on to client.
      return;
    }
    if (this.onUpdate) {
      this.onUpdate(response.data);
    }
  }

  private setKeepAliveExpiry() {
    if (this.keepAliveTimeout) {
      clearTimeout(this.keepAliveTimeout);
      this.keepAliveTimeout = undefined;
    }
    if (this.eventSource) {
      this.keepAliveTimeout = setTimeout(() => {
        console.log('keep alive fail');
        this.error({ message: 'keep alive fail' });
      }, KEEP_ALIVE_INTERVAL);
    }
  }
}
