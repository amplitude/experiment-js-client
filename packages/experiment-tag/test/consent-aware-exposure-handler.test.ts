import {
  Exposure,
  ExposureTrackingProvider,
} from '@amplitude/experiment-js-client';
import { ConsentAwareExposureHandler } from 'src/exposure/consent-aware-exposure-handler';
import { ConsentStatus } from 'src/types';

class TestExposureTrackingProvider implements ExposureTrackingProvider {
  public trackedExposures: Exposure[] = [];
  public trackCount = 0;

  track(exposure: Exposure): void {
    this.trackCount += 1;
    this.trackedExposures.push(exposure);
  }

  reset(): void {
    this.trackedExposures = [];
    this.trackCount = 0;
  }
}

describe('ConsentAwareExposureHandler', () => {
  let provider: TestExposureTrackingProvider;
  let handler: ConsentAwareExposureHandler;
  let mockDate: jest.SpyInstance;

  beforeEach(() => {
    provider = new TestExposureTrackingProvider();
    if (mockDate) {
      mockDate.mockRestore();
    }
  });

  afterEach(() => {
    if (mockDate) {
      mockDate.mockRestore();
    }
  });

  describe('when consent is granted', () => {
    beforeEach(() => {
      handler = new ConsentAwareExposureHandler(
        ConsentStatus.GRANTED,
        provider,
      );
    });

    test('should track exposures immediately', () => {
      const exposure: Exposure = {
        flag_key: 'test-flag',
        variant: 'test-variant',
      };

      handler.track(exposure);

      expect(provider.trackCount).toBe(1);
      expect(provider.trackedExposures).toEqual([exposure]);
    });

    test('should track multiple exposures immediately', () => {
      const exposure1: Exposure = { flag_key: 'flag1', variant: 'variant1' };
      const exposure2: Exposure = { flag_key: 'flag2', variant: 'variant2' };

      handler.track(exposure1);
      handler.track(exposure2);

      expect(provider.trackCount).toBe(2);
      expect(provider.trackedExposures).toEqual([exposure1, exposure2]);
    });
  });

  describe('when consent is pending', () => {
    beforeEach(() => {
      handler = new ConsentAwareExposureHandler(
        ConsentStatus.PENDING,
        provider,
      );
    });

    test('should not track exposures immediately', () => {
      const exposure: Exposure = {
        flag_key: 'test-flag',
        variant: 'test-variant',
      };

      handler.track(exposure);

      expect(provider.trackCount).toBe(0);
      expect(provider.trackedExposures).toEqual([]);
    });

    test('should store multiple exposures in memory', () => {
      const exposure1: Exposure = { flag_key: 'flag1', variant: 'variant1' };
      const exposure2: Exposure = { flag_key: 'flag2', variant: 'variant2' };

      handler.track(exposure1);
      handler.track(exposure2);

      expect(provider.trackCount).toBe(0);
      expect(provider.trackedExposures).toEqual([]);
    });

    test('should fire all pending exposures when consent becomes granted', () => {
      const exposure1: Exposure = { flag_key: 'flag1', variant: 'variant1' };
      const exposure2: Exposure = { flag_key: 'flag2', variant: 'variant2' };

      handler.track(exposure1);
      handler.track(exposure2);

      handler.setConsentStatus(ConsentStatus.GRANTED);

      expect(provider.trackCount).toBe(2);
      expect(provider.trackedExposures).toEqual([exposure1, exposure2]);
    });

    test('should track new exposures immediately after consent becomes granted', () => {
      const exposure1: Exposure = { flag_key: 'flag1', variant: 'variant1' };
      const exposure2: Exposure = { flag_key: 'flag2', variant: 'variant2' };

      handler.track(exposure1);
      handler.setConsentStatus(ConsentStatus.GRANTED);
      handler.track(exposure2);

      expect(provider.trackCount).toBe(2);
      expect(provider.trackedExposures).toEqual([exposure1, exposure2]);
    });

    test('should delete all pending exposures when consent becomes rejected', () => {
      const exposure1: Exposure = { flag_key: 'flag1', variant: 'variant1' };
      const exposure2: Exposure = { flag_key: 'flag2', variant: 'variant2' };

      handler.track(exposure1);
      handler.track(exposure2);

      handler.setConsentStatus(ConsentStatus.REJECTED);

      expect(provider.trackCount).toBe(0);
      expect(provider.trackedExposures).toEqual([]);

      handler.setConsentStatus(ConsentStatus.GRANTED);
      expect(provider.trackCount).toBe(0);
      expect(provider.trackedExposures).toEqual([]);
    });
  });

  describe('when consent is rejected', () => {
    beforeEach(() => {
      handler = new ConsentAwareExposureHandler(
        ConsentStatus.REJECTED,
        provider,
      );
    });

    test('should not track exposures', () => {
      const exposure: Exposure = {
        flag_key: 'test-flag',
        variant: 'test-variant',
      };

      handler.track(exposure);

      expect(provider.trackCount).toBe(0);
      expect(provider.trackedExposures).toEqual([]);
    });

    test('should track exposures when consent becomes granted', () => {
      const exposure: Exposure = {
        flag_key: 'test-flag',
        variant: 'test-variant',
      };

      handler.track(exposure);
      expect(provider.trackCount).toBe(0);

      handler.setConsentStatus(ConsentStatus.GRANTED);
      handler.track(exposure);

      expect(provider.trackCount).toBe(1);
      expect(provider.trackedExposures).toEqual([exposure]);
    });
  });

  describe('without exposure tracking provider', () => {
    beforeEach(() => {
      handler = new ConsentAwareExposureHandler(ConsentStatus.GRANTED);
    });

    test('should not throw error when tracking exposures', () => {
      const exposure: Exposure = {
        flag_key: 'test-flag',
        variant: 'test-variant',
      };

      expect(() => handler.track(exposure)).not.toThrow();
    });
  });

  describe('setExposureTrackingProvider', () => {
    beforeEach(() => {
      handler = new ConsentAwareExposureHandler(ConsentStatus.GRANTED);
    });

    test('should set the exposure tracking provider', () => {
      const exposure: Exposure = {
        flag_key: 'test-flag',
        variant: 'test-variant',
      };

      handler.track(exposure);
      expect(provider.trackCount).toBe(0);

      handler.setExposureTrackingProvider(provider);
      handler.track(exposure);

      expect(provider.trackCount).toBe(1);
      expect(provider.trackedExposures).toEqual([exposure]);
    });
  });

  describe('timestamp handling', () => {
    beforeEach(() => {
      handler = new ConsentAwareExposureHandler(
        ConsentStatus.GRANTED,
        provider,
      );
    });

    test('should add timestamp to exposures when tracking immediately', () => {
      const mockTimestamp = 1234567890000;
      mockDate = jest
        .spyOn(Date.prototype, 'getTime')
        .mockReturnValue(mockTimestamp);

      const exposure: Exposure = {
        flag_key: 'test-flag',
        variant: 'test-variant',
      };

      handler.track(exposure);

      expect(provider.trackCount).toBe(1);
      const trackedExposure = provider.trackedExposures[0];
      expect(trackedExposure.time).toBe(mockTimestamp);
      expect(mockDate).toHaveBeenCalled();
    });

    test('should add timestamp to pending exposures when stored', () => {
      handler = new ConsentAwareExposureHandler(
        ConsentStatus.PENDING,
        provider,
      );

      const mockTimestamp = 1234567890000;
      mockDate = jest
        .spyOn(Date.prototype, 'getTime')
        .mockReturnValue(mockTimestamp);

      const exposure: Exposure = {
        flag_key: 'test-flag',
        variant: 'test-variant',
      };

      handler.track(exposure);

      handler.setConsentStatus(ConsentStatus.GRANTED);

      expect(provider.trackCount).toBe(1);
      const trackedExposure = provider.trackedExposures[0];
      expect(trackedExposure.time).toBe(mockTimestamp);
      expect(mockDate).toHaveBeenCalled();
    });

    test('should add different timestamps to multiple exposures', () => {
      const exposure1: Exposure = {
        flag_key: 'flag1',
        variant: 'variant1',
      };
      const exposure2: Exposure = {
        flag_key: 'flag2',
        variant: 'variant2',
      };

      const mockTimestamp1 = 1234567890000;
      const mockTimestamp2 = 1234567891000;
      mockDate = jest
        .spyOn(Date.prototype, 'getTime')
        .mockReturnValueOnce(mockTimestamp1)
        .mockReturnValueOnce(mockTimestamp2);

      handler.track(exposure1);
      handler.track(exposure2);

      expect(provider.trackCount).toBe(2);
      const trackedExposure1 = provider.trackedExposures[0];
      const trackedExposure2 = provider.trackedExposures[1];

      expect(trackedExposure1.time).toBe(mockTimestamp1);
      expect(trackedExposure2.time).toBe(mockTimestamp2);
      expect(mockDate).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    let errorProvider: ExposureTrackingProvider;

    beforeEach(() => {
      errorProvider = {
        track: () => {
          throw new Error('Tracking failed');
        },
      };
      handler = new ConsentAwareExposureHandler(
        ConsentStatus.GRANTED,
        errorProvider,
      );
    });

    test('should handle errors gracefully and log warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const exposure: Exposure = {
        flag_key: 'test-flag',
        variant: 'test-variant',
      };

      expect(() => handler.track(exposure)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to track exposure:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    test('should still add timestamp even when tracking fails', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockTimestamp = 1234567890000;
      mockDate = jest
        .spyOn(Date.prototype, 'getTime')
        .mockReturnValue(mockTimestamp);

      const exposure: Exposure = {
        flag_key: 'test-flag',
        variant: 'test-variant',
      };

      handler.track(exposure);

      expect(exposure.time).toBe(mockTimestamp);
      expect(mockDate).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
