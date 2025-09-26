import { Exposure, ExposureTrackingProvider } from '../types/exposure';
import { ExperimentUser } from '../types/user';

interface Identity {
  userId?: string;
  deviceId?: string;
}

/**
 * A wrapper for an exposure tracking provider which only sends one exposure event per
 * flag, per variant, per user session. When the user identity (userId or deviceId) changes,
 * the tracking cache is reset to ensure exposures are tracked for the new user session.
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
    this.exposureTrackingProvider.track(exposure);
  }

  private identityEquals(id1: Identity, id2: Identity): boolean {
    return id1.userId === id2.userId && id1.deviceId === id2.deviceId;
  }
}
