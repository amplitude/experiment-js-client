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
  let ready = false;
  const plugin: IntegrationPlugin = {
    name: '@amplitude/experiment-plugin-segment',
    type: 'integration',
    setup(): Promise<void> {
      const instance = getInstance();
      return new Promise<void>((resolve) => {
        instance.ready(() => {
          ready = true;
          resolve();
        });
        // If the segment SDK is installed via the @segment/analytics-next npm
        // package then function calls to the snippet are not respected.
        if (!options.instance) {
          const interval = safeGlobal.setInterval(() => {
            const instance = getInstance();
            if (instance.initialized) {
              ready = true;
              safeGlobal.clearInterval(interval);
              resolve();
            }
          }, 50);
        }
      });
    },
    getUser(): ExperimentUser {
      const instance = getInstance();
      if (ready) {
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
      if (!ready) return false;
      instance.track(event.eventType, event.eventProperties);
      return true;
    },
  };
  if (options.skipSetup) {
    plugin.setup = undefined;
  }

  return plugin;
};

safeGlobal.experimentIntegration = segmentIntegrationPlugin();
