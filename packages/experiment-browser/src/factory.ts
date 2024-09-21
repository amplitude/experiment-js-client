import { AnalyticsConnector } from '@amplitude/analytics-connector';

import { Defaults, ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import { AmplitudeIntegrationPlugin } from './integration/amplitude';
import { DefaultUserProvider } from './providers/default';

const instances = {};

const getInstanceName = (config: ExperimentConfig): string => {
  return config?.instanceName || Defaults.instanceName;
};

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
  const instanceName = getInstanceName(config);
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
  const instanceName = getInstanceName(config);
  const client = initialize(apiKey, config);
  client.addPlugin(
    new AmplitudeIntegrationPlugin(
      apiKey,
      instanceName,
      AnalyticsConnector.getInstance(instanceName),
      10000,
    ),
  );
  return client;
};

/**
 * Provides factory methods for storing singleton instances of {@link ExperimentClient}
 * @category Core Usage
 */
export const Experiment = {
  initialize,
  initializeWithAmplitudeAnalytics,
};
