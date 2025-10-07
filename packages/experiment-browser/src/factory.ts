import { AnalyticsConnector } from '@amplitude/analytics-connector';
import { safeGlobal } from '@amplitude/experiment-core';

import { Defaults, ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import { AmplitudeIntegrationPlugin } from './integration/amplitude';
import { DefaultUserProvider } from './providers/default';
import { ExperimentPlugin } from './types/plugin';

// Global instances for debugging.
safeGlobal.experimentInstances = {};
const instances = safeGlobal.experimentInstances;

/**
 * Initializes a singleton {@link ExperimentClient} identified by the configured
 * instance name.
 *
 * @param apiKey The deployment API Key
 * @param config See {@link ExperimentConfig} for config options
 */
export const initialize = (
  apiKey: string,
  config?: ExperimentConfig,
): ExperimentClient => {
  return _initialize(apiKey, config);
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
export const initializeWithAmplitudeAnalytics = (
  apiKey: string,
  config?: ExperimentConfig,
): ExperimentClient => {
  const plugin = () =>
    new AmplitudeIntegrationPlugin(
      apiKey,
      AnalyticsConnector.getInstance(getInstanceName(config)),
      10000,
    );
  return _initialize(apiKey, config, plugin);
};

const getInstanceName = (config: ExperimentConfig): string => {
  return config?.instanceName || Defaults.instanceName;
};

const getInstanceKey = (apiKey: string, config: ExperimentConfig): string => {
  // Store instances by appending the instance name and api key. Allows for
  // initializing multiple default instances for different api keys.
  const instanceName = getInstanceName(config);
  // The internal instance name prefix is used by web experiment to differentiate
  // web and feature experiment sdks which use the same api key.
  const internalInstanceNameSuffix = config?.['internalInstanceNameSuffix'];
  return internalInstanceNameSuffix
    ? `${instanceName}.${apiKey}.${internalInstanceNameSuffix}`
    : `${instanceName}.${apiKey}`;
};

const newExperimentClient = (
  apiKey: string,
  config: ExperimentConfig,
): ExperimentClient => {
  return new ExperimentClient(apiKey, {
    ...config,
    userProvider:
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      config?.defaultUserProvider ??
      new DefaultUserProvider(config?.userProvider, apiKey),
  });
};

const _initialize = (
  apiKey: string,
  config?: ExperimentConfig,
  plugin?: () => ExperimentPlugin,
): ExperimentClient => {
  const instanceKey = getInstanceKey(apiKey, config);
  let client = instances[instanceKey];
  if (client) {
    return client;
  }
  client = newExperimentClient(apiKey, config);
  if (plugin) {
    client.addPlugin(plugin());
  }
  instances[instanceKey] = client;
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
