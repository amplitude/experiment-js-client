import { getGlobalScope } from '@amplitude/experiment-core';
import { UAParser } from '@amplitude/ua-parser-js';

import { LocalStorage } from '../storage/local-storage';
import { SessionStorage } from '../storage/session-storage';
import { ExperimentUserProvider } from '../types/provider';
import { ExperimentUser } from '../types/user';

export class DefaultUserProvider implements ExperimentUserProvider {
  globalScope = getGlobalScope();
  private readonly userAgent: string =
    typeof this.globalScope?.navigator !== 'undefined'
      ? this.globalScope?.navigator.userAgent
      : undefined;
  private readonly ua = new UAParser(this.userAgent).getResult();
  private readonly localStorage = new LocalStorage();
  private readonly sessionStorage = new SessionStorage();
  private readonly storageKey: string;

  public readonly userProvider: ExperimentUserProvider | undefined;
  private readonly apiKey?: string;
  /**
   * When provided and returning false, `landing_url` and `first_seen` are
   * computed for the current call without reading or writing web storage.
   * Used by experiment-tag while cookie consent is withheld — it supplies its
   * own consent-managed `first_seen` via the user object (which wins the
   * merge), so nothing is lost by not persisting here.
   */
  private readonly persistenceAllowed?: () => boolean;
  /**
   * The first URL seen while persistence was gated, so an SPA navigation
   * before consent resolves doesn't shift the reported (or later persisted)
   * landing page.
   */
  private gatedLandingUrl?: string;

  constructor(
    userProvider?: ExperimentUserProvider,
    apiKey?: string,
    persistenceAllowed?: () => boolean,
  ) {
    this.userProvider = userProvider;
    this.apiKey = apiKey;
    this.persistenceAllowed = persistenceAllowed;
    this.storageKey = `EXP_${this.apiKey?.slice(0, 10)}_DEFAULT_USER_PROVIDER`;
  }

  private canPersist(): boolean {
    return this.persistenceAllowed ? this.persistenceAllowed() : true;
  }

  getUser(): ExperimentUser {
    const user = this.userProvider?.getUser() || {};
    return {
      language: this.getLanguage(),
      platform: 'Web',
      os: this.getOs(this.ua),
      device_model: this.getDeviceModel(this.ua),
      device_category: this.ua.device?.type ?? 'desktop',
      referring_url: this.globalScope?.document?.referrer.replace(/\/$/, ''),
      cookie: this.getCookie(),
      browser: this.getBrowser(this.ua),
      landing_url: this.getLandingUrl(),
      first_seen: this.getFirstSeen(),
      url_param: this.getUrlParam(),
      user_agent: this.userAgent,
      ...user,
    };
  }

  private getLanguage(): string {
    return (
      (typeof navigator !== 'undefined' &&
        ((navigator.languages && navigator.languages[0]) ||
          navigator.language)) ||
      ''
    );
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
    // Reads are gated with writes: while consent is withheld, cookies an
    // earlier consented visit left behind (experiment identity, analytics
    // device ids) must not enter the evaluation context.
    if (!this.canPersist()) {
      return undefined;
    }
    if (!this.globalScope?.document?.cookie) {
      return undefined;
    }
    return Object.fromEntries(
      this.globalScope?.document?.cookie?.split('; ').map((c) => c.split('=')),
    );
  }

  private getLandingUrl(): string | undefined {
    if (!this.canPersist()) {
      // Storage is gated (reads included): report the first URL of this
      // page's life without touching the per-session record.
      this.gatedLandingUrl ??= this.getCurrentUrl();
      return this.gatedLandingUrl;
    }
    try {
      const sessionUser = JSON.parse(
        this.sessionStorage.get(this.storageKey) || '{}',
      );
      if (!sessionUser.landing_url) {
        // Prefer the URL remembered from the gated window, so a grant after
        // an SPA navigation persists where the visitor actually landed.
        sessionUser.landing_url = this.gatedLandingUrl ?? this.getCurrentUrl();
        this.sessionStorage.put(this.storageKey, JSON.stringify(sessionUser));
      }
      return sessionUser.landing_url;
    } catch {
      return undefined;
    }
  }

  private getCurrentUrl(): string | undefined {
    return this.globalScope?.location?.href.replace(/\/$/, '');
  }

  private getFirstSeen(): string | undefined {
    if (!this.canPersist()) {
      // Storage is gated: mint a per-call value rather than persist one.
      // experiment-tag manages first_seen itself and overrides this via the
      // user-object merge.
      return (Date.now() / 1000).toString();
    }
    try {
      const localUser = JSON.parse(
        this.localStorage.get(this.storageKey) || '{}',
      );
      if (!localUser.first_seen) {
        localUser.first_seen = (Date.now() / 1000).toString();
        this.localStorage.put(this.storageKey, JSON.stringify(localUser));
      }
      return localUser.first_seen;
    } catch {
      return undefined;
    }
  }

  private getUrlParam(): Record<string, string | string[]> {
    if (!this.globalScope) {
      return undefined;
    }

    const params: Record<string, string[]> = {};

    try {
      const url = new URL(this.globalScope.location.href);
      for (const [name, value] of url.searchParams) {
        params[name] = [...(params[name] ?? []), ...value.split(',')];
      }
    } catch (error) {
      return undefined;
    }

    return Object.entries(params).reduce<Record<string, string | string[]>>(
      (acc, [name, value]) => {
        acc[name] = value.length == 1 ? value[0] : value;
        return acc;
      },
      {},
    );
  }
}
