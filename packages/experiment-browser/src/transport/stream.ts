/**
 * @packageDocumentation
 * @internal
 */

import { SSE, SSEProviderParams } from '@amplitude/experiment-core';
import EventSource from 'eventsource';

export const defaultSseProvider = (
  url: string,
  params: SSEProviderParams,
): SSE => {
  const es = new EventSource(url, params);
  return es;
};
