import { EvaluationFlag } from '../evaluation/flag';
import {
  StreamErrorEvent,
  DEFAULT_STREAM_ERR_EVENTS,
  StreamEventSourceFactory,
  SdkStream,
  StreamOnErrorCallback,
  StreamOptions,
} from '../transport/stream';

const DEFAULT_INITIAL_CONN_TIMEOUT = 1000;
const DEFAULT_TRY_ATTEMPTS = 2;
const DEFAULT_TRY_WAIT_TIMEOUT = 1000;

export type StreamFlagOptions = StreamOptions;

export type StreamFlagOnUpdateCallback = (
  flags: Record<string, EvaluationFlag>,
) => unknown;
export type StreamFlagOnErrorCallback = StreamOnErrorCallback;

export interface StreamFlagApi {
  /**
   * To connect to the stream flag endpoint.
   * It will connect the stream and makes sure the initial flag configs are received and valid.
   * The initial flag configs are delivered through onUpdate.
   * It attempts to retry up to the attempts specified.
   * If fatal error happens during connect() call, error will be thrown instead of delivered through onError.
   * @param options Options for connection.
   */
  connect(options?: StreamOptions): Promise<void>;
  /**
   * To close the stream.
   * If application don't call this, the application may not exit as there are underlaying timers.
   */
  close(): void;
  /**
   * Check if the stream is closed and no retry action is happening.
   */
  isClosed: boolean;
  /**
   * Callback for receiving flag configs updates.
   * Can set this value directly multiple times and effect immediately.
   */
  onUpdate?: StreamFlagOnUpdateCallback;
  /**
   * Callback for receiving fatal errors.
   * Fatal errors are defined as server returning 501 or retry has reached max attempts.
   * This callback will not be called when error happens during connect() call. The error will be throwed in connect() instead.
   * Can set this value directly multiple times and effect immediately.
   */
  onError?: StreamFlagOnErrorCallback;
}

/**
 * This class receives flag config updates from server.
 * It also handles errors, retries, flag parsing, and initial flags on connection, in addition to SdkStreamApi.
 */
export class SdkStreamFlagApi implements StreamFlagApi {
  // Underlaying SSE api.
  private api: SdkStream;
  // Flag for whether the stream is open and retrying or closed. This is to avoid calling connect() twice.
  private isClosedAndNotTrying = true;

  // Callback for updating flag configs. Can be set or changed multiple times and effect immediately.
  public onUpdate?: StreamFlagOnUpdateCallback;
  // Callback for notifying user of fatal errors. Can be set or changed multiple times and effect immediately.
  public onError?: StreamFlagOnErrorCallback;

  // Options for streaming.
  private options?: StreamFlagOptions;
  // Timeout for a single try of connection. Includes streamConnTimeoutMillis and time for receiving initial flag configs.
  private streamFlagConnTimeoutMillis: number;
  // Number of attempts for trying connection.
  private streamFlagTryAttempts: number;
  // The delay between attempts.
  private streamFlagTryDelayMillis: number;

  constructor(
    deploymentKey: string,
    serverUrl: string,
    eventSourceFactory: StreamEventSourceFactory,
    streamConnTimeoutMillis?: number,
    streamFlagConnTimeoutMillis: number = DEFAULT_INITIAL_CONN_TIMEOUT,
    streamFlagTryAttempts: number = DEFAULT_TRY_ATTEMPTS,
    streamFlagTryDelayMillis: number = DEFAULT_TRY_WAIT_TIMEOUT,
  ) {
    this.api = new SdkStream(
      deploymentKey,
      serverUrl + '/sdk/stream/v1/flags',
      eventSourceFactory,
      streamConnTimeoutMillis,
    );
    this.streamFlagConnTimeoutMillis = Math.max(0, streamFlagConnTimeoutMillis);
    this.streamFlagTryAttempts = Math.max(1, streamFlagTryAttempts);
    this.streamFlagTryDelayMillis = Math.max(0, streamFlagTryDelayMillis);
  }

