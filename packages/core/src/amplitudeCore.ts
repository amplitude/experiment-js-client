import { AnalyticsConnectorImpl } from './analyticsConnector';
import { IdentityStoreImpl } from './identityStore';
import { safeGlobal } from './util/global';

safeGlobal['amplitudeCoreInstances'] = {};

export class AmplitudeCore {
  public readonly identityStore = new IdentityStoreImpl();
  public readonly analyticsConnector = new AnalyticsConnectorImpl();
}

export const getAmplitudeCore = (instanceName: string): AmplitudeCore => {
  if (!safeGlobal['amplitudeCoreInstances'][instanceName]) {
    safeGlobal['amplitudeCoreInstances'][instanceName] = new AmplitudeCore();
  }
  return safeGlobal['amplitudeCoreInstances'][instanceName];
};
