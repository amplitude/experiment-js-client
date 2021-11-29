import { AnalyticsConnectorImpl } from './analyticsConnector';
import { IdentityStoreImpl } from './identityStore';
import { safeGlobal } from './util/global';

safeGlobal['amplitudeCoreInstances'] = {};

// export enum ComponentName {
//   IdentityStore = 'IdentityStore',
//   AnalyticsConnector = 'AnalyticsConnector',
// }

// type ComponentConsumer<T> = (component: T) => void;

export class AmplitudeCore {
  public readonly identityStore = new IdentityStoreImpl();
  public readonly analyticsConnector = new AnalyticsConnectorImpl();

  // private components: Record<string, unknown> = {};
  // private consumers: Record<string, ComponentConsumer<unknown>[]> = {};

  // constructor() {
  //   this.produce(ComponentName.IdentityStore, new IdentityStoreImpl());
  //   this.produce(
  //     ComponentName.AnalyticsConnector,
  //     new AnalyticsConnectorImpl(),
  //   );
  // }

  // public consume<T>(name: ComponentName, callback: ComponentConsumer<T>): void {
  //   const component = this.components[name];
  //   if (component) {
  //     callback(component as T);
  //   } else {
  //     if (!this.consumers[name]) {
  //       this.consumers[name] = [];
  //     }
  //     this.consumers[name].push(callback);
  //   }
  // }

  // public produce<T>(name: ComponentName, component: T): void {
  //   if (this.components[name]) {
  //     return;
  //   }
  //   this.components[name] = component;
  //   const consumers = this.consumers[name];
  //   if (consumers) {
  //     for (const consumer of Object.values(consumers)) {
  //       consumer(component as T);
  //     }
  //   }
  // }
}

export const getAmpltudeCore = (instanceName: string): AmplitudeCore => {
  if (!safeGlobal['amplitudeCoreInstances'][instanceName]) {
    safeGlobal['amplitudeCoreInstances'][instanceName] = new AmplitudeCore();
  }
  return safeGlobal['amplitudeCoreInstances'][instanceName];
};