  // A try:
  // Try connect and receive at least one single flag update.
  private connectTry(options?: StreamFlagOptions) {
    // Timeout for initial connection. Makes sure the connection do not exceed a certain interval.
    let timeout: NodeJS.Timeout | undefined = undefined;
    return new Promise<void>((resolve, reject) => {
      // On connection and receiving first update, success, set future flag update callback and error handling retries.
      const dealWithFlagUpdateInOneTry = async (data: string) => {
        if (timeout) {
          clearTimeout(timeout);
        }
        try {
          // Make sure valid flag configs.
          SdkStreamFlagApi.parseFlagConfigs(data);
        } catch (e) {
          return reject(DEFAULT_STREAM_ERR_EVENTS.DATA_UNPARSABLE);
        }
        // Update the callbacks.
        this.api.onUpdate = (data: string) => this.handleNewMsg(data);
        this.api.onError = (err: StreamErrorEvent) => this.errorAndRetry(err);
        // Handoff data to application. Make sure it finishes processing initial new flag configs.
        await this.handleNewMsg(data);
        // Resolve promise which declares client ready.
        resolve();
      };
      this.api.onUpdate = dealWithFlagUpdateInOneTry;

      // If it fails to connect, fails try.
      // If it disconnects before flag update, fails try.
      const dealWithErrorInOneTry = async (err: StreamErrorEvent) => {
        if (timeout) {
          clearTimeout(timeout);
        }
        reject(err); // Reject promise which will either retry or fatal err.
      };
      this.api.onError = dealWithErrorInOneTry;

      // Try connect.
      this.api.connect(options);

      // If it fails to return flag update within limit time, fails try.
      timeout = setTimeout(() => {
        dealWithErrorInOneTry(DEFAULT_STREAM_ERR_EVENTS.TIMEOUT);
      }, this.streamFlagConnTimeoutMillis);
    });
  }

  // Do try up to 2 times. If any of error is fatal, stop any further tries.
  // If trials times reached, fatal error.
  public async connect(options?: StreamFlagOptions) {
    // Makes sure there is no other connect running.
    if (!this.isClosedAndNotTrying) {
      return;
    }
    this.isClosedAndNotTrying = false;

    this.options = options; // Save options for retries in case of errors.
    const attempts = this.streamFlagTryAttempts;
    const delay = this.streamFlagTryDelayMillis;
    for (let i = 0; i < attempts; i++) {
      try {
        // Try.
        return await this.connectTry(options);
      } catch (e) {
        if (this.isClosedAndNotTrying) {
          // There's a call to close while waiting for connection.
          return;
        }

        // connectTry() does not call close or closeForRetry on error.
        const err = e as StreamErrorEvent;
        if (this.isFatal(err) || i == attempts - 1) {
          // We want to throw exception instead of call onError callback.
          this.close();
          throw err;
        }

        // Retry.
        this.closeForRetry();
        await new Promise((resolve) => setTimeout(resolve, delay));

        if (this.isClosedAndNotTrying) {
          // There's a call to close while waiting for retry.
          return;
        }
      }
    }
  }

  // Close stream.
  public close() {
    this.closeForRetry();
    this.isClosedAndNotTrying = true;
  }

  // Close stream, but we know there will be another try happening very soon.
  public closeForRetry() {
    this.api.close();
  }

  get isClosed() {
    return this.isClosedAndNotTrying;
  }

  // Fatal error if 501 Unimplemented.
  private isFatal(err: StreamErrorEvent) {
    return err && err?.status == 501;
  }

  // If error during normal operation, retry init connection up to 2 times.
  private async errorAndRetry(err: StreamErrorEvent) {
    if (this.isFatal(err)) {
      this.close();
      await this.fatalErr(err);
    } else {
      this.close(); // Not closeForRetry(), connect checks for isClosedAndNotTrying.
      this.connect(this.options).catch((err) => {
        this.fatalErr(err);
      });
    }
  }

  // No more retry, 501 unimplemented. Need fallback.
  private async fatalErr(err: StreamErrorEvent) {
    if (this.onError) {
      try {
        await this.onError(err);
        // eslint-disable-next-line no-empty
      } catch {} // Don't care about application errors after handoff.
    }
  }

  // Handles new messages, parse them, and handoff to application. Retries if have parsing error.
  private async handleNewMsg(data: string) {
    let flagConfigs;
    try {
      flagConfigs = SdkStreamFlagApi.parseFlagConfigs(data);
    } catch (e) {
      this.errorAndRetry(DEFAULT_STREAM_ERR_EVENTS.DATA_UNPARSABLE);
      return;
    }
    // Put update outside try catch. onUpdate error doesn't mean stream error.
    if (this.onUpdate) {
      try {
        await this.onUpdate(flagConfigs);
        // eslint-disable-next-line no-empty
      } catch {} // Don't care about application errors after handoff.
    }
  }

  // Parse message. Throws if unparsable.
  private static parseFlagConfigs(data: string) {
    const flagsArray: EvaluationFlag[] = JSON.parse(data) as EvaluationFlag[];
    return flagsArray.reduce(
      (map: Record<string, EvaluationFlag>, flag: EvaluationFlag) => {
        map[flag.key] = flag;
        return map;
      },
      {},
    );
  }
}
