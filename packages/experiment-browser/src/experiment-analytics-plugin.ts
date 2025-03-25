import { AmplitudeBrowser, Types } from '@amplitude/analytics-browser';

import { ExperimentClient } from './experimentClient';
import { initializeWithAmplitudeAnalytics } from './factory';

// Module augmentation to add experiment variable at compile time
declare module '@amplitude/analytics-browser' {
  interface AmplitudeBrowser {
    experiment: ExperimentClient;
  }
}

export class ExperimentAnalyticsPlugin implements Types.EnrichmentPlugin {
  name = 'experiment-analytics-plugin';
  experiment: ExperimentClient;

  constructor() {
    Object.defineProperty(AmplitudeBrowser.prototype, 'experiment', {
      get: function () {
        return (
          this.plugin(
            ExperimentAnalyticsPlugin.name,
          ) as ExperimentAnalyticsPlugin
        ).experiment;
      },
    });
  }

  async setup(config: Types.BrowserConfig, client: Types.BrowserClient) {
    this.experiment = initializeWithAmplitudeAnalytics(config.apiKey);
  }
}
