import { Exposure, ExposureTrackingProvider } from '../types/exposure';
import { ExperimentUser } from '../types/user';

import { groupsKey, isNullUndefinedOrEmpty } from './index';

interface Identity {
  userId?: string;
  deviceId?: string;
  groups?: string;
}

/**
 * A wrapper for an exposure tracking provider which only sends one exposure event per
 * flag, per variant, per user session. When the user identity (userId, deviceId, or groups)
 * changes, the tracking cache is reset to ensure exposures are tracked for the new user session.
 */
export class UserSessionExposureTracker {
  private readonly exposureTrackingProvider: ExposureTrackingProvider;
  private tracked: Record<string, string | undefined> = {};
  private identity: Identity = {};

  constructor(exposureTrackingProvider: ExposureTrackingProvider) {
    this.exposureTrackingProvider = exposureTrackingProvider;
  }

  track(exposure: Exposure, user?: ExperimentUser): void {
    const newIdentity: Identity = {
      userId: user?.user_id,
      deviceId: user?.device_id,
      groups: groupsKey(user?.groups),
    };

    if (!this.identityEquals(this.identity, newIdentity)) {
      this.tracked = {};
    }
    this.identity = newIdentity;

    const hasTrackedFlag = exposure.flag_key in this.tracked;
    const trackedVariant = this.tracked[exposure.flag_key];
    if (hasTrackedFlag && trackedVariant === exposure.variant) {
      return;
    }

    this.tracked[exposure.flag_key] = exposure.variant;
    if (isNullUndefinedOrEmpty(user?.groups)) {
      this.exposureTrackingProvider.track(exposure);
    } else {
      this.exposureTrackingProvider.track(exposure, user.groups);
    }
  }

  private identityEquals(id1: Identity, id2: Identity): boolean {
    return (
      id1.userId === id2.userId &&
      id1.deviceId === id2.deviceId &&
      id1.groups === id2.groups
    );
  }
}
