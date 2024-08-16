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
      device_category: this.ua.device?.type ?? 'desktop',
      referring_url: document?.referrer.replace(/\/$/, ''),
      cookie: this.getCookie(),
      browser: this.getBrowser(this.ua),
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

  private getBrowser(ua: UAParser): string {
    let browser = ua.browser?.name;
    // Normalize for Chrome, Firefox, Safari, Edge, and Opera.
    if (browser?.includes('Chrom')) browser = 'Chrome'; // Chrome, Chrome Mobile, Chromium, etc
    if (browser?.includes('Firefox')) browser = 'Firefox'; // Firefox, Firefox Mobile, etc
    if (browser?.includes('Safari')) browser = 'Safari'; // Safari, Safari Mobile
    if (browser?.includes('Edge')) browser = 'Edge'; // Edge
    if (browser?.includes('Opera')) browser = 'Opera'; // Opera, Opera Mobi, etc
    return browser;
  }

  private getCookie(): Record<string, string> {
    if (!document?.cookie) {
      return undefined;
    }
    return Object.fromEntries(
      document?.cookie?.split('; ').map((c) => c.split('=')),
    );
  }
}
