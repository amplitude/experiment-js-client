import { AmplitudeCore } from '@amplitude/amplitude-core';

import { Defaults, ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import { CoreAnalyticsProvider, CoreUserProvider } from './integration/core';
import { DefaultUserProvider } from './integration/default';

const instances = {};

/**
 * Initializes a singleton {@link ExperimentClient} identified by the configured
 * instance name.
 *
 * @param apiKey The deployment API Key
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
  const core = AmplitudeCore.getInstance(instanceName);
  if (!instances[instanceKey]) {
    config = {
      userProvider: new DefaultUserProvider(core.applicationContextProvider),
      ...config,
    };
    instances[instanceKey] = new ExperimentClient(apiKey, config);
  }
  return instances[instanceKey];
};

/**
 * Initialize a singleton {@link ExperimentClient} which automatically
 * integrates with the installed and initialized instance of the amplitude
 * analytics SDK.
 *
 * You must be using amplitude-js SDK version 8.17.0+ for this integration to
 * work.
 *
 * @param apiKey The deployment API Key
 * @param config See {@link ExperimentConfig} for config options
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
    config = {
      userProvider: new CoreUserProvider(core.identityStore),
      analyticsProvider: new CoreAnalyticsProvider(core.analyticsConnector),
      ...config,
    };
    instances[instanceKey] = new ExperimentClient(apiKey, config);
    if (config.automaticFetchOnAmplitudeIdentityChange) {
      core.identityStore.addIdentityListener(() => {
        instances[instanceKey].fetch();
      });
    }
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
