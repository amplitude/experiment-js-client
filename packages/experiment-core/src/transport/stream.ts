/* eslint-disable @typescript-eslint/no-explicit-any */
export type StreamErrorEvent = { message?: string; status?: number };
export type StreamOpenEvent = { type?: string };
export type StreamMessageEvent = { data?: string };
export type StreamEvent =
  | StreamErrorEvent
  | StreamOpenEvent
  | StreamMessageEvent;

/**
 * The EventSource client interface.
 * https://html.spec.whatwg.org/multipage/server-sent-events.html#eventsource
 */
export interface StreamEventSource {
  readonly url: string;
  readonly readyState: number;
  readonly withCredentials: boolean;
  onopen: (evt: StreamOpenEvent) => any;
  onmessage: (evt: StreamMessageEvent) => any;
  onerror: (evt: StreamErrorEvent) => any;
  //   addEventListener(type: string, listener: (evt: StreamEvent) => void): void;
  //   dispatchEvent(evt: Event): boolean;
  //   removeEventListener(type: string, listener: (evt: StreamEvent) => void): void;
  close(): void;
}

// A type that can new.
// Ex. import EventSource from 'eventsource'; let a = EventSource; let b = new a("", {});
type Class<T> = new (...args: any[]) => T;
/**
 * This is the type for the class of StreamEventSource.
 * It should support new operation along with defined static members.
 */
export type StreamEventSourceClass = Class<StreamEventSource> & {
  // These are static members usable without new.
  readonly CLOSED: number;
  readonly CONNECTING: number;
  readonly OPEN: number;
};

/**
 * Default error events.
 */
export class DefaultStreamErrorEvents {
  public static readonly TIMEOUT: StreamErrorEvent = { message: 'timeout' };
  public static readonly DATA_UNPARSABLE: StreamErrorEvent = {
    message: 'stream data parse error',
  };
  public static readonly KEEP_ALIVE_FAILURE: StreamErrorEvent = {
    message: 'keep alive fail',
  };
}
