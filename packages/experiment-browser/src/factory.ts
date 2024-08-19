import { AnalyticsConnector } from '@amplitude/analytics-connector';

import { Defaults, ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import {
  ConnectorExposureTrackingProvider,
  ConnectorUserProvider,
} from './integration/connector';
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
  const connector = AnalyticsConnector.getInstance(instanceName);
  if (!instances[instanceKey]) {
    config = {
      ...config,
      userProvider: new DefaultUserProvider(
        connector.applicationContextProvider,
        config?.userProvider,
      ),
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
    connector.eventBridge.setApiKey(apiKey);
    config = {
      userProvider: new DefaultUserProvider(
        connector.applicationContextProvider,
        new ConnectorUserProvider(connector.identityStore),
      ),
      exposureTrackingProvider: new ConnectorExposureTrackingProvider(
        connector.eventBridge,
      ),
      ...config,
    };
    instances[instanceKey] = new ExperimentClient(apiKey, config);
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
