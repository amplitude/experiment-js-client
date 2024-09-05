import { ApplicationContextProviderImpl } from './applicationContextProvider';
import { EventBridgeImpl } from './eventBridge';
import { IdentityStoreImpl } from './identityStore';
import { safeGlobal } from './util/global';

export class AnalyticsConnector {
  public readonly identityStore = new IdentityStoreImpl();
  public readonly eventBridge = new EventBridgeImpl();
  public readonly applicationContextProvider =
    new ApplicationContextProviderImpl();

  static getInstance(instanceName: string): AnalyticsConnector {
    if (!safeGlobal['analyticsConnectorInstances']) {
      safeGlobal['analyticsConnectorInstances'] = {};
    }
    if (!safeGlobal['analyticsConnectorInstances'][instanceName]) {
      safeGlobal['analyticsConnectorInstances'][instanceName] =
        new AnalyticsConnector();
    }
    const instance = safeGlobal['analyticsConnectorInstances'][instanceName];
    if (!instance.eventBridge.setInstanceName) {
      const queue = instance.eventBridge.queue ?? [];
      const receiver = instance.eventBridge.receiver;
      instance.eventBridge = new EventBridgeImpl();
      for (const event in queue) {
        instance.eventBridge.logEvent(event);
      }
      instance.eventBridge.setEventReceiver(receiver);
    }
    return instance;
  }
}
