import { ContextProvider } from '../types/context';

type AmplitudeInstance = {
  options?: AmplitudeOptions;
  _ua?: AmplitudeUAParser;
};

type AmplitudeOptions = {
  deviceId?: string;
  userId?: string;
  versionName?: string;
  language?: string;
  platform?: string;
};

type AmplitudeUAParser = {
  browser?: {
    name?: string;
    major?: string;
  };
  os?: {
    name?: string;
  };
};

/**
 * An AmplitudeContextProvider injects information from the Amplitude SDK into
 * the {@link SkylabUser} object before sending a request to the server.
 * @category Context Provider
 */
export class AmplitudeContextProvider implements ContextProvider {
  private amplitudeInstance: AmplitudeInstance;
  constructor(amplitudeInstance: AmplitudeInstance) {
    this.amplitudeInstance = amplitudeInstance;
  }
  getDeviceId(): string {
    return this.amplitudeInstance?.options?.deviceId;
  }
  getUserId(): string {
    return this.amplitudeInstance?.options?.userId;
  }
  getVersion(): string {
    return this.amplitudeInstance?.options?.versionName;
  }
  getLanguage(): string {
    return this.amplitudeInstance?.options?.language;
  }
  getPlatform(): string {
    return this.amplitudeInstance?.options?.platform;
  }
  getOs(): string {
    return [
      this.amplitudeInstance?._ua?.browser?.name,
      this.amplitudeInstance?._ua?.browser?.major,
    ]
      .filter((e) => e !== null && e !== undefined)
      .join(' ');
  }
  getDeviceModel(): string {
    return this.amplitudeInstance?._ua?.os?.name;
  }
}
