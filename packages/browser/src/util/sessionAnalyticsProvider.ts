import { ExperimentAnalyticsEvent } from '../types/analytics';
import { ExperimentAnalyticsProvider } from '../types/provider';

/**
 * A wrapper for an analytics provider which only sends one exposure event per
 * flag, per variant, per session. In other words, wrapping an analytics
 * provider in this class will prevent the same exposure event to be sent twice
 * in one session.
 */
export class SessionAnalyticsProvider implements ExperimentAnalyticsProvider {
  private readonly analyticsProvider: ExperimentAnalyticsProvider;

  // In memory record of flagKey and variant value to in order to only set
  // user properties and track an exposure event once per session unless the
  // variant value changes
  private readonly setProperties: Record<string, string> = {};
  private readonly unsetProperties: Record<string, string> = {};

  constructor(analyticsProvider: ExperimentAnalyticsProvider) {
    this.analyticsProvider = analyticsProvider;
  }

  track(event: ExperimentAnalyticsEvent): void {
    if (this.setProperties[event.key] == event.variant.value) {
      return;
    } else {
      this.setProperties[event.key] = event.variant.value;
      delete this.unsetProperties[event.key];
    }
    this.analyticsProvider.track(event);
  }

  setUserProperty?(event: ExperimentAnalyticsEvent): void {
    if (this.setProperties[event.key] == event.variant.value) {
      return;
    }
    this.analyticsProvider.setUserProperty(event);
  }

  unsetUserProperty?(event: ExperimentAnalyticsEvent): void {
    if (this.unsetProperties[event.key]) {
      return;
    } else {
      this.unsetProperties[event.key] = 'unset';
      delete this.setProperties[event.key];
    }
    this.analyticsProvider.unsetUserProperty(event);
  }
}
