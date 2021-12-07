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
      // TODO: Other contextual info
    };
  }
}

export class CoreAnalyticsProvider implements ExperimentAnalyticsProvider {
  private readonly analyticsConnector: AnalyticsConnector;

  // In memory record of flagKey and variant value to in order to only set
  // user properties and track an exposure event once per session unless the
  // variant value changes
  private readonly exposures: Record<string, string> = {};

  constructor(analyticsConnector: AnalyticsConnector) {
    this.analyticsConnector = analyticsConnector;
  }

  track(event: ExperimentAnalyticsEvent): void {
    if (this.hasAlreadyBeenExposedTo(event.key, event.variant.value)) {
      return;
    } else {
      this.exposures[event.key] = event.variant.value;
    }
    const analyticsEvent: AnalyticsEvent = {
      eventType: event.name,
      eventProperties: event.properties,
      userProperties: { $set: { [event.userProperty]: event.variant.value } },
    };
    this.analyticsConnector.logEvent(analyticsEvent);
  }

  setUserProperty?(event: ExperimentAnalyticsEvent): void {
    if (this.hasAlreadyBeenExposedTo(event.key, event.variant.value)) {
      return;
    }
    const analyticsEvent: AnalyticsEvent = {
      eventType: '$identify',
      userProperties: {
        $set: { [event.userProperty]: event.variant.value },
      },
    };
    this.analyticsConnector.logEvent(analyticsEvent);
  }

  unsetUserProperty?(event: ExperimentAnalyticsEvent): void {
    delete this.exposures[event.key];
    const analyticsEvent: AnalyticsEvent = {
      eventType: '$identify',
      userProperties: {
        $unset: { [event.userProperty]: event.variant.value },
      },
    };
    this.analyticsConnector.logEvent(analyticsEvent);
  }

  private hasAlreadyBeenExposedTo(flagKey: string, value: string): boolean {
    return this.exposures && this.exposures[flagKey] == value;
  }
}
