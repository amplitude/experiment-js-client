import { AnalyticsConnector } from '@amplitude/analytics-connector';

import { Defaults, ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import {
  ConnectorExposureTrackingProvider,
  ConnectorUserProvider,
} from './integration/connector';
import { DefaultUserProvider } from './integration/default';
import { safeGlobal } from './util/global';

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
  return getInstance(apiKey, config, () => {
    const instanceName = getInstanceName(config);
    const connector = AnalyticsConnector.getInstance(instanceName);
    config = {
      userProvider: new DefaultUserProvider(
        connector.applicationContextProvider,
      ),
      ...config,
    };
    return new ExperimentClient(apiKey, config);
  });
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
  return getInstance(apiKey, config, () => {
    const instanceName = getInstanceName(config);
    const connector = AnalyticsConnector.getInstance(instanceName);
    config = {
      userProvider: new ConnectorUserProvider(connector.identityStore),
      exposureTrackingProvider: new ConnectorExposureTrackingProvider(
        connector.eventBridge,
      ),
      ...config,
    };
    const client = new ExperimentClient(apiKey, config);
    if (config.automaticFetchOnAmplitudeIdentityChange) {
      connector.identityStore.addIdentityListener(() => client.fetch());
    }
    return client;
  });
};

/**
 * Provides factory methods for storing singleton instances of {@link ExperimentClient}
 * @category Core Usage
 */
export const Experiment = {
  initialize,
  initializeWithAmplitudeAnalytics,
};

/*
 * Global instances
 */
const instancesKey = 'ampExpInstances';
const getInstanceName = (config?: ExperimentConfig): string => {
  return config?.instanceName || Defaults.instanceName;
};
const getInstance = (
  apiKey: string,
  config?: ExperimentConfig,
  factory?: () => ExperimentClient,
): ExperimentClient => {
  // Store instances by appending the instance name and api key. Allows for
  // initializing multiple default instances for different api keys.
  const instanceName = getInstanceName(config);
  const instanceKey = `${instanceName}.${apiKey}`;
  if (!safeGlobal[instancesKey]) {
    safeGlobal[instancesKey] = {};
  }
  if (!safeGlobal[instancesKey][instanceKey] && factory) {
    safeGlobal[instancesKey][instanceKey] = factory();
  }
  return safeGlobal[instancesKey][instanceKey];
};
