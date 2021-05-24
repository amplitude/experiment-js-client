/**
 * A ContextProvider injects information into the {@link SkylabUser} object
 * before sending a request to the server. This can be used to pass
 * identity (deviceId and userId), or other platform specific context.
 * @category Context Provider
 */
export interface ContextProvider {
  // identity related context
  getDeviceId(): string;
  getUserId(): string;

  // platform related context
  getVersion(): string;
  getLanguage(): string;
  getPlatform(): string;
  getOs(): string;
  getDeviceModel(): string;
}
