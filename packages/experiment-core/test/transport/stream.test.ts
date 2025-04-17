import { SSEStream } from '../../src/transport/stream';
import { sleep } from '../utils';

describe('SSEStream', () => {
  let addEventListener: jest.Mock;
  let close: jest.Mock;
  let mockStreamProvider: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    addEventListener = jest.fn();
    close = jest.fn();
    mockStreamProvider = jest.fn(() => ({
      addEventListener,
      close,
    }));
  });

  test('should connect and receive data', async () => {
    const stream = new SSEStream(
      mockStreamProvider,
      'http://localhost:7999',
      {
        header1: 'value1',
      },
      4000,
      7000,
    );
    const mockOnDataUpdate = jest.fn();
    const mockOnError = jest.fn();

    // Test new connection makes a call to the stream provider.
    stream.connect(mockOnDataUpdate, mockOnError);
    expect(mockStreamProvider).toHaveBeenCalledWith('http://localhost:7999', {
      header1: 'value1',
    });
    expect(mockStreamProvider).toHaveBeenCalledTimes(1);

    // Test that the event listener is set up correctly.
    addEventListener.mock.calls[0][1]({
      type: 'message',
      data: 'apple',
    });
    expect(addEventListener.mock.calls[0][0]).toBe('message');
    expect(mockOnDataUpdate).toHaveBeenCalledWith('apple');
    expect(addEventListener.mock.calls[1][0]).toBe('error');
    expect(mockOnError).not.toHaveBeenCalled();

    // Test keepalive avoids new connection.
    await sleep(4000);
    addEventListener.mock.calls[0][1]({
      type: 'message',
      data: ' ',
    });
    await sleep(1000);
    expect(mockStreamProvider).toHaveBeenCalledTimes(1);

    // Test keepalive data is not passed to the callback.
    expect(mockOnDataUpdate).not.toHaveBeenCalledWith(' ');
    expect(mockOnError).not.toHaveBeenCalled();

    // Test reconnection reconnects and receives data correctly.
    await sleep(Math.ceil(4000));
    expect(mockStreamProvider).toHaveBeenCalledTimes(2);
    addEventListener.mock.calls[0][1]({
      type: 'message',
      data: 'banana',
    });
    expect(addEventListener.mock.calls[2][0]).toBe('message');
    expect(mockOnDataUpdate).toHaveBeenCalledWith('banana');
    expect(addEventListener.mock.calls[3][0]).toBe('error');
    expect(mockOnError).not.toHaveBeenCalled();
  }, 12000);

  test('able to subscribe for multiple event types', async () => {
    const stream = new SSEStream(mockStreamProvider, 'url', {});
    const mockOnData1Update = jest.fn();
    const mockOnData2Update = jest.fn();
    const mockOnError = jest.fn();

    // Test new connection makes a call to the stream provider.
    stream.connect(
      { channel1: mockOnData1Update, channel2: mockOnData2Update },
      mockOnError,
    );
    expect(mockStreamProvider).toHaveBeenCalledWith('url', {});
    expect(mockStreamProvider).toHaveBeenCalledTimes(1);

    // Test that the event listener is set up correctly.
    const registeredListeners = addEventListener.mock.calls.reduce(
      (acc, curr) => {
        acc[curr[0]] = curr[1];
        return acc;
      },
      {},
    );
    expect(registeredListeners['channel1']).toBeDefined();
    expect(registeredListeners['channel2']).toBeDefined();
    expect(registeredListeners['message']).toBeDefined(); // default is always added.
    expect(registeredListeners['error']).toBeDefined();

    // Send data for each channel.
    registeredListeners['channel1']({
      type: 'channel1',
      data: 'apple',
    });
    expect(mockOnData1Update).toBeCalledTimes(1);
    expect(mockOnData2Update).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnData1Update).toHaveBeenCalledWith('apple');
    registeredListeners['channel2']({
      type: 'channel2',
      data: 'banana',
    });
    expect(mockOnData1Update).toBeCalledTimes(1);
    expect(mockOnData2Update).toBeCalledTimes(1);
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnData2Update).toHaveBeenCalledWith('banana');
  });

  test('keepalive failure causes error', async () => {
    const stream = new SSEStream(mockStreamProvider, 'url', {}, 3000);
    const mockOnDataUpdate = jest.fn();
    const mockOnError = jest.fn();
    stream.connect(mockOnDataUpdate, mockOnError);
    await sleep(4000);
    expect(mockStreamProvider).toHaveBeenCalledTimes(1);
    expect(mockOnDataUpdate).not.toHaveBeenCalled();
    expect(mockOnError).toHaveBeenCalledTimes(1);
    expect(mockOnError).toHaveBeenCalledWith(new Error('Keep-alive timeout'));
    expect(close).toHaveBeenCalled();
  });

  test('error event causes error callback', async () => {
    const stream = new SSEStream(mockStreamProvider, 'url', {});
    const mockOnDataUpdate = jest.fn();
    const mockOnError = jest.fn();
    stream.connect(mockOnDataUpdate, mockOnError);
    addEventListener.mock.calls[1][1]({
      message: 'error',
    });
    expect(mockOnDataUpdate).not.toHaveBeenCalled();
    expect(mockOnError).toHaveBeenCalledWith(
      new Error('Error in stream: {"message":"error"}'),
    );
  });
});
