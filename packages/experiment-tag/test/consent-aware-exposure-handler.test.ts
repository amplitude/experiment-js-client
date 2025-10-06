import {
  ExperimentEvent,
  IntegrationPlugin,
} from '@amplitude/experiment-js-client';
import { ConsentAwareExposureHandler } from 'src/exposure/consent-aware-exposure-handler';
import { ConsentStatus } from 'src/types';

class TestIntegrationPlugin implements IntegrationPlugin {
  public trackedEvents: ExperimentEvent[] = [];
  public trackCount = 0;
  public type = 'integration' as const;
  public originalTrack: (event: ExperimentEvent) => boolean;

  constructor() {
    this.originalTrack = this.track.bind(this);
  }

  track(event: ExperimentEvent): boolean {
    this.trackCount += 1;
    this.trackedEvents.push(event);
    return true;
  }

  getUser() {
    return {
      user_id: 'test-user',
      device_id: 'test-device',
    };
  }

  reset(): void {
    this.trackedEvents = [];
    this.trackCount = 0;
    // Restore original track method
    this.track = this.originalTrack;
  }
}

describe('ConsentAwareExposureHandler', () => {
  let integrationPlugin: TestIntegrationPlugin;
  let handler: ConsentAwareExposureHandler;
  let mockGlobalScope: any;
  let mockGetGlobalScope: jest.SpyInstance;

  beforeEach(() => {
    integrationPlugin = new TestIntegrationPlugin();
    mockGlobalScope = {
      experimentIntegration: integrationPlugin,
    };
    mockGetGlobalScope = jest.spyOn(require('@amplitude/experiment-core'), 'getGlobalScope');
    mockGetGlobalScope.mockReturnValue(mockGlobalScope);
  });

  afterEach(() => {
    integrationPlugin.reset();
    if (mockGetGlobalScope) {
      mockGetGlobalScope.mockRestore();
    }
  });

  describe('when consent is granted', () => {
    beforeEach(() => {
      handler = new ConsentAwareExposureHandler(ConsentStatus.GRANTED);
      handler.wrapExperimentIntegrationTrack();
    });

    test('should track events immediately', () => {
      const event: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'test-flag',
          variant: 'test-variant',
        },
      };

      // The track method should now be wrapped
      mockGlobalScope.experimentIntegration.track(event);

      expect(integrationPlugin.trackCount).toBe(1);
      expect(integrationPlugin.trackedEvents).toEqual([event]);
    });

    test('should track multiple events immediately', () => {
      const event1: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: { flag_key: 'flag1', variant: 'variant1' },
      };
      const event2: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: { flag_key: 'flag2', variant: 'variant2' },
      };

      mockGlobalScope.experimentIntegration.track(event1);
      mockGlobalScope.experimentIntegration.track(event2);

      expect(integrationPlugin.trackCount).toBe(2);
      expect(integrationPlugin.trackedEvents).toEqual([event1, event2]);
    });
  });

  describe('when consent is pending', () => {
    beforeEach(() => {
      handler = new ConsentAwareExposureHandler(ConsentStatus.PENDING);
      handler.wrapExperimentIntegrationTrack();
    });

    test('should not track events immediately', () => {
      const event: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'test-flag',
          variant: 'test-variant',
        },
      };

      mockGlobalScope.experimentIntegration.track(event);

      expect(integrationPlugin.trackCount).toBe(0);
      expect(integrationPlugin.trackedEvents).toEqual([]);
    });

    test('should store multiple events in memory', () => {
      const event1: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: { flag_key: 'flag1', variant: 'variant1' },
      };
      const event2: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: { flag_key: 'flag2', variant: 'variant2' },
      };

      mockGlobalScope.experimentIntegration.track(event1);
      mockGlobalScope.experimentIntegration.track(event2);

      expect(integrationPlugin.trackCount).toBe(0);
      expect(integrationPlugin.trackedEvents).toEqual([]);
    });

    test('should fire all pending events when consent becomes granted', () => {
      const event1: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: { flag_key: 'flag1', variant: 'variant1' },
      };
      const event2: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: { flag_key: 'flag2', variant: 'variant2' },
      };

      mockGlobalScope.experimentIntegration.track(event1);
      mockGlobalScope.experimentIntegration.track(event2);

      handler.setConsentStatus(ConsentStatus.GRANTED);

      expect(integrationPlugin.trackCount).toBe(2);
      expect(integrationPlugin.trackedEvents).toEqual([event1, event2]);
    });

    test('should track new events immediately after consent becomes granted', () => {
      const event1: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: { flag_key: 'flag1', variant: 'variant1' },
      };
      const event2: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: { flag_key: 'flag2', variant: 'variant2' },
      };

      mockGlobalScope.experimentIntegration.track(event1);
      handler.setConsentStatus(ConsentStatus.GRANTED);
      mockGlobalScope.experimentIntegration.track(event2);

      expect(integrationPlugin.trackCount).toBe(2);
      expect(integrationPlugin.trackedEvents).toEqual([event1, event2]);
    });

    test('should delete all pending events when consent becomes rejected', () => {
      const event1: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: { flag_key: 'flag1', variant: 'variant1' },
      };
      const event2: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: { flag_key: 'flag2', variant: 'variant2' },
      };

      mockGlobalScope.experimentIntegration.track(event1);
      mockGlobalScope.experimentIntegration.track(event2);

      handler.setConsentStatus(ConsentStatus.REJECTED);

      expect(integrationPlugin.trackCount).toBe(0);
      expect(integrationPlugin.trackedEvents).toEqual([]);

      handler.setConsentStatus(ConsentStatus.GRANTED);
      expect(integrationPlugin.trackCount).toBe(0);
      expect(integrationPlugin.trackedEvents).toEqual([]);
    });
  });

  describe('when consent is rejected', () => {
    beforeEach(() => {
      handler = new ConsentAwareExposureHandler(ConsentStatus.REJECTED);
      handler.wrapExperimentIntegrationTrack();
    });

    test('should not track events', () => {
      const event: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'test-flag',
          variant: 'test-variant',
        },
      };

      mockGlobalScope.experimentIntegration.track(event);

      expect(integrationPlugin.trackCount).toBe(0);
      expect(integrationPlugin.trackedEvents).toEqual([]);
    });

    test('should track events when consent becomes granted', () => {
      const event: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'test-flag',
          variant: 'test-variant',
        },
      };

      mockGlobalScope.experimentIntegration.track(event);
      expect(integrationPlugin.trackCount).toBe(0);

      handler.setConsentStatus(ConsentStatus.GRANTED);
      mockGlobalScope.experimentIntegration.track(event);

      expect(integrationPlugin.trackCount).toBe(1);
      expect(integrationPlugin.trackedEvents).toEqual([event]);
    });
  });

  describe('without experiment integration', () => {
    beforeEach(() => {
      mockGetGlobalScope.mockReturnValue({});
      handler = new ConsentAwareExposureHandler(ConsentStatus.GRANTED);
    });

    test('should not throw error when no integration exists', () => {
      expect(() => handler.setConsentStatus(ConsentStatus.PENDING)).not.toThrow();
    });
  });

  describe('error handling', () => {
    let errorIntegrationPlugin: IntegrationPlugin;
    let errorGlobalScope: any;

    beforeEach(() => {
      errorIntegrationPlugin = {
        type: 'integration' as const,
        track: () => {
          throw new Error('Tracking failed');
        },
        getUser: () => ({ user_id: 'test', device_id: 'test' }),
      };
      errorGlobalScope = {
        experimentIntegration: errorIntegrationPlugin,
      };
      mockGetGlobalScope.mockReturnValue(errorGlobalScope);
      handler = new ConsentAwareExposureHandler(ConsentStatus.GRANTED);
      handler.wrapExperimentIntegrationTrack();
    });

    test('should handle errors gracefully when original track throws', () => {
      const event: ExperimentEvent = {
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'test-flag',
          variant: 'test-variant',
        },
      };

      expect(() => errorGlobalScope.experimentIntegration.track(event)).not.toThrow();
    });
  });
});
