/* eslint-disable no-console */
import { EvaluationFlag } from '../evaluation/flag';
import { StreamEventSourceClass, StreamErrorEvent } from '../transport/stream';

import {
  SdkStreamApi,
  StreamOnErrorCallback,
  StreamOptions,
} from './stream-api';

const DEFAULT_INITIAL_CONN_TIMEOUT = 1000;

// Changing retry params will also need to change tests.
const TRY_ATTEMPTS = 2;
const TRY_WAIT_TIMEOUT = 1000;

export type StreamFlagOptions = StreamOptions & {
  // Timeout for a single try of connection.
  // Includes streamConnTimeoutMillis and time for receiving initial flag configs.
  streamFlagConnTimeoutMillis?: number;
};

export type StreamFlagOnUpdateCallback = (
  flags: Record<string, EvaluationFlag>,
) => void;
export type StreamFlagOnErrorCallback = StreamOnErrorCallback;

export interface StreamFlagApi {
  connect(options?: StreamOptions): void;
  close(): void;
  isClosed: boolean;
  onUpdate?: StreamFlagOnUpdateCallback;
  onError?: StreamFlagOnErrorCallback;
}

export class SdkStreamFlagApi implements StreamFlagApi {
  private api: SdkStreamApi;
  private initConnTimeout?: NodeJS.Timeout;
  private options?: StreamOptions;
  private isClosedAndNotTrying = true;
  public onUpdate?: StreamFlagOnUpdateCallback;
  public onError?: StreamFlagOnErrorCallback;

  constructor(
    deploymentKey: string,
    serverUrl: string,
    eventSourceClass: StreamEventSourceClass,
    onUpdate?: StreamFlagOnUpdateCallback,
    onError?: StreamFlagOnErrorCallback,
  ) {
    this.api = new SdkStreamApi(
      deploymentKey,
      serverUrl + '/sdk/stream/v1/flags',
      eventSourceClass,
    );
    if (onUpdate) {
      this.onUpdate = onUpdate;
    }
    if (onError) {
      this.onError = onError;
    }
  }

  // A try:
  // Try connect and receive at least one single flag update.
  private connectTry(options?: StreamFlagOptions) {
    let timeout: NodeJS.Timeout | undefined = undefined;
    return new Promise<void>((resolve, reject) => {
      // On connection and receiving first update, success, set future flag update callback and error handling retries.
      const dealWithFlagUpdateInOneTry = (data: string) => {
        this.api.onUpdate = (data: string) => this.handleNewMsg(data);
        this.api.onError = (err: StreamErrorEvent) => this.errorAndRetry(err);
        console.log('First push here');
        if (timeout) {
          clearTimeout(timeout);
        }
        this.handleNewMsg(data);

        resolve(); // Return promise which declares client ready.
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
      console.log('Connecting');
      this.api.connect(options);

      // If it fails to return flag update within limit time, fails try.
      timeout = setTimeout(() => {
        dealWithErrorInOneTry({ message: 'timeout' });
      }, options?.streamFlagConnTimeoutMillis ?? DEFAULT_INITIAL_CONN_TIMEOUT);
    });
  }

  // Do try up to 2 times. If any of error is fatal, stop any further tries.
  // If trials times reached, fatal error.
  public async connect(options?: StreamFlagOptions) {
    if (!this.isClosedAndNotTrying) {
      return;
    }
    this.isClosedAndNotTrying = false;

    this.options = options;
    for (let i = 0; i < TRY_ATTEMPTS; i++) {
      if (this.isClosedAndNotTrying) {
        // There's a call to close while waiting for retry.
        return;
      }
      try {
        return await this.connectTry(options);
      } catch (e) {
        // connectTry() does not call close or closeForRetry.
        console.log('connect failed');
        const err = e as StreamErrorEvent;
        if (this.isFatal(err) || i == TRY_ATTEMPTS - 1) {
          // No fatalErr(). We want to fail instead of call onError.
          await this.close();
          throw err; // Failing the connect().
        }
        // Retry
        await this.closeForRetry();
        await new Promise((resolve) => setTimeout(resolve, TRY_WAIT_TIMEOUT));
      }
    }
  }

  // Close stream.
  public async close() {
    await this.closeForRetry();
    this.isClosedAndNotTrying = true;
  }

  // Close stream.
  public async closeForRetry() {
    this.api.close();
    if (this.initConnTimeout) {
      clearTimeout(this.initConnTimeout);
    }
  }

  get isClosed() {
    return this.isClosedAndNotTrying;
  }

  // Fatal error if 501.
  private isFatal(err: StreamErrorEvent) {
    return err && err && err?.status == 501;
  }

  // If error during normal operation, retry init connection up to 2 times.
  private async errorAndRetry(err: StreamErrorEvent) {
    console.log('errorAndRetry', err);
    if (this.isFatal(err)) {
      await this.close();
      await this.fatalErr(err);
    } else {
      await this.close(); // Not closeForRetry(), connect checks for isClosedAndNotTrying.
      this.connect(this.options).catch((err) => {
        this.fatalErr(err);
      });
    }
  }

  // No more retry, 501 unimplemented. Need fallback.
  private async fatalErr(err: StreamErrorEvent) {
    console.log('Fatal error', err);
    if (this.onError) {
      this.onError(err);
    }
  }

  // Parses message and update.
  private async handleNewMsg(data: string) {
    console.log('Got push', data.length);

    let flagConfigs;
    try {
      const flagsArray: EvaluationFlag[] = JSON.parse(data) as EvaluationFlag[];
      flagConfigs = flagsArray.reduce(
        (map: Record<string, EvaluationFlag>, flag: EvaluationFlag) => {
          map[flag.key] = flag;
          return map;
        },
        {},
      );
    } catch {
      this.errorAndRetry({ message: `Stream data parse error: ${data}` });
      return;
    }
    // Put update outside try catch. onUpdate error doesn't mean stream error.
    if (this.onUpdate) {
      this.onUpdate(flagConfigs);
    }
  }
}
