import {
  AnalyticsConnector,
  AnalyticsConnectorImpl,
} from './analyticsConnector';
import { IdentityStore, IdentityStoreImpl } from './identityStore';

export class AmplitudeCore {
  identityStore: IdentityStore = new IdentityStoreImpl();
  analyticsConnector: AnalyticsConnector = new AnalyticsConnectorImpl();

  private static instances: Record<string, AmplitudeCore> = {};
  static getInstance(instanceName: string): AmplitudeCore {
    if (!AmplitudeCore.instances[instanceName]) {
      AmplitudeCore.instances[instanceName] = new AmplitudeCore();
    }
    return AmplitudeCore.instances[instanceName];
  }
}
