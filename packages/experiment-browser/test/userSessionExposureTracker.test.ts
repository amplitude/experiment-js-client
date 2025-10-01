import { Exposure, ExposureTrackingProvider } from '../src/types/exposure';
import { UserSessionExposureTracker } from '../src/util/userSessionExposureTracker';

class TestExposureTrackingProvider implements ExposureTrackingProvider {
  public lastExposure: Exposure | null = null;
  public trackCount = 0;

  track(exposure: Exposure): void {
    this.trackCount += 1;
    this.lastExposure = exposure;
  }
}

describe('UserSessionExposureTracker', () => {
  test('track called once per flag', () => {
    const provider = new TestExposureTrackingProvider();
    const tracker = new UserSessionExposureTracker(provider);

    const exposure: Exposure = { flag_key: 'flag', variant: 'variant' };
    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure);
    }
    expect(provider.lastExposure).toEqual(exposure);
    expect(provider.trackCount).toBe(1);

    const exposure2: Exposure = { flag_key: 'flag2', variant: 'variant' };
    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure2);
    }
    expect(provider.lastExposure).toEqual(exposure2);
    expect(provider.trackCount).toBe(2);
  });

  test('track called again on same flag with variant change value to null', () => {
    const provider = new TestExposureTrackingProvider();
    const tracker = new UserSessionExposureTracker(provider);

    const exposure: Exposure = { flag_key: 'flag', variant: 'variant' };
    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure);
    }
    const exposure2: Exposure = { flag_key: 'flag', variant: undefined };
    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure2);
    }

    expect(provider.lastExposure).toEqual(exposure2);
    expect(provider.trackCount).toBe(2);
  });

  test('track called again on same flag with variant change value to different value', () => {
    const provider = new TestExposureTrackingProvider();
    const tracker = new UserSessionExposureTracker(provider);

    const exposure: Exposure = { flag_key: 'flag', variant: 'variant' };
    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure);
    }
    const exposure2: Exposure = { flag_key: 'flag', variant: 'variant2' };
    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure2);
    }

    expect(provider.lastExposure).toEqual(exposure2);
    expect(provider.trackCount).toBe(2);
  });

  test('track called again on user id change null to value', () => {
    const provider = new TestExposureTrackingProvider();
    const tracker = new UserSessionExposureTracker(provider);

    const exposure: Exposure = { flag_key: 'flag', variant: 'variant' };

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure);
    }

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure, { user_id: 'uid' });
    }

    expect(provider.lastExposure).toEqual(exposure);
    expect(provider.trackCount).toBe(2);
  });

  test('track called again on device id change null to value', () => {
    const provider = new TestExposureTrackingProvider();
    const tracker = new UserSessionExposureTracker(provider);

    const exposure: Exposure = { flag_key: 'flag', variant: 'variant' };

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure);
    }

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure, { device_id: 'did' });
    }

    expect(provider.lastExposure).toEqual(exposure);
    expect(provider.trackCount).toBe(2);
  });

  test('track called again on user id change value to null', () => {
    const provider = new TestExposureTrackingProvider();
    const tracker = new UserSessionExposureTracker(provider);

    const exposure: Exposure = { flag_key: 'flag', variant: 'variant' };

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure, { user_id: 'uid' });
    }

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure);
    }

    expect(provider.lastExposure).toEqual(exposure);
    expect(provider.trackCount).toBe(2);
  });

  test('track called again on device id change value to null', () => {
    const provider = new TestExposureTrackingProvider();
    const tracker = new UserSessionExposureTracker(provider);

    const exposure: Exposure = { flag_key: 'flag', variant: 'variant' };

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure, { device_id: 'did' });
    }

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure);
    }

    expect(provider.lastExposure).toEqual(exposure);
    expect(provider.trackCount).toBe(2);
  });

  test('track called again on user id change value to different value', () => {
    const provider = new TestExposureTrackingProvider();
    const tracker = new UserSessionExposureTracker(provider);

    const exposure: Exposure = { flag_key: 'flag', variant: 'variant' };

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure, { user_id: 'uid' });
    }

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure, { user_id: 'uid2' });
    }

    expect(provider.lastExposure).toEqual(exposure);
    expect(provider.trackCount).toBe(2);
  });

  test('track called again on device id change value to different value', () => {
    const provider = new TestExposureTrackingProvider();
    const tracker = new UserSessionExposureTracker(provider);

    const exposure: Exposure = { flag_key: 'flag', variant: 'variant' };

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure, { device_id: 'did' });
    }

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure, { device_id: 'did2' });
    }

    expect(provider.lastExposure).toEqual(exposure);
    expect(provider.trackCount).toBe(2);
  });

  test('track called again on user id and device id change null to value', () => {
    const provider = new TestExposureTrackingProvider();
    const tracker = new UserSessionExposureTracker(provider);

    const exposure: Exposure = { flag_key: 'flag', variant: 'variant' };

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure);
    }

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure, { user_id: 'uid', device_id: 'did' });
    }

    expect(provider.lastExposure).toEqual(exposure);
    expect(provider.trackCount).toBe(2);
  });

  test('track called again on user id and device id change value to null', () => {
    const provider = new TestExposureTrackingProvider();
    const tracker = new UserSessionExposureTracker(provider);

    const exposure: Exposure = { flag_key: 'flag', variant: 'variant' };

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure, { user_id: 'uid', device_id: 'did' });
    }

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure);
    }

    expect(provider.lastExposure).toEqual(exposure);
    expect(provider.trackCount).toBe(2);
  });

  test('track called again on user id and device id change value to different value', () => {
    const provider = new TestExposureTrackingProvider();
    const tracker = new UserSessionExposureTracker(provider);

    const exposure: Exposure = { flag_key: 'flag', variant: 'variant' };

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure, { user_id: 'uid', device_id: 'did' });
    }

    for (let i = 0; i <= 10; i++) {
      tracker.track(exposure, { user_id: 'uid2', device_id: 'did2' });
    }

    expect(provider.lastExposure).toEqual(exposure);
    expect(provider.trackCount).toBe(2);
  });
});
