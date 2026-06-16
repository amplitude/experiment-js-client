import { whenBodyReady } from '../util/when-body-ready';

import {
  RELAY_READY_MESSAGE,
  RELAY_RPC_TIMEOUT_MS,
  RelayEventRecord,
  RelayEventStorage,
  RelayRequest,
  RelayResponse,
} from './relay-protocol';

export function getRelayUrl(apiKey: string, dev = false): string {
  if (dev) {
    return `http://localhost:3036/script/${apiKey}.relay.html`;
  }
  return `https://cdn.amplitude.com/script/${apiKey}.relay.html`;
}

function isRelayReadyMessage(data: unknown): boolean {
  if (data === RELAY_READY_MESSAGE) {
    return true;
  }
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: string }).type === RELAY_READY_MESSAGE
  );
}

function createRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class RelayClient {
  private iframe: HTMLIFrameElement | null = null;
  private iframeWindow: Window | null = null;
  private relayOrigin = '';
  private ready = false;
  private available = false;
  private pendingWrites: RelayEventRecord[] = [];
  private readonly pendingRequests = new Map<
    string,
    {
      resolve: (response: RelayResponse) => void;
      reject: (error: Error) => void;
    }
  >();

  private messageListener: ((event: MessageEvent) => void) | null = null;
  private initPromise: Promise<void> | null = null;
  private initTimeoutId: number | null = null;
  private initResolve: (() => void) | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly relayUrl: string,
  ) {
    this.relayOrigin = new URL(relayUrl).origin;
  }

  get relayAvailable(): boolean {
    return this.available;
  }

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve) => {
      this.initResolve = resolve;

      const finishInit = () => {
        if (!this.initResolve) {
          return;
        }
        if (this.initTimeoutId !== null) {
          window.clearTimeout(this.initTimeoutId);
          this.initTimeoutId = null;
        }
        this.initResolve = null;
        this.ready = true;
        resolve();
      };

      this.initTimeoutId = window.setTimeout(() => {
        this.initTimeoutId = null;
        finishInit();
      }, RELAY_RPC_TIMEOUT_MS);

      whenBodyReady(() => {
        if (!this.initResolve) {
          return;
        }
        if (!document.body) {
          return;
        }

        const iframe = document.createElement('iframe');
        iframe.src = this.relayUrl;
        iframe.style.display = 'none';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);
        this.iframe = iframe;

        const onMessage = (event: MessageEvent) => {
          if (event.origin !== this.relayOrigin) {
            return;
          }

          if (!this.available && isRelayReadyMessage(event.data)) {
            this.iframeWindow = iframe.contentWindow;
            this.available = true;
            this.flush();
            finishInit();
            return;
          }

          const response = event.data as RelayResponse;
          if (!response?.requestId) {
            return;
          }
          const pending = this.pendingRequests.get(response.requestId);
          if (!pending) {
            return;
          }
          this.pendingRequests.delete(response.requestId);
          pending.resolve(response);
        };

        window.addEventListener('message', onMessage);
        this.messageListener = onMessage;
      });
    });

    return this.initPromise;
  }

  private sendRequest(request: RelayRequest): Promise<RelayResponse> {
    return new Promise((resolve, reject) => {
      if (!this.available || !this.iframeWindow) {
        reject(new Error('relay unavailable'));
        return;
      }

      this.pendingRequests.set(request.requestId, { resolve, reject });
      this.iframeWindow.postMessage(request, this.relayOrigin);

      window.setTimeout(() => {
        if (!this.pendingRequests.has(request.requestId)) {
          return;
        }
        this.pendingRequests.delete(request.requestId);
        reject(new Error('relay rpc timeout'));
      }, RELAY_RPC_TIMEOUT_MS);
    });
  }

  async readEvents(): Promise<RelayEventStorage> {
    const response = await this.sendRequest({
      type: 'READ_EVENTS',
      requestId: createRequestId(),
      apiKey: this.apiKey,
    });
    if (!response.ok) {
      throw new Error(response.error ?? 'read events failed');
    }
    return (response.payload as RelayEventStorage) ?? { events: [], nextId: 1 };
  }

  writeEvent(event: RelayEventRecord): void {
    if (!this.available || !this.iframeWindow) {
      this.pendingWrites.push(event);
      return;
    }
    void this.sendRequest({
      type: 'WRITE_EVENT',
      requestId: createRequestId(),
      apiKey: this.apiKey,
      payload: { event },
    }).catch(() => {
      // fire-and-forget
    });
  }

  flush(): void {
    if (!this.available || !this.iframeWindow) {
      return;
    }
    const writes = [...this.pendingWrites];
    this.pendingWrites = [];
    for (const event of writes) {
      this.iframeWindow.postMessage(
        {
          type: 'WRITE_EVENT',
          requestId: createRequestId(),
          apiKey: this.apiKey,
          payload: { event },
        } satisfies RelayRequest,
        this.relayOrigin,
      );
    }
  }

  async checkMigrated(origin: string): Promise<boolean> {
    const response = await this.sendRequest({
      type: 'CHECK_MIGRATED',
      requestId: createRequestId(),
      apiKey: this.apiKey,
      payload: { sourceOrigin: origin },
    });
    if (!response.ok) {
      throw new Error(response.error ?? 'check migrated failed');
    }
    return Boolean((response.payload as { migrated?: boolean })?.migrated);
  }

  async migrateEvents(origin: string, store: RelayEventStorage): Promise<void> {
    const response = await this.sendRequest({
      type: 'MIGRATE_EVENTS',
      requestId: createRequestId(),
      apiKey: this.apiKey,
      payload: { sourceOrigin: origin, store },
    });
    if (!response.ok) {
      throw new Error(response.error ?? 'migrate events failed');
    }
  }

  destroy(): void {
    if (this.initTimeoutId !== null) {
      window.clearTimeout(this.initTimeoutId);
      this.initTimeoutId = null;
    }
    if (this.initResolve) {
      this.initResolve();
      this.initResolve = null;
    }
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
    this.iframe?.remove();
    this.iframe = null;
    this.iframeWindow = null;
    this.available = false;
    this.ready = false;
    this.initPromise = null;
  }
}
