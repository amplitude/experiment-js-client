import {
  AnalyticsConnector,
  AnalyticsEvent,
  IdentityStore,
} from '@amplitude/amplitude-core';

import { ExperimentAnalyticsEvent } from '../types/analytics';
import {
  ExperimentAnalyticsProvider,
  ExperimentUserProvider,
} from '../types/provider';
import { ExperimentUser } from '../types/user';

type UserProperties = Record<
  string,
  string | number | boolean | Array<string | number | boolean>
>;

export class CoreUserProvider implements ExperimentUserProvider {
  private readonly identityStore: IdentityStore;
  constructor(identityStore: IdentityStore) {
    this.identityStore = identityStore;
  }

  async identityReady(): Promise<void> {
    const identity = this.identityStore.getIdentity();
    if (!identity.userId && !identity.deviceId) {
      return new Promise((resolve) => {
        const listener = () => {
          resolve();
          this.identityStore.removeIdentityListener(listener);
        };
        this.identityStore.addIdentityListener(listener);
      });
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
      // TODO: Other contextual info, should be contained in core
    };
  }
}

export class CoreAnalyticsProvider implements ExperimentAnalyticsProvider {
  private readonly analyticsConnector: AnalyticsConnector;

  constructor(analyticsConnector: AnalyticsConnector) {
    this.analyticsConnector = analyticsConnector;
  }

  track(event: ExperimentAnalyticsEvent): void {
    const analyticsEvent: AnalyticsEvent = {
      eventType: event.name,
      eventProperties: event.properties,
      userProperties: { $set: { [event.userProperty]: event.variant.value } },
    };
    this.analyticsConnector.logEvent(analyticsEvent);
  }

  setUserProperty?(event: ExperimentAnalyticsEvent): void {
    const analyticsEvent: AnalyticsEvent = {
      eventType: '$identify',
      userProperties: {
        $set: { [event.userProperty]: event.variant.value },
      },
    };
    this.analyticsConnector.logEvent(analyticsEvent);
  }

  unsetUserProperty?(event: ExperimentAnalyticsEvent): void {
    const analyticsEvent: AnalyticsEvent = {
      eventType: '$identify',
      userProperties: {
        $unset: { [event.userProperty]: event.variant.value },
      },
    };
    this.analyticsConnector.logEvent(analyticsEvent);
  }
}
