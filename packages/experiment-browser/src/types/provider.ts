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
