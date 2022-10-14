import { ApplicationContextProvider } from '@amplitude/analytics-connector';

import { ExperimentUserProvider } from '../types/provider';
import { ExperimentUser } from '../types/user';

export class DefaultUserProvider implements ExperimentUserProvider {
  private readonly contextProvider: ApplicationContextProvider;
  constructor(applicationContextProvider: ApplicationContextProvider) {
    this.contextProvider = applicationContextProvider;
  }

  getUser(): ExperimentUser {
    const context = this.contextProvider.getApplicationContext();
    return {
      version: context.versionName,
      language: context.language,
      platform: context.platform,
      os: context.os,
      device_model: context.deviceModel,
    };
  }
}
