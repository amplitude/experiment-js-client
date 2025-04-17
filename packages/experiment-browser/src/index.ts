/**
 * This is the API Reference for the Experiment JS Client SDK.
 * For more details on implementing this SDK, view the documentation
 * [here](https://amplitude-lab.readme.io/docs/javascript-client-sdk).
 * @module experiment-js-client
 */

export { ExperimentConfig } from './config';
export {
  AmplitudeUserProvider,
  AmplitudeAnalyticsProvider,
} from './providers/amplitude';
export { AmplitudeIntegrationPlugin } from './integration/amplitude';
export {
  Experiment,
  initialize,
  initializeWithAmplitudeAnalytics,
} from './factory';
export { experimentAnalyticsPlugin } from './experiment-analytics-plugin';
export { StubExperimentClient } from './stubClient';
export { ExperimentClient } from './experimentClient';
export { Client, FetchOptions } from './types/client';
export {
  ExperimentAnalyticsProvider,
  ExperimentAnalyticsEvent,
} from './types/analytics';
export { ExperimentUserProvider } from './types/provider';
export { Source } from './types/source';
export { ExperimentUser } from './types/user';
export { Variant, Variants } from './types/variant';
export { Exposure, ExposureTrackingProvider } from './types/exposure';
export {
  ExperimentPlugin,
  IntegrationPlugin,
  ExperimentPluginType,
  ExperimentEvent,
} from './types/plugin';
