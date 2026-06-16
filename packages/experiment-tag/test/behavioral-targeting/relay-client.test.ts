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

  const setupClient = (relayUrl = RELAY_URL) => {
    const postMessage = jest.fn(
      (payload: { requestId?: string; type?: string }) => {
        if (payload.requestId) {
          let responsePayload: unknown;
          if (payload.type === 'READ_EVENTS') {
            responsePayload = {
              events: [
                {
                  id: 1,
                  event_type: 'page_view',
                  timestamp: 1,
                  session_id: 's1',
                  properties: {},
                },
              ],
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
              source: window,
              origin: RELAY_ORIGIN,
            }),
          );
        }
      },
    );
    const iframeWindow = { postMessage };
    const client = new RelayClient(API_KEY, relayUrl);
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
        source: window,
        origin: RELAY_ORIGIN,
      }),
    );
  };

  test('injects iframe and marks relay available after ready message', async () => {
    const { client, iframeWindow } = setupClient();
    const initPromise = client.init();

    signalRelayReady(iframeWindow);
    await initPromise;

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
    const pendingEvent: RelayEventRecord = {
      id: 1,
      event_type: 'page_view',
      timestamp: 100,
      session_id: 's1',
      properties: { page: 'home' },
    };
    client.writeEvent(pendingEvent);

    const initPromise = client.init();
    signalRelayReady(iframeWindow);
    await initPromise;

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'WRITE_EVENT',
        apiKey: API_KEY,
      }),
      RELAY_ORIGIN,
    );
  });

  test('does not double-send writes when relay is available', async () => {
    const { client, iframeWindow, postMessage } = setupClient();
    const initPromise = client.init();
    signalRelayReady(iframeWindow);
    await initPromise;

    const event: RelayEventRecord = {
      id: 1,
      event_type: 'page_view',
      timestamp: 100,
      session_id: 's1',
      properties: { page: 'home' },
    };
    client.writeEvent(event);
    client.flush();

    const writeCalls = postMessage.mock.calls.filter(
      ([payload]) => payload.type === 'WRITE_EVENT',
    );
    expect(writeCalls).toHaveLength(1);
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

  test('destroy during init allows re-init', async () => {
    const { client } = setupClient();
    const initPromise = client.init();

    client.destroy();
    await initPromise;

    const { client: client2, iframeWindow } = setupClient();
    const reinitPromise = client2.init();
    signalRelayReady(iframeWindow);
    await reinitPromise;

    expect(client2.relayAvailable).toBe(true);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  test('defers iframe injection until document.body is available', async () => {
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

    const { client, iframeWindow } = setupClient();
    const initPromise = client.init();
    expect(document.querySelector('iframe')).toBeNull();

    Object.defineProperty(document, 'body', {
      configurable: true,
      get: () => originalBody,
    });
    rafCallbacks.shift()?.(0);
    await Promise.resolve();

    signalRelayReady(iframeWindow);
    await initPromise;

    expect(document.querySelector('iframe')).not.toBeNull();

    rafSpy.mockRestore();
    if (bodyDescriptor) {
      Object.defineProperty(Document.prototype, 'body', bodyDescriptor);
    }
  });

  test('supports rpc read/check/migrate requests', async () => {
    const { client, iframeWindow } = setupClient();
    const initPromise = client.init();
    signalRelayReady(iframeWindow);
    await initPromise;

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
  test('returns local dev relay url', () => {
    expect(getRelayUrl('abc123', true)).toBe(
      'http://localhost:3036/script/abc123.relay.html',
    );
  });

  test('returns production relay url', () => {
    expect(getRelayUrl('abc123')).toBe(
      'https://cdn.amplitude.com/script/abc123.relay.html',
    );
  });
});
