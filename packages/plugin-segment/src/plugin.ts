import type {
  ExperimentEvent,
  ExperimentUser,
  IntegrationPlugin,
} from '@amplitude/experiment-js-client';

import { safeGlobal } from './global';
import { snippetInstance } from './snippet';
import { Options, SegmentIntegrationPlugin } from './types/plugin';

export const segmentIntegrationPlugin: SegmentIntegrationPlugin = (
  options: Options = {},
) => {
  const getInstance = () => {
    return options.instance || snippetInstance(options.instanceKey);
  };
  getInstance();
  const plugin: IntegrationPlugin = {
    name: '@amplitude/experiment-plugin-segment',
    type: 'integration',
    setup(): Promise<void> {
      const instance = getInstance();
      return new Promise<void>((resolve) => instance.ready(() => resolve()));
    },
    getUser(): ExperimentUser {
      const instance = getInstance();
      if (instance.initialized) {
        return {
          user_id: instance.user().id(),
          device_id: instance.user().anonymousId(),
          user_properties: instance.user().traits(),
        };
      }
      const get = (key: string) => {
        return JSON.parse(safeGlobal.localStorage.getItem(key)) || undefined;
      };
      return {
        user_id: get('ajs_user_id'),
        device_id: get('ajs_anonymous_id'),
        user_properties: get('ajs_user_traits'),
      };
    },
    track(event: ExperimentEvent): boolean {
      const instance = getInstance();
      if (!instance.initialized) return false;
      instance.track(event.eventType, event.eventProperties);
      return true;
    },
  };
  if (options.skipSetup) {
    plugin.setup = undefined;
  }

  return plugin;
};
