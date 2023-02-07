import { ApplicationContextProvider } from '@amplitude/analytics-connector';

import { ExperimentUserProvider } from '../types/provider';
import { ExperimentUser } from '../types/user';

export class DefaultUserProvider implements ExperimentUserProvider {
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
      os: context.os,
      device_model: context.deviceModel,
      ...user,
    };
  }
}
