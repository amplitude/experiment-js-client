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

// TODO(xinyi): it'll be great if we can make sure the following work
//  so that customers do need to add module augmentation on their side.
// Module augmentation to add experiment variable at compile time
declare module '@amplitude/analytics-core' {
  interface CoreClient {
    experiment: ExperimentClient;
  }
}

export class ExperimentAnalyticsPlugin
  implements EnrichmentPlugin<BrowserClient, BrowserConfig>
{
  static pluginName = '@amplitude/experiment-analytics-plugin';
  name = ExperimentAnalyticsPlugin.pluginName;
  experiment: ExperimentClient;
  config?: ExperimentConfig;

  constructor(config?: ExperimentConfig) {
    this.config = config;

    // TODO(xinyi): it'll be great if we can make sure the following work
    //  so that customers do need to add module augmentation on their side.
    // Add experiment property at run time
    Object.defineProperty(AmplitudeCore.prototype, 'experiment', {
      get: function () {
        return (
          this.plugin(
            ExperimentAnalyticsPlugin.pluginName,
          ) as ExperimentAnalyticsPlugin
        ).experiment;
      },
    });
  }

  async setup(config: IConfig, _client: CoreClient) {
    this.experiment = initializeWithAmplitudeAnalytics(config.apiKey, config);
  }
}
