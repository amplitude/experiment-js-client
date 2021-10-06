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
  track(event: ExperimentAnalyticsEvent): void;
  unset(event: ExperimentAnalyticsEvent): void;
}
