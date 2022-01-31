import { ApplicationContextProviderImpl } from './applicationContextProvider';
import { EventBridgeImpl } from './eventBridge';
import { IdentityStoreImpl } from './identityStore';
import { safeGlobal } from './util/global';

safeGlobal['analyticsConnectorInstances'] = {};

export class AnalyticsConnector {
  public readonly identityStore = new IdentityStoreImpl();
  public readonly analyticsConnector = new EventBridgeImpl();
  public readonly applicationContextProvider =
    new ApplicationContextProviderImpl();

  static getInstance(instanceName: string): AnalyticsConnector {
    if (!safeGlobal['analyticsConnectorInstances'][instanceName]) {
      safeGlobal['analyticsConnectorInstances'][instanceName] =
        new AnalyticsConnector();
    }
    return safeGlobal['analyticsConnectorInstances'][instanceName];
  }
}
