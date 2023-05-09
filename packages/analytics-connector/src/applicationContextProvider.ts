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
  public versionName: string;
  getApplicationContext(): ApplicationContext {
    return {
      versionName: this.versionName,
      language: getLanguage(),
      platform: 'Web',
      os: undefined,
      deviceModel: undefined,
    };
  }
}

const getLanguage = (): string => {
  return (
    (typeof navigator !== 'undefined' &&
      ((navigator.languages && navigator.languages[0]) ||
        navigator.language)) ||
    ''
  );
};
