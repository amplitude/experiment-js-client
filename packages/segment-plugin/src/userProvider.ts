import {
  ExperimentUser,
  ExperimentUserProvider,
} from '@amplitude/experiment-js-client';
import { Analytics } from '@segment/analytics-next';

export class SegmentUserProvider implements ExperimentUserProvider {
  private readonly segment: Analytics;
  constructor(segment: Analytics) {
    this.segment = segment;
  }
  getUser(): ExperimentUser {
    return {
      user_id: this.segment.user().id(),
      device_id: this.segment.user().anonymousId(),
    };
  }
}
