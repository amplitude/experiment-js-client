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
 * Provides a tracking implementation for standard experiment events generated
 * by the client (e.g. exposure).
 * @category Provider
 */
export interface ExperimentTrackingProvider {
  track(eventName: string, properties: Record<string, string>): void;
}
