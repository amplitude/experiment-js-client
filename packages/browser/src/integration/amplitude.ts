import {
  ExperimentAnalyticsEvent,
  ExperimentAnalyticsProvider,
} from '../types/analytics';
import { ExperimentUserProvider } from '../types/provider';
import { ExperimentUser } from '../types/user';

type AmplitudeIdentify = {
  set(property: string, value: unknown): void;
  unset(property: string): void;
};

type AmplitudeInstance = {
  options?: AmplitudeOptions;
  _ua?: AmplitudeUAParser;
  logEvent(eventName: string, properties: Record<string, string>): void;
  setUserProperties(userProperties: Record<string, unknown>): void;
  identify(identify: AmplitudeIdentify): void;
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
 * @deprecated Update your version of the amplitude analytics-js SDK to 8.17.0+ and for seamless
 * integration with the amplitude analytics SDK.
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
 * @deprecated Update your version of the amplitude analytics-js SDK to 8.17.0+ and for seamless
 * integration with the amplitude analytics SDK.
 */
export class AmplitudeAnalyticsProvider implements ExperimentAnalyticsProvider {
  private readonly amplitudeInstance: AmplitudeInstance;
  constructor(amplitudeInstance: AmplitudeInstance) {
    this.amplitudeInstance = amplitudeInstance;
  }

  track(event: ExperimentAnalyticsEvent): void {
    this.amplitudeInstance.logEvent(event.name, event.properties);
  }

  setUserProperty(event: ExperimentAnalyticsEvent): void {
    // if the variant has a value, set the user property and log an event
    this.amplitudeInstance.setUserProperties({
      [event.userProperty]: event.variant?.value,
    });
  }

  unsetUserProperty(event: ExperimentAnalyticsEvent): void {
    // if the variant does not have a value, unset the user property
    this.amplitudeInstance['_logEvent']('$identify', null, null, {
      $unset: { [event.userProperty]: '-' },
    });
  }
}
