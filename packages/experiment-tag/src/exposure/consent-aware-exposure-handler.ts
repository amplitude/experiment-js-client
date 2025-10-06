import {
  Exposure,
  ExposureTrackingProvider,
} from '@amplitude/experiment-js-client';

import { ConsentStatus } from '../types';

/**
 * Consent-aware exposure handler that manages exposure tracking based on consent status
 */
export class ConsentAwareExposureHandler implements ExposureTrackingProvider {
  private pendingExposures: Exposure[] = [];
  private consentStatus: ConsentStatus = ConsentStatus.PENDING;
  private exposureTrackingProvider?: ExposureTrackingProvider;

  constructor(
    initialConsentStatus: ConsentStatus,
    exposureTrackingProvider?: ExposureTrackingProvider,
  ) {
    this.consentStatus = initialConsentStatus;
    this.exposureTrackingProvider = exposureTrackingProvider;
  }

  /**
   * Set the consent status and handle exposure tracking accordingly
   */
  public setConsentStatus(consentStatus: ConsentStatus): void {
    const previousStatus = this.consentStatus;
    this.consentStatus = consentStatus;

    if (previousStatus === ConsentStatus.PENDING) {
      if (consentStatus === ConsentStatus.GRANTED) {
        // Fire all pending exposures when consent is granted
        for (const exposure of this.pendingExposures) {
          this.trackExposureDirectly(exposure);
        }
        this.pendingExposures = [];
      } else if (consentStatus === ConsentStatus.REJECTED) {
        this.pendingExposures = [];
      }
    }
  }

  /**
   * Set the exposure tracking provider
   */
  public setExposureTrackingProvider(
    exposureTrackingProvider: ExposureTrackingProvider,
  ): void {
    this.exposureTrackingProvider = exposureTrackingProvider;
  }

  /**
   * Track an exposure with consent awareness
   */
  public track(exposure: Exposure): void {
    exposure.time = new Date().getTime();
    if (this.consentStatus === ConsentStatus.PENDING) {
      this.pendingExposures.push(exposure);
    } else if (this.consentStatus === ConsentStatus.GRANTED) {
      this.trackExposureDirectly(exposure);
    }
  }

  /**
   * Track exposure directly using the underlying provider
   */
  private trackExposureDirectly(exposure: Exposure): void {
    if (this.exposureTrackingProvider) {
      try {
        this.exposureTrackingProvider.track(exposure);
      } catch (error) {
        console.warn('Failed to track exposure:', error);
      }
    }
  }
}
