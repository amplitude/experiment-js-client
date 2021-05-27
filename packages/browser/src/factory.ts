import { ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import { getLocalStorageInstance } from './storage/localStorage';

/**
 * Initializes a singleton {@link ExperimentClient} identified by the value of
 * `config.name`, defaulting to {@link Defaults}. Instance names are case
 * _insensitive_.
 * @param apiKey The environment API Key
 * @param config See {@link ExperimentConfig} for config options
 */
const initialize = (
  apiKey: string,
  config?: ExperimentConfig,
): ExperimentClient => {
  const storage = getLocalStorageInstance(apiKey);
  return new ExperimentClient(apiKey, config, storage);
};

/**
 * Provides factory methods for storing singleton instances of {@link ExperimentClient}
 * @category Core Usage
 */
export const Experiment = {
  initialize,
};
