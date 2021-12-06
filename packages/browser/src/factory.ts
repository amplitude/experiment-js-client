import { AmplitudeCore } from '@amplitude/amplitude-core';

import { ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import { CoreAnalyticsProvider, CoreUserProvider } from './integration/core';

const instances = {};

// TODO this is defined twice, figure something better out.
const defaultInstance = '$default_instance';

/**
 * Initializes a singleton {@link ExperimentClient} identified by the api-key.
 *
 * @param apiKey The environment API Key
 * @param config See {@link ExperimentConfig} for config options
 */
const initialize = (
  apiKey: string,
  config?: ExperimentConfig,
): ExperimentClient => {
  if (!instances[defaultInstance]) {
    instances[defaultInstance] = new ExperimentClient(apiKey, config);
  }
  return instances[defaultInstance];
};

const initializeWithAmplitude = (
  apiKey: string,
  config?: ExperimentConfig,
): ExperimentClient => {
  const core = AmplitudeCore.getInstance(defaultInstance);
  if (!instances[defaultInstance]) {
    config = config || {};
    if (!config.userProvider) {
      config.userProvider = new CoreUserProvider(core.identityStore);
    }
    if (!config.analyticsProvider) {
      config.analyticsProvider = new CoreAnalyticsProvider(
        core.analyticsConnector,
      );
    }
    instances[defaultInstance] = new ExperimentClient(apiKey, config);
    core.identityStore.addIdentityListener(() => {
      instances[defaultInstance].fetch();
    });
  }
  return instances[defaultInstance];
};

/**
 * Provides factory methods for storing singleton instances of {@link ExperimentClient}
 * @category Core Usage
 */
export const Experiment = {
  initialize,
  initializeWithAmplitude,
};
