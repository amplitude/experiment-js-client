import {
  AmplitudeCore,
  EnrichmentPlugin,
  CoreClient,
  IConfig,
  BrowserClient,
  BrowserConfig,
} from '@amplitude/analytics-core';

import { ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import { initializeWithAmplitudeAnalytics } from './factory';

// Module augmentation to add experiment variable at compile time
declare module '@amplitude/analytics-core' {
  interface CoreClient {
    experiment: ExperimentClient;
  }
}

class ExperimentAnalyticsPlugin
  implements EnrichmentPlugin<BrowserClient, BrowserConfig>
{
  name = 'experiment-analytics-plugin';
  experiment: ExperimentClient;
  config?: ExperimentConfig;

  constructor(config?: ExperimentConfig) {
    this.config = config;
    // Add experiment property at run time
    Object.defineProperty(AmplitudeCore.prototype, 'experiment', {
      get: function () {
        return (
          this.plugin(
            ExperimentAnalyticsPlugin.name,
          ) as ExperimentAnalyticsPlugin
        ).experiment;
      },
    });
  }

  async setup(config: IConfig, _client: CoreClient) {
    this.experiment = initializeWithAmplitudeAnalytics(config.apiKey, config);
  }
}

export const experimentAnalyticsPlugin = () => {
  return new ExperimentAnalyticsPlugin();
};
