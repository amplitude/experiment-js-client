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
   * Event properties for the analytics event. Should be passed as the event
   * properties to the analytics implementation provided by the
   * {@link ExperimentAnalyticsProvider}.
   */
  properties: Record<string, string>;

  /**
   * Custom user properties from the {@link ExperimentUser} stored by the
   * {@link ExperimentClient}. Also includes merged properties provided by the
   * {@link ExperimentUserProvider}.
   */
  userProperties?: Record<string, unknown>;
}

/**
 * Event for tracking a user's exposure to a variant. This event will not count
 * towards your analytics event volume.
 */
export class ExposureEvent implements ExperimentAnalyticsEvent {
  name = '[Experiment] Exposure';
  properties: Record<string, string>;
  userProperties?: Record<string, unknown>;

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
    this.userProperties = {
      [`[Experiment] ${key}`]: variant.value,
    };
  }
}
