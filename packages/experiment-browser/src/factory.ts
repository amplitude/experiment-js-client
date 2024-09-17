import { AnalyticsConnector } from '@amplitude/analytics-connector';

import { Defaults, ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import { DefaultUserProvider } from './providers/default';
import { AmplitudeIntegrationPlugin } from './integration/amplitude';

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
  if (!instances[instanceKey]) {
    config = {
      ...config,
      userProvider: new DefaultUserProvider(config?.userProvider, apiKey),
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
  const connector = AnalyticsConnector.getInstance(instanceName);
  if (!instances[instanceKey]) {
    connector.eventBridge.setInstanceName(instanceName);
    config = {
      userProvider: new DefaultUserProvider(undefined, apiKey),
      ...config,
    };
    const client = new ExperimentClient(apiKey, config);
    client.addPlugin(
      new AmplitudeIntegrationPlugin(
        apiKey,
        connector.identityStore,
        connector.eventBridge,
        connector.applicationContextProvider,
        10000,
      ),
    );
    instances[instanceKey] = client;
    if (config.automaticFetchOnAmplitudeIdentityChange) {
      connector.identityStore.addIdentityListener(() => {
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
