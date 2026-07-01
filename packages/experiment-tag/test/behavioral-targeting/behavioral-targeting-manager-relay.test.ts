import { EvaluationOperator } from '@amplitude/experiment-core';
import { BehavioralTargetingManager } from 'src/behavioral-targeting/behavioral-targeting-manager';
import {
  RelayClient,
  getRelayUrl,
} from 'src/behavioral-targeting/relay-client';
import { RELAY_READY_MESSAGE } from 'src/behavioral-targeting/relay-protocol';

const API_KEY = 'test-api-key';
const WEB_EXP_ID_V2 = 'oeu1383080393924r0-5047421827912331';
const RELAY_URL = getRelayUrl(API_KEY);
const RELAY_ORIGIN = 'https://cdn.amplitude.com';

describe('BehavioralTargetingManager relay wiring', () => {
  let relayClient: RelayClient | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    relayClient?.destroy();
    relayClient = null;
    jest.useRealTimers();
  });

  const signalRelayReady = () => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    const iframeWindow = { postMessage: jest.fn() };
    Object.defineProperty(iframe, 'contentWindow', {
      value: iframeWindow,
      configurable: true,
    });
    window.dispatchEvent(
      new MessageEvent('message', {
        data: RELAY_READY_MESSAGE,
        source: iframeWindow as unknown as MessageEventSource,
        origin: RELAY_ORIGIN,
      }),
    );
    return iframeWindow;
  };

  test('beginRelaySync injects relay iframe and completes relay merge sync attempt', async () => {
    const manager = new BehavioralTargetingManager(API_KEY, {
      flag_a: {
        behavior_1: [
          [
            {
              condition: {
                type: 'behavior',
                event_type: 'click',
                op: EvaluationOperator.GREATER_THAN_EQUALS,
                value: 1,
                time_type: 'rolling',
                time_value: 7,
                interval: 'day',
              },
            },
          ],
        ],
      },
    });

    const attachSpy = jest.spyOn(manager, 'setRelayClient');
    relayClient = new RelayClient(API_KEY, WEB_EXP_ID_V2, RELAY_URL);
    const initPromise = manager.beginRelaySync(relayClient);
    await jest.runAllTimersAsync();
    signalRelayReady();
    await initPromise;

    expect(document.querySelector('iframe')).not.toBeNull();
    expect(relayClient.relayAvailable).toBe(true);
    // Attach is the caller's responsibility, never done inside beginRelaySync.
    expect(attachSpy).not.toHaveBeenCalled();
  });

  test('beginRelaySync waits for late relay ready after init timeout', async () => {
    const manager = new BehavioralTargetingManager(API_KEY, {});

    relayClient = new RelayClient(API_KEY, WEB_EXP_ID_V2, RELAY_URL);
    const syncPromise = manager.beginRelaySync(relayClient);

    await jest.runAllTimersAsync();
    expect(relayClient.relayAvailable).toBe(false);

    signalRelayReady();
    await syncPromise;

    expect(relayClient.relayAvailable).toBe(true);
  });
});
