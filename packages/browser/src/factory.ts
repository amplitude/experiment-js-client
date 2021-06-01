import { ExperimentConfig } from './config';
import { ExperimentClient } from './experimentClient';
import { LocalStorage } from './storage/localStorage';
import { FetchHttpClient } from './transport/http';

const instances = {};

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
  if (!instances[apiKey]) {
    const storageKey = `amp-sl-${apiKey.substring(apiKey.length - 6)}`;
    instances[apiKey] = new ExperimentClient(
      apiKey,
      config,
      FetchHttpClient,
      new LocalStorage(storageKey),
    );
  }
  return instances[apiKey];
};

/**
 * Provides factory methods for storing singleton instances of {@link ExperimentClient}
 * @category Core Usage
 */
export const Experiment = {
  initialize,
};
