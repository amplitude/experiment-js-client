import { Exposure, ExposureTrackingProvider } from '../types/exposure';

export class SessionExposureTrackingProvider
  implements ExposureTrackingProvider
{
  private readonly exposureTrackingProvider: ExposureTrackingProvider;
  private tracked: Record<string, Exposure | null> = {};

  constructor(exposureTrackingProvider: ExposureTrackingProvider) {
    this.exposureTrackingProvider = exposureTrackingProvider;
  }

  track(exposure: Exposure): void {
    const trackedExposure = this.tracked[exposure.flag_key];
    if (trackedExposure && trackedExposure.variant === exposure.variant) {
      return;
    } else {
      this.tracked[exposure.flag_key] = exposure;
      this.exposureTrackingProvider.track(exposure);
    }
  }
}
