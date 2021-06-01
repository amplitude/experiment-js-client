import { ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';

const instances = {};

// TODO this is defined twice, figure something better out.
const defaultInstance = '$default_instance';

/**
 * Initializes a singleton {@link ExperimentClient} identified by the api-key.
 *
 * @param apiKey The environment API Key
 * @param config See {@link ExperimentConfig} for config options
 */
const initialize = (
  apiKey: string,
  config?: ExperimentConfig,
): ExperimentClient => {
  if (!instances[defaultInstance]) {
    instances[defaultInstance] = new ExperimentClient(apiKey, config);
  }
  return instances[defaultInstance];
};

/**
 * Provides factory methods for storing singleton instances of {@link ExperimentClient}
 * @category Core Usage
 */
export const Experiment = {
  initialize,
};
