import { getGlobalScope } from '@amplitude/experiment-core';
import {
  ExperimentEvent,
  IntegrationPlugin,
} from '@amplitude/experiment-js-client';

import { ConsentStatus } from '../types';

/**
 * Consent-aware exposure handler that wraps window.experimentIntegration.track
 */
export class ConsentAwareExposureHandler {
  private pendingEvents: ExperimentEvent[] = [];
  private consentStatus: ConsentStatus = ConsentStatus.PENDING;
  private originalTrack: ((event: ExperimentEvent) => boolean) | null = null;

  constructor(initialConsentStatus: ConsentStatus) {
    this.consentStatus = initialConsentStatus;
  }

  /**
   * Wrap the experimentIntegration.track method with consent-aware logic
   * Prevents nested wrapping by checking if already wrapped
   */
  public wrapExperimentIntegrationTrack(): void {
    const globalScope = getGlobalScope();
    const experimentIntegration =
      globalScope?.experimentIntegration as IntegrationPlugin;
    if (experimentIntegration?.track) {
      if (this.isIntegrationWrapped(experimentIntegration)) {
        return;
      }

      this.originalTrack = experimentIntegration.track.bind(
        experimentIntegration,
      );
      const wrappedTrack = this.createConsentAwareTrack(this.originalTrack);
      (experimentIntegration as any).__isConsentAwareWrapped = true;
      experimentIntegration.track = wrappedTrack;
    }
  }

  /**
   * Check if a track method is already wrapped
   */
  private isIntegrationWrapped(integration: IntegrationPlugin): boolean {
    return (integration as any).__isConsentAwareWrapped === true;
  }

  /**
   * Create a consent-aware wrapper for the track method
   */
  private createConsentAwareTrack(
    originalTrack: (event: ExperimentEvent) => boolean,
  ) {
    return (event: ExperimentEvent): boolean => {
      if (event?.eventProperties) {
        event.eventProperties.time = Date.now();
      }
      try {
        if (this.consentStatus === ConsentStatus.PENDING) {
          this.pendingEvents.push(event);
          return true;
        } else if (this.consentStatus === ConsentStatus.GRANTED) {
          return originalTrack(event);
        }
        return false;
      } catch (error) {
        console.warn('Failed to track event:', error);
        return false;
      }
    };
  }

  /**
   * Set the consent status and handle pending events accordingly
   */
  public setConsentStatus(consentStatus: ConsentStatus): void {
    const previousStatus = this.consentStatus;
    this.consentStatus = consentStatus;

    if (previousStatus === ConsentStatus.PENDING) {
      if (consentStatus === ConsentStatus.GRANTED) {
        for (const event of this.pendingEvents) {
          if (this.originalTrack) {
            try {
              this.originalTrack(event);
            } catch (error) {
              console.warn('Failed to track pending event:', error);
            }
          }
        }
        this.pendingEvents = [];
      } else if (consentStatus === ConsentStatus.REJECTED) {
        // Delete all pending events
        this.pendingEvents = [];
      }
    }
  }
}
