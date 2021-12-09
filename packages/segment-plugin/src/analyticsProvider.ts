import { ExperimentAnalyticsProvider } from '@amplitude/experiment-js-client';
import { ExperimentAnalyticsEvent } from '@amplitude/experiment-js-client/dist/types/src/types/analytics';
import { Analytics } from '@segment/analytics-next';

export class SegmentAnalyticsProvider implements ExperimentAnalyticsProvider {
  private readonly segment: Analytics;
  constructor(segment: Analytics) {
    this.segment = segment;
  }
  setUserProperty(event: ExperimentAnalyticsEvent): void {
    this.segment.identify({
      [event.userProperty]: event.variant.value,
    });
  }
  track(event: ExperimentAnalyticsEvent): void {
    this.segment.track(event.name, event.properties);
  }
  unsetUserProperty(event: ExperimentAnalyticsEvent): void {
    this.segment.identify({
      [event.userProperty]: null,
    });
  }
}
