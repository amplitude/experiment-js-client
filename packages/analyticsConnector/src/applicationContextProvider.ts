import { UAParser } from '@amplitude/ua-parser-js';

export type ApplicationContext = {
  versionName?: string;
  language?: string;
  platform?: string;
  os?: string;
  deviceModel?: string;
};

export interface ApplicationContextProvider {
  versionName: string;
  getApplicationContext(): ApplicationContext;
}

export class ApplicationContextProviderImpl
  implements ApplicationContextProvider
{
  private readonly ua = new UAParser(navigator.userAgent).getResult();
  public versionName: string;
  getApplicationContext(): ApplicationContext {
    return {
      versionName: this.versionName,
      language: getLanguage(),
      platform: 'Web',
      os: getOs(this.ua),
      deviceModel: getDeviceModel(this.ua),
    };
  }
}

const getOs = (ua: UAParser): string => {
  return [ua.browser?.name, ua.browser?.major]
    .filter((e) => e !== null && e !== undefined)
    .join(' ');
};

const getDeviceModel = (ua: UAParser): string => {
  return ua.os?.name;
};

const getLanguage = (): string => {
  return (
    (typeof navigator !== 'undefined' &&
      ((navigator.languages && navigator.languages[0]) ||
        navigator.language)) ||
    ''
  );
};
