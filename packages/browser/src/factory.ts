import { ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import { normalizeInstanceName } from './util/normalize';

const defaultInstanceName = '$default_instance';
const instances = {};

/**
 * Initializes a singleton {@link ExperimentClient} identified by the value of
 * `config.name`, defaulting to {@link Defaults}. Instance names are case
 * _insensitive_.
 * @param apiKey The environment API Key
 * @param config See {@link ExperimentConfig} for config options
 */
const instance = (config?: ExperimentConfig): ExperimentClient => {
  const normalizedName = normalizeInstanceName(defaultInstanceName);
  if (!instances[normalizedName]) {
    if (!config) {
      throw Error(
        'Initial Experiment initiaization must include config with valid API key.',
      );
    }
    instances[normalizedName] = new ExperimentClient(config);
  }
  return instances[normalizedName];
};

/**
 * Provides factory methods for storing singleton instances of {@link ExperimentClient}
 * @category Core Usage
 */
export const Experiment = {
  instance,
};
