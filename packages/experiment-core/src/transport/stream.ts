/* eslint-disable @typescript-eslint/no-explicit-any */
export type StreamErrorEvent = { message?: string; status?: number };
export type StreamOpenEvent = { type?: string };
export type StreamMessageEvent = { data?: string };
export type StreamEvent =
  | StreamErrorEvent
  | StreamOpenEvent
  | StreamMessageEvent;

// https://html.spec.whatwg.org/multipage/server-sent-events.html#eventsource
export interface StreamEventSource {
  readonly url: string;
  readonly readyState: number;
  readonly withCredentials: boolean;
  onopen: (evt: StreamOpenEvent) => any;
  onmessage: (evt: StreamMessageEvent) => any;
  onerror: (evt: StreamErrorEvent) => any;
  addEventListener(type: string, listener: (evt: StreamEvent) => void): void;
  dispatchEvent(evt: Event): boolean;
  removeEventListener(type: string, listener: (evt: StreamEvent) => void): void;
  close(): void;
}

// A type variable that can new.
// Ex. import EventSource from 'eventsource'; let a = EventSource; let b = new a("", {});
// export interface StreamEventSourceClass extends StreamEventSource {
//   new (url: string, initDict: Record<string, any>): StreamEventSource;
// }

type Class<T> = new (...args: any[]) => T;

export type StreamEventSourceClass = Class<StreamEventSource> & {
  readonly CLOSED: number;
  readonly CONNECTING: number;
  readonly OPEN: number;
};
