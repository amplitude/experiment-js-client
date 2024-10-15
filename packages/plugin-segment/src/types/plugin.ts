import { IntegrationPlugin } from '@amplitude/experiment-js-client';
import { Analytics } from '@segment/analytics-next';

export interface Options {
  /**
   * An existing segment analytics instance. This instance will be used instead
   * of the instance on the window defined by the instanceKey.
   */
  instance?: Analytics;
  /**
   * The key of the field on the window that holds the segment analytics
   * instance when the script is loaded via the script loader.
   *
   * Defaults to "analytics".
   */
  instanceKey?: string;
  /**
   * Skip waiting for the segment SDK to load and be ready.
   */
  skipSetup?: boolean;
}

export interface SegmentIntegrationPlugin {
  (options?: Options): IntegrationPlugin;
}
