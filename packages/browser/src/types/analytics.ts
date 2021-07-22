import { ExperimentUser } from './user';
import { Variant } from './variant';

/**
 * Analytics event for tracking events generated from the experiment SDK client.
 * These events are sent to the implementation provided by an
 * {@link ExperimentAnalyticsProvider}.
 * @category Analytics
 */
export interface ExperimentAnalyticsEvent {
  /**
   * The name of the event. Should be passed as the event tracking name to the
   * analytics implementation provided by the
   * {@link ExperimentAnalyticsProvider}.
   */
  name: string;

  /**
   * Properties for the analytics event. Should be passed as the event
   * properties to the analytics implementation provided by the
   * {@link ExperimentAnalyticsProvider}.
   */
  properties: Record<string, string>;
}

/**
 * Event for tracking a user's exposure to a variant. This event will not count
 * towards your analytics event volume.
 */
export class ExposureEvent implements ExperimentAnalyticsEvent {
  name = '[Experiment] Exposure';
  properties: Record<string, string>;

  /**
   * The user exposed to the flag/experiment variant.
   */
  public user: ExperimentUser;

  /**
   * The key of the flag/experiment that the user has been exposed to.
   */
  public key: string;

  /**
   * The variant of the flag/experiment that the user has been exposed to.
   */
  public variant: Variant;

  public constructor(user: ExperimentUser, key: string, variant: Variant) {
    this.key = key;
    this.variant = variant;
    this.properties = {
      key: key,
      variant: variant.value,
    };
  }
}
