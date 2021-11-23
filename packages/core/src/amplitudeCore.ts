import {
  AnalyticsConnector,
  AnalyticsConnectorImpl,
} from './analyticsConnector';
import { IdentityStore, IdentityStoreImpl } from './identityStore';
import { safeGlobal } from './util/global';

safeGlobal['amplitudeCoreInstances'] = {};

export class AmplitudeCore {
  identityStore: IdentityStore = new IdentityStoreImpl();
  analyticsConnector: AnalyticsConnector = new AnalyticsConnectorImpl();
}

export const getAmpltudeCore = (instanceName: string): AmplitudeCore => {
  if (!safeGlobal['amplitudeCoreInstances'][instanceName]) {
    safeGlobal['amplitudeCoreInstances'][instanceName] = new AmplitudeCore();
  }
  return safeGlobal['amplitudeCoreInstances'][instanceName];
};
