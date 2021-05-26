import { ContextProvider, ExperimentContext } from '../types/context';

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
 * the {@link ExperimentUser} object before sending a request to the server.
 * @category Context Provider
 */
export class AmplitudeContextProvider implements ContextProvider {
  private amplitudeInstance: AmplitudeInstance;
  constructor(amplitudeInstance: AmplitudeInstance) {
    this.amplitudeInstance = amplitudeInstance;
  }

  getContext(): ExperimentContext {
    return {
      deviceId: this.amplitudeInstance?.options?.deviceId,
      userId: this.amplitudeInstance?.options?.userId,
      version: this.amplitudeInstance?.options?.versionName,
      language: this.amplitudeInstance?.options?.language,
      platform: this.amplitudeInstance?.options?.platform,
      os: this.getOs(),
      deviceModel: this.getDeviceModel(),
    };
  }

  private getOs(): string {
    return [
      this.amplitudeInstance?._ua?.browser?.name,
      this.amplitudeInstance?._ua?.browser?.major,
    ]
      .filter((e) => e !== null && e !== undefined)
      .join(' ');
  }

  private getDeviceModel(): string {
    return this.amplitudeInstance?._ua?.os?.name;
  }
}
