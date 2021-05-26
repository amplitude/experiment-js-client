export interface ExperimentContext {
  deviceId?: string;
  userId?: string;
  version?: string;
  language?: string;
  platform?: string;
  os?: string;
  deviceModel?: string;
}

/**
 * A ContextProvider injects information into the {@link ExperimentUser} object
 * before sending a request to the server. This can be used to pass
 * identity (deviceId and userId), or other platform specific context.
 * @category Context Provider
 */
export interface ContextProvider {
  getContext(): ExperimentContext;
}
