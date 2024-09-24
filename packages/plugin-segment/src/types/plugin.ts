import { IntegrationPlugin } from '@amplitude/experiment-js-client';
import { Analytics } from '@segment/analytics-next';

export interface Options {
  instance?: Analytics;
  instanceKey?: string;
  skipSetup?: boolean;
}

export interface SegmentIntegrationPlugin {
  (options?: Options): IntegrationPlugin;
}
