import { getGlobalScope } from '@amplitude/experiment-core';

import { whenBodyReady } from '../util/when-body-ready';

import {
  RELAY_READY_MESSAGE,
  RELAY_RPC_TIMEOUT_MS,
  RelayEventRecord,
  RelayEventStorage,
  RelayRequest,
  RelayResponse,
} from './relay-protocol';

export function getRelayUrl(
  apiKey: string,
  serverZone?: string,
  relayUrl?: string,
): string {
  // relayUrl overrides only the origin; the canonical /script/{apiKey}.relay.html
  // path is preserved so a local/staging host serves the same way the CDN does.
  if (relayUrl) {
    return `${relayUrl.replace(/\/+$/, '')}/script/${apiKey}.relay.html`;
  }
  const cdnHost =
    serverZone === 'EU' ? 'cdn.eu.amplitude.com' : 'cdn.amplitude.com';
  return `https://${cdnHost}/script/${apiKey}.relay.html`;
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

function isSameRelayEvent(a: RelayEventRecord, b: RelayEventRecord): boolean {
  return (
    a.id === b.id &&
    a.event_type === b.event_type &&
    a.timestamp === b.timestamp
  );
}

// Handle returned by the resolved global scope's setTimeout (number in the
// browser, NodeJS.Timeout under the test runner) — derived from getGlobalScope
// so it matches whichever timer implementation we actually call.
type RelayTimerId = ReturnType<
  NonNullable<ReturnType<typeof getGlobalScope>>['setTimeout']
>;

export class RelayClient {
  private iframe: HTMLIFrameElement | null = null;
  private iframeWindow: Window | null = null;
  private relayOrigin = '';
  private available = false;
  private pendingWrites: RelayEventRecord[] = [];
  private readonly pendingRequests = new Map<
    string,
    {
      resolve: (response: RelayResponse) => void;
      reject: (error: Error) => void;
      timeoutId: RelayTimerId | undefined;
    }
  >();

  private messageListener: ((event: MessageEvent) => void) | null = null;
  private initPromise: Promise<void> | null = null;
  private initTimeoutId: RelayTimerId | null = null;
  private initResolve: (() => void) | null = null;
  private cancelBodyReadyPoll: (() => void) | null = null;
  private destroyed = false;
  private availablePromise: Promise<void> | null = null;
  private resolveAvailable: (() => void) | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly webExpIdV2: string,
    private readonly relayUrl: string,
  ) {
    this.relayOrigin = new URL(relayUrl).origin;
  }

  private createRelayRequest(
    type: RelayRequest['type'],
    payload?: unknown,
  ): RelayRequest {
    return {
      type,
      requestId: createRequestId(),
      apiKey: this.apiKey,
      web_exp_id_v2: this.webExpIdV2,
      payload,
    };
  }

  get relayAvailable(): boolean {
    return this.available;
  }

  private notifyAvailable(): void {
    this.resolveAvailable?.();
    this.resolveAvailable = null;
    this.availablePromise = null;
  }

  /**
   * Resolves when the relay becomes available, or after timeout.
   * Use after init() when the init timer may have fired before RELAY_READY.
   */
  waitForAvailable(timeoutMs = RELAY_RPC_TIMEOUT_MS): Promise<boolean> {
    if (this.destroyed) {
      return Promise.resolve(false);
    }
    if (this.available) {
      return Promise.resolve(true);
    }

    if (!this.availablePromise) {
      this.availablePromise = new Promise<void>((resolve) => {
        this.resolveAvailable = resolve;
      });
    }
    const becameAvailable = this.availablePromise;
    const globalScope = getGlobalScope();

    return new Promise((resolve) => {
      const settle = () => resolve(this.available && !this.destroyed);
      const timeoutId = globalScope?.setTimeout(settle, timeoutMs);
      void becameAvailable.then(() => {
        globalScope?.clearTimeout(timeoutId);
        settle();
      });
    });
  }

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    const globalScope = getGlobalScope();

    // Reset transient state so a re-init never inherits a stale listener,
    // iframe window, or availability flag from a prior lifecycle.
    this.destroyed = false;
    this.available = false;
    this.iframeWindow = null;
    if (this.messageListener) {
      globalScope?.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }

    this.initPromise = new Promise((resolve) => {
      this.initResolve = resolve;

      const finishInit = () => {
        if (!this.initResolve) {
          return;
        }
        if (this.initTimeoutId !== null) {
          globalScope?.clearTimeout(this.initTimeoutId);
          this.initTimeoutId = null;
        }
        this.initResolve = null;
        resolve();
      };

      this.initTimeoutId =
        globalScope?.setTimeout(() => {
          this.initTimeoutId = null;
          finishInit();
        }, RELAY_RPC_TIMEOUT_MS) ?? null;

      this.cancelBodyReadyPoll?.();
      this.cancelBodyReadyPoll = whenBodyReady(() => {
        if (this.destroyed || this.iframe) {
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
          if (this.destroyed) {
            return;
          }
          if (event.origin !== this.relayOrigin) {
            return;
          }
          if (event.source !== iframe.contentWindow) {
            return;
          }

          if (!this.available && isRelayReadyMessage(event.data)) {
            this.iframeWindow = iframe.contentWindow;
            this.available = true;
            this.flush();
            this.notifyAvailable();
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
          globalScope?.clearTimeout(pending.timeoutId);
          pending.resolve(response);
        };

        globalScope?.addEventListener('message', onMessage);
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

      const timeoutId = getGlobalScope()?.setTimeout(() => {
        if (!this.pendingRequests.has(request.requestId)) {
          return;
        }
        this.pendingRequests.delete(request.requestId);
        reject(new Error('relay rpc timeout'));
      }, RELAY_RPC_TIMEOUT_MS);

      this.pendingRequests.set(request.requestId, {
        resolve,
        reject,
        timeoutId,
      });
      this.iframeWindow.postMessage(request, this.relayOrigin);
    });
  }

  async readEvents(): Promise<RelayEventStorage> {
    const response = await this.sendRequest(
      this.createRelayRequest('READ_EVENTS'),
    );
    if (!response.ok) {
      throw new Error(response.error ?? 'read events failed');
    }
    return (response.payload as RelayEventStorage) ?? { events: [], nextId: 1 };
  }

  writeEvent(event: RelayEventRecord): void {
    if (this.destroyed) {
      return;
    }

    const alreadyQueued = this.pendingWrites.some((queued) =>
      isSameRelayEvent(queued, event),
    );
    if (!alreadyQueued) {
      this.pendingWrites.push(event);
    }
    this.sendPendingWrite(event);
  }

  private removeConfirmedWrite(event: RelayEventRecord): void {
    const idx = this.pendingWrites.findIndex((queued) =>
      isSameRelayEvent(queued, event),
    );
    if (idx !== -1) {
      this.pendingWrites.splice(idx, 1);
    }
  }

  private sendPendingWrite(event: RelayEventRecord): void {
    if (!this.available || !this.iframeWindow) {
      return;
    }

    void this.sendRequest(this.createRelayRequest('WRITE_EVENT', { event }))
      .then((response) => {
        if (response.ok) {
          this.removeConfirmedWrite(event);
        }
      })
      .catch(() => {
        // Keep in pendingWrites for a later flush()
      });
  }

  flush(): void {
    if (!this.available || !this.iframeWindow) {
      return;
    }
    for (const event of [...this.pendingWrites]) {
      this.sendPendingWrite(event);
    }
  }

  async checkMigrated(origin: string): Promise<boolean> {
    const response = await this.sendRequest(
      this.createRelayRequest('CHECK_MIGRATED', { sourceOrigin: origin }),
    );
    if (!response.ok) {
      throw new Error(response.error ?? 'check migrated failed');
    }
    return Boolean((response.payload as { migrated?: boolean })?.migrated);
  }

  async migrateEvents(origin: string, store: RelayEventStorage): Promise<void> {
    const response = await this.sendRequest(
      this.createRelayRequest('MIGRATE_EVENTS', {
        sourceOrigin: origin,
        store,
      }),
    );
    if (!response.ok) {
      throw new Error(response.error ?? 'migrate events failed');
    }
  }

  destroy(): void {
    const globalScope = getGlobalScope();
    this.destroyed = true;
    this.cancelBodyReadyPoll?.();
    this.cancelBodyReadyPoll = null;
    if (this.initTimeoutId !== null) {
      globalScope?.clearTimeout(this.initTimeoutId);
      this.initTimeoutId = null;
    }
    if (this.initResolve) {
      this.initResolve();
      this.initResolve = null;
    }
    if (this.messageListener) {
      globalScope?.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
    for (const pending of this.pendingRequests.values()) {
      globalScope?.clearTimeout(pending.timeoutId);
      pending.reject(new Error('relay destroyed'));
    }
    this.pendingRequests.clear();
    this.notifyAvailable();
    this.iframe?.remove();
    this.iframe = null;
    this.iframeWindow = null;
    this.available = false;
    this.pendingWrites = [];
    this.initPromise = null;
  }
}
