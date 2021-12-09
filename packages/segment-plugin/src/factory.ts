import {
  Experiment,
  ExperimentClient,
  ExperimentConfig,
} from '@amplitude/experiment-js-client';
import { Analytics } from '@segment/analytics-next';

import { SegmentAnalyticsProvider } from './analyticsProvider';
import { SegmentUserProvider } from './userProvider';

/**
 * Initializes a singleton {@link ExperimentClient} identified by the api-key.
 *
 * @param segment The segment analytics.js sdk
 * @param apiKey The environment API Key
 * @param config See {@link ExperimentConfig} for config options
 */
export const initializeWithSegment = (
  segment: Analytics,
  apiKey: string,
  config?: ExperimentConfig,
): ExperimentClient => {
  const segmentConfig = {
    ...config,
    userProvider: new SegmentUserProvider(segment),
    analyticsProvider: new SegmentAnalyticsProvider(segment),
  };
  return Experiment.initialize(apiKey, segmentConfig);
};
