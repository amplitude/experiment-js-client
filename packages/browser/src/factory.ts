import { Defaults, SkylabConfig } from './config';
import { SkylabClient } from './skylabClient';
import { normalizeInstanceName } from './util/normalize';

const instances = {};

/**
 * Initializes a singleton {@link SkylabClient} identified by the value of
 * `config.name`, defaulting to {@link Defaults}. Instance names are case
 * _insensitive_.
 * @param apiKey The environment API Key
 * @param config See {@link SkylabConfig} for config options
 */
const init = (apiKey: string, config?: SkylabConfig): SkylabClient => {
  const normalizedName = normalizeInstanceName(
    config?.instanceName || Defaults.instanceName,
  );
  if (!instances[normalizedName]) {
    instances[normalizedName] = new SkylabClient(apiKey, config);
  }
  return instances[normalizedName];
};

/**
 * Returns the singleton {@link SkylabClient} instance associated with the given name.
 * @param name The instance name. Omit to get the default instance. Instance names are case
 * _insensitive_.
 */
const instance = (name: string = Defaults.instanceName): SkylabClient => {
  const normalizedName = normalizeInstanceName(name) || Defaults.instanceName;
  return instances[normalizedName];
};

/**
 * Provides factory methods for storing singleton instances of {@link SkylabClient}
 * @category Core Usage
 */
export const Skylab = {
  init,
  instance,
};
