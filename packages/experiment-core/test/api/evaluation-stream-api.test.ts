import { FetchError, SdkStreamEvaluationApi } from '../../src';
import { sleep } from '../utils';

const VARDATA = {
  'peter-test-stream': {
    key: 'treatment',
    metadata: {
      experimentKey: 'exp-1',
    },
    value: 'treatment',
  },
};
describe('EvaluationStreamApi tests', () => {
  let registeredListeners: Record<string, (data: unknown) => void>;
  let mockStreamProvider: jest.Mock;
  let api: SdkStreamEvaluationApi;
  let mockOnDataUpdate: jest.Mock;
  let mockOnError: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    registeredListeners = {};
    mockStreamProvider = jest.fn((url, header) => {
      expect(url).toBe('https://url/sdk/stream/v1/vardata');
      expect(header['Authorization']).toBe('Api-Key apikey');
      return {
        addEventListener: jest.fn(
          (eventType: string, cb: (data: unknown) => void) => {
            registeredListeners[eventType] = cb;
          },
        ),
        close: jest.fn(),
      };
    });

    api = new SdkStreamEvaluationApi(
      'apikey',
      'https://url',
      mockStreamProvider,
      2000,
    );
    mockOnDataUpdate = jest.fn();
    mockOnError = jest.fn();
  });

  test('connect and receive data and parses', async () => {
    const connectPromise = api.streamVariants(
      {},
      undefined,
      mockOnDataUpdate,
      mockOnError,
    );
    await sleep(1000);
    expect(mockStreamProvider).toHaveBeenCalledTimes(1);
    registeredListeners['message']({
      data: JSON.stringify(VARDATA),
    });
    await connectPromise;
    expect(mockOnDataUpdate).toHaveBeenCalledTimes(1);
    expect(mockOnDataUpdate).toHaveBeenCalledWith(VARDATA);
    expect(mockOnError).not.toHaveBeenCalled();
  });
  test('connect http error', async () => {
    const connectPromise = api.streamVariants(
      {},
      undefined,
      mockOnDataUpdate,
      mockOnError,
    );
    await sleep(1000);
    expect(mockStreamProvider).toHaveBeenCalledTimes(1);
    registeredListeners['error']({
      status: 500,
      message: 'Internal Server Error',
    });
    await expect(connectPromise).rejects.toThrow(
      new FetchError(500, 'Internal Server Error'),
    );
    expect(mockOnDataUpdate).not.toHaveBeenCalled();
    expect(mockOnError).toHaveBeenCalledTimes(0);
  });
  test('connect parsing error', async () => {
    const connectPromise = api.streamVariants(
      {},
      undefined,
      mockOnDataUpdate,
      mockOnError,
    );
    await sleep(1000);
    expect(mockStreamProvider).toHaveBeenCalledTimes(1);
    registeredListeners['message']({
      data: 'not json',
    });
    await expect(connectPromise).rejects.toThrow();
    expect(mockOnDataUpdate).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();
  });
  test('connect timeout', async () => {
    const connectPromise = api.streamVariants(
      {},
      undefined,
      mockOnDataUpdate,
      mockOnError,
    );
    await Promise.race([
      expect(connectPromise).rejects.toThrow(),
      sleep(2100).then(() => {
        throw new Error('Timeout');
      }),
    ]);
    expect(mockStreamProvider).toHaveBeenCalledTimes(1);
    expect(mockOnDataUpdate).not.toHaveBeenCalled();
    expect(mockOnError).toHaveBeenCalledTimes(0);
  });
  test('stream error stops api', async () => {
    const connectPromise = api.streamVariants(
      {},
      undefined,
      mockOnDataUpdate,
      mockOnError,
    );
    await sleep(1000);
    expect(mockStreamProvider).toHaveBeenCalledTimes(1);
    registeredListeners['message']({
      data: JSON.stringify(VARDATA),
    });
    await connectPromise;
    expect(mockOnDataUpdate).toHaveBeenCalledTimes(1);
    expect(mockOnDataUpdate).toHaveBeenCalledWith(VARDATA);
    expect(mockOnError).not.toHaveBeenCalled();

    registeredListeners['error']({
      message: 'Socket closed',
    });
    expect(mockOnError).toHaveBeenCalledTimes(1);
    expect(mockOnError).toHaveBeenCalledWith(
      new Error('Error in stream: {"message":"Socket closed"}'),
    );
  });
  test('stream error stops api', async () => {
    const connectPromise = api.streamVariants(
      {},
      undefined,
      mockOnDataUpdate,
      mockOnError,
    );
    await sleep(1000);
    expect(mockStreamProvider).toHaveBeenCalledTimes(1);
    registeredListeners['message']({
      data: JSON.stringify(VARDATA),
    });
    await connectPromise;
    expect(mockOnDataUpdate).toHaveBeenCalledTimes(1);
    expect(mockOnDataUpdate).toHaveBeenCalledWith(VARDATA);
    expect(mockOnError).not.toHaveBeenCalled();

    registeredListeners['message']({
      data: 'not json',
    });
    expect(mockOnDataUpdate).toHaveBeenCalledTimes(1);
    expect(mockOnError).toHaveBeenCalledTimes(1);
  });
});
