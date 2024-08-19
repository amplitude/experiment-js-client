import { ApplicationContextProvider } from '@amplitude/analytics-connector';
import { UAParser } from '@amplitude/ua-parser-js';

import { LocalStorage } from '../storage/local-storage';
import { SessionStorage } from '../storage/session-storage';
import { ExperimentUserProvider } from '../types/provider';
import { ExperimentUser } from '../types/user';

export class DefaultUserProvider implements ExperimentUserProvider {
  private readonly ua = new UAParser(
    typeof navigator !== 'undefined' ? navigator.userAgent : null,
  ).getResult();
  private readonly localStorage = new LocalStorage();
  private readonly sessionStorage = new SessionStorage();
  private readonly storageKey: string;

  private readonly contextProvider: ApplicationContextProvider;
  public readonly userProvider: ExperimentUserProvider | undefined;
  private readonly apiKey?: string;
  constructor(
    applicationContextProvider: ApplicationContextProvider,
    userProvider?: ExperimentUserProvider,
    apiKey?: string,
  ) {
    this.contextProvider = applicationContextProvider;
    this.userProvider = userProvider;
    this.apiKey = apiKey;
    this.storageKey = `EXP_${this.apiKey?.slice(0, 10)}_DEFAULT_USER_PROVIDER`;
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
      landing_url: this.getLandingUrl(),
      first_seen: this.getFirstSeen(),
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

  private getLandingUrl(): string | undefined {
    try {
      const sessionUser = JSON.parse(
        sessionStorage.getItem(this.storageKey) || '{}',
      );
      if (!sessionUser.landing_url) {
        sessionUser.landing_url = location?.href.replace(/\/$/, '');
        sessionStorage.setItem(this.storageKey, JSON.stringify(sessionUser));
      }
      return sessionUser.landing_url;
    } catch {
      return undefined;
    }
  }

  private getFirstSeen(): string | undefined {
    try {
      const localUser = JSON.parse(
        localStorage.getItem(this.storageKey) || '{}',
      );
      if (!localUser.first_seen) {
        localUser.first_seen = (Date.now() / 1000).toString();
        localStorage.setItem(this.storageKey, JSON.stringify(localUser));
      }
      return localUser.first_seen;
    } catch {
      return undefined;
    }
  }
}
