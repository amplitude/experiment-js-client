import { Defaults, ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import { normalizeInstanceName } from './util/normalize';

const instances = {};

/**
 * Initializes a singleton {@link ExperimentClient} identified by the value of
 * `config.name`, defaulting to {@link Defaults}. Instance names are case
 * _insensitive_.
 * @param apiKey The environment API Key
 * @param config See {@link ExperimentConfig} for config options
 */
const init = (apiKey: string, config?: ExperimentConfig): ExperimentClient => {
  const normalizedName = normalizeInstanceName(
    config?.instanceName || Defaults.instanceName,
  );
  if (!instances[normalizedName]) {
    instances[normalizedName] = new ExperimentClient(apiKey, config);
  }
  return instances[normalizedName];
};

/**
 * Returns the singleton {@link ExperimentClient} instance associated with the given name.
 * @param name The instance name. Omit to get the default instance. Instance names are case
 * _insensitive_.
 */
const instance = (name: string = Defaults.instanceName): ExperimentClient => {
  const normalizedName = normalizeInstanceName(name) || Defaults.instanceName;
  return instances[normalizedName];
};

/**
 * Provides factory methods for storing singleton instances of {@link ExperimentClient}
 * @category Core Usage
 */
export const Experiment = {
  init,
  instance,
};
