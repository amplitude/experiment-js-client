import { ApplicationContextProvider } from '@amplitude/analytics-connector';
import { UAParser } from '@amplitude/ua-parser-js';

import { ExperimentUserProvider } from '../types/provider';
import { ExperimentUser } from '../types/user';

export class DefaultUserProvider implements ExperimentUserProvider {
  private readonly ua = new UAParser(
    typeof navigator !== 'undefined' ? navigator.userAgent : null,
  ).getResult();
  private readonly contextProvider: ApplicationContextProvider;
  public readonly userProvider: ExperimentUserProvider | undefined;
  constructor(
    applicationContextProvider: ApplicationContextProvider,
    userProvider?: ExperimentUserProvider,
  ) {
    this.contextProvider = applicationContextProvider;
    this.userProvider = userProvider;
  }

  getUser(): ExperimentUser {
    const user = this.userProvider?.getUser() || {};
    const context = this.contextProvider.getApplicationContext();
    return {
      version: context.versionName,
      language: context.language,
      platform: context.platform,
      os: context.os || this.getOs(this.ua),
      device_model: context.deviceModel || this.getDeviceModel(this.ua),
      ...user,
    };
  }

  private getOs(ua: UAParser): string {
    return [ua.browser?.name, ua.browser?.major]
      .filter((e) => e !== null && e !== undefined)
      .join(' ');
  }

  private getDeviceModel(ua: UAParser): string | undefined {
    return ua.os?.name;
  }
}
