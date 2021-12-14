import { AmplitudeCore } from '@amplitude/amplitude-core';

import { Defaults, ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import { CoreAnalyticsProvider, CoreUserProvider } from './integration/core';

const instances = {};

/**
 * Initializes a singleton {@link ExperimentClient} identified by the configured
 * instance name.
 *
 * @param apiKey The environment API Key
 * @param config See {@link ExperimentConfig} for config options
 */
const initialize = (
  apiKey: string,
  config?: ExperimentConfig,
): ExperimentClient => {
  // Store instances by appending the instance name and api key. Allows for
  // initializing multiple default instances for different api keys.
  const instanceName = config?.instanceName || Defaults.instanceName;
  const instanceKey = `${instanceName}.${apiKey}`;
  if (!instances[instanceKey]) {
    instances[instanceKey] = new ExperimentClient(apiKey, config);
  }
  return instances[instanceKey];
};

/**
 * Initialize a singleton {@link ExperimentClient} which automatically
 * integrates with the installed and initialized instance of the amplitude
 * analytics SDK.
 *
 * Amplitude analytics
 * @param apiKey
 * @param config
 */
const initializeWithAmplitudeAnalytics = (
  apiKey: string,
  config?: ExperimentConfig,
): ExperimentClient => {
  // Store instances by appending the instance name and api key. Allows for
  // initializing multiple default instances for different api keys.
  const instanceName = config?.instanceName || Defaults.instanceName;
  const instanceKey = `${instanceName}.${apiKey}`;
  const core = AmplitudeCore.getInstance(instanceName);
  if (!instances[instanceKey]) {
    config = config || {};
    if (!config.userProvider) {
      config.userProvider = new CoreUserProvider(core.identityStore);
    }
    if (!config.analyticsProvider) {
      config.analyticsProvider = new CoreAnalyticsProvider(
        core.analyticsConnector,
      );
    }
    instances[instanceKey] = new ExperimentClient(apiKey, config);
    core.identityStore.addIdentityListener(() => {
      instances[instanceKey].fetch();
    });
  }
  return instances[instanceKey];
};

/**
 * Provides factory methods for storing singleton instances of {@link ExperimentClient}
 * @category Core Usage
 */
export const Experiment = {
  initialize,
  initializeWithAmplitudeAnalytics,
};
