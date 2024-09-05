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
    // If the eventBridge is using old implementation, update with new instance
    if (!instance.eventBridge.setInstanceName) {
      const queue = instance.eventBridge.queue ?? [];
      const receiver = instance.eventBridge.receiver;
      instance.eventBridge = new EventBridgeImpl();
      instance.eventBridge.setInstanceName(instanceName);
      // handle case when receiver was not set during previous initialization
      if (receiver) {
        instance.eventBridge.setEventReceiver(receiver);
      }
      for (const event of queue) {
        instance.eventBridge.logEvent(event);
      }
    }
    return instance;
  }
}
