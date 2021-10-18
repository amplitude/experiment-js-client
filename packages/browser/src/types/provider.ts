import { ExperimentAnalyticsEvent } from './analytics';
import { ExperimentUser } from './user';

/**
 * An ExperimentUserProvider injects information into the {@link ExperimentUser}
 * object before sending a request to the server. This can be used to pass
 * identity (deviceId and userId), or other platform specific context.
 * @category Provider
 */
export interface ExperimentUserProvider {
  getUser(): ExperimentUser;
}

/**
 * Provides a analytics implementation for standard experiment events generated
 * by the client (e.g. {@link ExposureEvent}).
 * @category Provider
 */
export interface ExperimentAnalyticsProvider {
  /**
   * Wraps an analytics event track call. This is typically called by the
   * experiment client after setting user properties to track an
   * "[Experiment] Exposure" event
   * @param event see {@link ExperimentAnalyticsEvent}
   */
  track(event: ExperimentAnalyticsEvent): void;

  /**
   * Wraps an analytics identify or set user property call. This is typically
   * called by the experiment client before sending an
   * "[Experiment] Exposure" event.
   * @param event see {@link ExperimentAnalyticsEvent}
   */
  setUserProperty?(event: ExperimentAnalyticsEvent): void;

  /**
   * Wraps an analytics unset user property call. This is typically
   * called by the experiment client when a user has been evaluated to use
   * a fallback variant.
   * @param event see {@link ExperimentAnalyticsEvent}
   */
  unsetUserProperty?(event: ExperimentAnalyticsEvent): void;
}
