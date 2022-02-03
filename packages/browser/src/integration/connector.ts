import {
  EventBridge,
  AnalyticsEvent,
  IdentityStore,
} from '@amplitude/analytics-connector';

import { ExperimentAnalyticsEvent } from '../types/analytics';
import {
  ExperimentAnalyticsProvider,
  ExperimentUserProvider,
} from '../types/provider';
import { ExperimentUser } from '../types/user';
import { safeGlobal } from '../util/global';

type UserProperties = Record<
  string,
  string | number | boolean | Array<string | number | boolean>
>;

export class ConnectorUserProvider implements ExperimentUserProvider {
  private readonly identityStore: IdentityStore;
  constructor(identityStore: IdentityStore) {
    this.identityStore = identityStore;
  }

  async identityReady(ms: number): Promise<unknown> {
    const identity = this.identityStore.getIdentity();
    if (!identity.userId && !identity.deviceId) {
      return Promise.race([
        new Promise((resolve) => {
          const listener = () => {
            resolve();
            this.identityStore.removeIdentityListener(listener);
          };
          this.identityStore.addIdentityListener(listener);
        }),
        new Promise((resolve, reject) => {
          safeGlobal.setTimeout(
            reject,
            ms,
            'Timed out waiting for Amplitude Analytics SDK to initialize. ' +
              'You must ensure that the analytics SDK is initialized prior to calling fetch().',
          );
        }),
      ]);
    }
  }

  getUser(): ExperimentUser {
    const identity = this.identityStore.getIdentity();
    let userProperties: UserProperties = undefined;
    try {
      userProperties = identity.userProperties as UserProperties;
    } catch {
      console.warn('[Experiment] failed to cast user properties');
    }
    return {
      user_id: identity.userId,
      device_id: identity.deviceId,
      user_properties: userProperties,
    };
  }
}

export class ConnectorAnalyticsProvider implements ExperimentAnalyticsProvider {
  private readonly eventBridge: EventBridge;

  constructor(eventBridge: EventBridge) {
    this.eventBridge = eventBridge;
  }

  track(event: ExperimentAnalyticsEvent): void {
    const source = event.properties['source'];
    const variant = isFallback(source) ? null : event.variant.value;
    const analyticsEvent: AnalyticsEvent = {
      eventType: '$exposure',
      eventProperties: {
        flag_key: event.key,
        variant: variant,
      },
    };
    this.eventBridge.logEvent(analyticsEvent);
  }

  unsetUserProperty?(event: ExperimentAnalyticsEvent): void {
    this.track(event);
  }
}

const isFallback = (source: string) => {
  return source === 'fallback-inline' || source === 'fallback-config';
};
