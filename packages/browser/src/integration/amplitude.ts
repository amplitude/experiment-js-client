import {
  ExperimentUserProvider,
  ExperimentTrackingProvider,
} from '../types/provider';
import { ExperimentUser } from '../types/user';

type AmplitudeInstance = {
  options?: AmplitudeOptions;
  _ua?: AmplitudeUAParser;
  logEvent(eventName: string, properties: Record<string, string>): void;
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
 * An AmplitudeUserProvider injects information from the Amplitude SDK into
 * the {@link ExperimentUser} object before sending a request to the server.
 * @category Context Provider
 */
export class AmplitudeUserProvider implements ExperimentUserProvider {
  private amplitudeInstance: AmplitudeInstance;
  constructor(amplitudeInstance: AmplitudeInstance) {
    this.amplitudeInstance = amplitudeInstance;
  }

  getUser(): ExperimentUser {
    return {
      device_id: this.amplitudeInstance?.options?.deviceId,
      user_id: this.amplitudeInstance?.options?.userId,
      version: this.amplitudeInstance?.options?.versionName,
      language: this.amplitudeInstance?.options?.language,
      platform: this.amplitudeInstance?.options?.platform,
      os: this.getOs(),
      device_model: this.getDeviceModel(),
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

/**
 * Provides a tracking implementation for standard experiment events generated
 * by the client (e.g. exposure).
 */
export class AmplitudeTrackingProvider implements ExperimentTrackingProvider {
  private amplitudeInstance: AmplitudeInstance;
  constructor(amplitudeInstance: AmplitudeInstance) {
    this.amplitudeInstance = amplitudeInstance;
  }

  track(eventName: string, properties: Record<string, string>): void {
    this.amplitudeInstance.logEvent(eventName, properties);
  }
}
