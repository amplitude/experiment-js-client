import {
  RelayClient,
  getRelayUrl,
} from 'src/behavioral-targeting/relay-client';
import {
  RELAY_READY_MESSAGE,
  RELAY_RPC_TIMEOUT_MS,
  RelayEventRecord,
} from 'src/behavioral-targeting/relay-protocol';

const API_KEY = 'api-key';
const WEB_EXP_ID_V2 = 'oeu1383080393924r0-5047421827912331';
const RELAY_URL = getRelayUrl(API_KEY);
const RELAY_ORIGIN = 'https://cdn.amplitude.com';

describe('RelayClient', () => {
  let clients: RelayClient[] = [];

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
    clients = [];
  });

  afterEach(() => {
    for (const client of clients) {
      client.destroy();
    }
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const sampleEvent = (
    id: number,
    properties: Record<string, unknown> = {},
  ): RelayEventRecord => ({
    id,
    event_type: 'page_view',
    timestamp: 100,
    session_id: 's1',
    properties,
  });

  const setupClient = (relayUrl = RELAY_URL) => {
    const postMessage = jest.fn(
      (payload: { requestId?: string; type?: string }) => {
        if (payload.requestId) {
          let responsePayload: unknown;
          if (payload.type === 'READ_EVENTS') {
            responsePayload = {
              events: [sampleEvent(1)],
              nextId: 2,
            };
          } else if (payload.type === 'CHECK_MIGRATED') {
            responsePayload = { migrated: true };
          }

          window.dispatchEvent(
            new MessageEvent('message', {
              data: {
                requestId: payload.requestId,
                ok: true,
                payload: responsePayload,
              },
              source: iframeWindow as unknown as MessageEventSource,
              origin: RELAY_ORIGIN,
            }),
          );
        }
      },
    );
    const iframeWindow = { postMessage };
    const client = new RelayClient(API_KEY, WEB_EXP_ID_V2, relayUrl);
    clients.push(client);
    return { client, iframeWindow, postMessage };
  };

  const signalRelayReady = (iframeWindow: { postMessage: jest.Mock }) => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: iframeWindow,
      configurable: true,
    });
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: RELAY_READY_MESSAGE },
        source: iframeWindow as unknown as MessageEventSource,
        origin: RELAY_ORIGIN,
      }),
    );
  };

  const initReady = async (
    client: RelayClient,
    iframeWindow: { postMessage: jest.Mock },
  ) => {
    const initPromise = client.init();
    signalRelayReady(iframeWindow);
    await initPromise;
  };

  const expectNoWrite = (postMessage: jest.Mock, id: number) => {
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'WRITE_EVENT',
        payload: { event: expect.objectContaining({ id }) },
      }),
    );
  };

  const withDeferredBody = async (
    run: (ctx: {
      flushRaf: () => void;
      makeBodyAvailable: () => void;
      rafSpy: jest.SpyInstance;
    }) => Promise<void>,
  ) => {
    const originalBody = document.body;
    const bodyDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'body',
    );
    Object.defineProperty(document, 'body', {
      configurable: true,
      get: () => null,
    });

    const rafCallbacks: FrameRequestCallback[] = [];
    const rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });

    const restore = () => {
      rafSpy.mockRestore();
      Object.defineProperty(document, 'body', {
        configurable: true,
        value: originalBody,
      });
      if (bodyDescriptor) {
        Object.defineProperty(Document.prototype, 'body', bodyDescriptor);
      }
    };

    try {
      await run({
        flushRaf: () => {
          rafCallbacks.shift()?.(0);
        },
        makeBodyAvailable: () => {
          Object.defineProperty(document, 'body', {
            configurable: true,
            get: () => originalBody,
          });
        },
        rafSpy,
      });
    } finally {
      restore();
    }
  };

  test('injects iframe and marks relay available after ready message', async () => {
    const { client, iframeWindow } = setupClient();
    await initReady(client, iframeWindow);

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(client.relayAvailable).toBe(true);
    expect(iframe.style.display).toBe('none');
  });

  test('times out init without throwing when relay is unavailable', async () => {
    const { client } = setupClient();
    const initPromise = client.init();

    jest.advanceTimersByTime(RELAY_RPC_TIMEOUT_MS + 1);
    await initPromise;

    expect(client.relayAvailable).toBe(false);
  });

  test('queues writes and flushes pending events when relay becomes ready', async () => {
    const { client, iframeWindow, postMessage } = setupClient();
    client.writeEvent(sampleEvent(1, { page: 'home' }));

    await initReady(client, iframeWindow);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'WRITE_EVENT',
        apiKey: API_KEY,
        web_exp_id_v2: WEB_EXP_ID_V2,
      }),
      RELAY_ORIGIN,
    );
  });

  test('does not enqueue duplicate pending writes for the same event', async () => {
    const { client, iframeWindow, postMessage } = setupClient();
    await initReady(client, iframeWindow);

    const event = sampleEvent(1, { page: 'home' });
    client.writeEvent(event);
    client.writeEvent(event);
    client.flush();

    const writeCalls = postMessage.mock.calls.filter(
      ([payload]) => payload.type === 'WRITE_EVENT',
    );
    expect(writeCalls).toHaveLength(3);
  });

  test('does not double-send writes when relay is available', async () => {
    const { client, iframeWindow, postMessage } = setupClient();
    await initReady(client, iframeWindow);

    client.writeEvent(sampleEvent(1, { page: 'home' }));
    await Promise.resolve();
    client.flush();

    const writeCalls = postMessage.mock.calls.filter(
      ([payload]) => payload.type === 'WRITE_EVENT',
    );
    expect(writeCalls).toHaveLength(1);
  });

  test('flush includes in-flight writes not yet confirmed', async () => {
    const { client, iframeWindow, postMessage } = setupClient();
    await initReady(client, iframeWindow);

    client.writeEvent(sampleEvent(1, { page: 'home' }));
    client.flush();

    const writeCalls = postMessage.mock.calls.filter(
      ([payload]) => payload.type === 'WRITE_EVENT',
    );
    expect(writeCalls).toHaveLength(2);
  });

  test('removes queued entry when logically duplicate write confirms', async () => {
    const pendingWriteResponses: string[] = [];
    const postMessage = jest.fn(
      (payload: { requestId?: string; type?: string }) => {
        if (payload.requestId && payload.type === 'WRITE_EVENT') {
          pendingWriteResponses.push(payload.requestId);
          return;
        }
        if (payload.requestId) {
          window.dispatchEvent(
            new MessageEvent('message', {
              data: {
                requestId: payload.requestId,
                ok: true,
              },
              source: iframeWindow as unknown as MessageEventSource,
              origin: RELAY_ORIGIN,
            }),
          );
        }
      },
    );
    const iframeWindow = { postMessage };
    const client = new RelayClient(API_KEY, WEB_EXP_ID_V2, RELAY_URL);
    clients.push(client);
    await initReady(client, iframeWindow);
    postMessage.mockClear();
    pendingWriteResponses.length = 0;

    const event = sampleEvent(7);
    client.writeEvent(event);
    client.writeEvent({ ...event, properties: { ...event.properties } });
    expect(pendingWriteResponses).toHaveLength(2);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          requestId: pendingWriteResponses[1],
          ok: true,
        },
        source: iframeWindow as unknown as MessageEventSource,
        origin: RELAY_ORIGIN,
      }),
    );
    await Promise.resolve();

    postMessage.mockClear();
    client.flush();

    const writeCalls = postMessage.mock.calls.filter(
      ([payload]) => payload.type === 'WRITE_EVENT',
    );
    expect(writeCalls).toHaveLength(0);
  });

  test('keeps failed write in pending queue for flush retry', async () => {
    const postMessage = jest.fn(
      (payload: { requestId?: string; type?: string }) => {
        if (payload.requestId && payload.type === 'WRITE_EVENT') {
          window.dispatchEvent(
            new MessageEvent('message', {
              data: {
                requestId: payload.requestId,
                ok: false,
                error: 'write rejected',
              },
              source: iframeWindow as unknown as MessageEventSource,
              origin: RELAY_ORIGIN,
            }),
          );
        }
      },
    );
    const iframeWindow = { postMessage };
    const client = new RelayClient(API_KEY, WEB_EXP_ID_V2, RELAY_URL);
    clients.push(client);
    await initReady(client, iframeWindow);

    client.writeEvent(sampleEvent(1, { page: 'home' }));
    await Promise.resolve();

    const writeCallsBeforeFlush = postMessage.mock.calls.filter(
      ([payload]) => payload.type === 'WRITE_EVENT',
    );
    expect(writeCallsBeforeFlush).toHaveLength(1);

    client.flush();

    const writeCalls = postMessage.mock.calls.filter(
      ([payload]) => payload.type === 'WRITE_EVENT',
    );
    expect(writeCalls).toHaveLength(2);
  });

  test('concurrent init creates only one iframe', async () => {
    const { client, iframeWindow } = setupClient();
    const first = client.init();
    const second = client.init();

    signalRelayReady(iframeWindow);
    await Promise.all([first, second]);

    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  test('accepts late ready after init timeout', async () => {
    const { client, iframeWindow } = setupClient();
    const initPromise = client.init();

    jest.advanceTimersByTime(RELAY_RPC_TIMEOUT_MS + 1);
    await initPromise;
    expect(client.relayAvailable).toBe(false);

    signalRelayReady(iframeWindow);
    expect(client.relayAvailable).toBe(true);
  });

  test('waitForAvailable resolves after late ready', async () => {
    const { client, iframeWindow } = setupClient();
    const initPromise = client.init();

    jest.advanceTimersByTime(RELAY_RPC_TIMEOUT_MS + 1);
    await initPromise;

    const waitPromise = client.waitForAvailable();
    signalRelayReady(iframeWindow);
    await expect(waitPromise).resolves.toBe(true);
  });

  test('destroy settles waitForAvailable without waiting for timeout', async () => {
    const { client } = setupClient();
    const initPromise = client.init();

    jest.advanceTimersByTime(RELAY_RPC_TIMEOUT_MS + 1);
    await initPromise;

    const waitPromise = client.waitForAvailable(60_000);
    client.destroy();

    await expect(waitPromise).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('destroy during init allows re-init on same instance', async () => {
    const { client, iframeWindow } = setupClient();
    const initPromise = client.init();

    client.destroy();
    await initPromise;

    await initReady(client, iframeWindow);

    expect(client.relayAvailable).toBe(true);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  test('destroy rejects in-flight rpc requests', async () => {
    const postMessage = jest.fn();
    const iframeWindow = { postMessage };
    const client = new RelayClient(API_KEY, WEB_EXP_ID_V2, RELAY_URL);
    clients.push(client);
    await initReady(client, iframeWindow);

    const readPromise = client.readEvents();
    expect(postMessage).toHaveBeenCalled();
    client.destroy();

    await expect(readPromise).rejects.toThrow('relay destroyed');
  });

  describe('destroy write handling', () => {
    test('clears writes queued before destroy', async () => {
      const { client, iframeWindow, postMessage } = setupClient();
      client.writeEvent(sampleEvent(42));

      const initPromise = client.init();
      client.destroy();
      await initPromise;

      await initReady(client, iframeWindow);
      expectNoWrite(postMessage, 42);
    });

    test('drops writes after destroy', async () => {
      const { client, iframeWindow, postMessage } = setupClient();
      await initReady(client, iframeWindow);
      postMessage.mockClear();

      client.destroy();
      client.writeEvent(sampleEvent(99));

      await initReady(client, iframeWindow);
      expectNoWrite(postMessage, 99);
    });
  });

  test('destroy cancels body poll before body is available', async () => {
    await withDeferredBody(async ({ flushRaf, rafSpy }) => {
      const { client } = setupClient();
      client.init();
      flushRaf();
      expect(rafSpy).toHaveBeenCalledTimes(2);

      client.destroy();
      flushRaf();
      expect(rafSpy).toHaveBeenCalledTimes(2);
    });
  });

  test('defers iframe injection until document.body is available', async () => {
    await withDeferredBody(async ({ flushRaf, makeBodyAvailable }) => {
      const { client, iframeWindow } = setupClient();
      const initPromise = client.init();
      expect(document.querySelector('iframe')).toBeNull();

      makeBodyAvailable();
      flushRaf();
      await Promise.resolve();

      signalRelayReady(iframeWindow);
      await initPromise;

      expect(document.querySelector('iframe')).not.toBeNull();
      expect(client.relayAvailable).toBe(true);
    });
  });

  test('times out init when document.body never appears', async () => {
    await withDeferredBody(async () => {
      const { client } = setupClient();
      const initPromise = client.init();

      jest.advanceTimersByTime(RELAY_RPC_TIMEOUT_MS + 1);
      await initPromise;

      expect(client.relayAvailable).toBe(false);
      expect(document.querySelector('iframe')).toBeNull();
    });
  });

  test('does not throw when body is still null in whenBodyReady callback', async () => {
    const originalBody = document.body;
    Object.defineProperty(document, 'body', {
      configurable: true,
      get: () => null,
    });

    const originalRaf = window.requestAnimationFrame;
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: undefined,
    });

    try {
      const { client } = setupClient();
      const initPromise = client.init();

      jest.advanceTimersByTime(RELAY_RPC_TIMEOUT_MS + 1);
      await expect(initPromise).resolves.toBeUndefined();
      expect(document.querySelector('iframe')).toBeNull();
    } finally {
      Object.defineProperty(document, 'body', {
        configurable: true,
        value: originalBody,
      });
      Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        value: originalRaf,
      });
    }
  });

  test('creates iframe when body appears after init timeout', async () => {
    await withDeferredBody(async ({ flushRaf, makeBodyAvailable }) => {
      const { client, iframeWindow } = setupClient();
      const initPromise = client.init();

      jest.advanceTimersByTime(RELAY_RPC_TIMEOUT_MS + 1);
      await initPromise;
      expect(client.relayAvailable).toBe(false);
      expect(document.querySelector('iframe')).toBeNull();

      makeBodyAvailable();
      flushRaf();
      await Promise.resolve();

      expect(document.querySelector('iframe')).not.toBeNull();
      signalRelayReady(iframeWindow);
      expect(client.relayAvailable).toBe(true);
    });
  });

  test('ignores ready messages from unrelated frames', async () => {
    const { client, iframeWindow } = setupClient();
    const initPromise = client.init();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: RELAY_READY_MESSAGE },
        source: window,
        origin: RELAY_ORIGIN,
      }),
    );
    expect(client.relayAvailable).toBe(false);

    signalRelayReady(iframeWindow);
    await initPromise;
    expect(client.relayAvailable).toBe(true);
  });

  test('supports rpc read/check/migrate requests', async () => {
    const { client, iframeWindow } = setupClient();
    await initReady(client, iframeWindow);

    const events = await client.readEvents();
    expect(events.events).toHaveLength(1);

    await expect(client.checkMigrated('https://www.acme.com')).resolves.toBe(
      true,
    );
    await expect(
      client.migrateEvents('https://www.acme.com', { events: [], nextId: 1 }),
    ).resolves.toBeUndefined();
  });
});

describe('getRelayUrl', () => {
  test('returns US production relay url by default', () => {
    expect(getRelayUrl('abc123')).toBe(
      'https://cdn.amplitude.com/script/abc123.relay.html',
    );
  });

  test('returns US production relay url for US server zone', () => {
    expect(getRelayUrl('abc123', 'US')).toBe(
      'https://cdn.amplitude.com/script/abc123.relay.html',
    );
  });

  test('returns EU production relay url for EU server zone', () => {
    expect(getRelayUrl('abc123', 'EU')).toBe(
      'https://cdn.eu.amplitude.com/script/abc123.relay.html',
    );
  });
});
