/**
 * @packageDocumentation
 * @internal
 */

import { SSE } from '@amplitude/experiment-core';
import EventSource from 'eventsource';

export const defaultSseProvider = (
  url: string,
  headers: Record<string, string>,
): SSE => {
  const es = new EventSource(url, {
    headers,
  });
  return es;
};
