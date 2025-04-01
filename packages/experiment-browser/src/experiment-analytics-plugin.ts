import {
  AmplitudeCore,
  EnrichmentPlugin,
  CoreClient,
  IConfig,
} from '@amplitude/analytics-core';

import { ExperimentClient } from './experimentClient';
import { initializeWithAmplitudeAnalytics } from './factory';

// Module augmentation to add experiment variable at compile time
declare module '@amplitude/analytics-core' {
  interface CoreClient {
    experiment: ExperimentClient;
  }
}

export class ExperimentAnalyticsPlugin implements EnrichmentPlugin {
  name = 'experiment-analytics-plugin';
  experiment: ExperimentClient;

  constructor() {
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

  async setup(config: IConfig, client: CoreClient) {
    this.experiment = initializeWithAmplitudeAnalytics(config.apiKey);
  }
}
