import { VariantSource } from './source';
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
   * This is equivalent to
   * ```
   * {
   *   "key": key,
   *   "variant": variant,
   * }
   * ```
   */
  properties: Record<string, string>;

  /**
   * User properties to identify with the user prior to sending the event.
   * This is equivalent to
   * ```
   * {
   *   [userProperty]: variant
   * }
   * ```
   */
  userProperties?: Record<string, unknown>;

  /**
   * The user exposed to the flag/experiment variant.
   */
  user: ExperimentUser;

  /**
   * The key of the flag/experiment that the user has been exposed to.
   */
  key: string;

  /**
   * The variant of the flag/experiment that the user has been exposed to.
   */
  variant: Variant;

  /**
   * The user property for the flag/experiment (auto-generated from the key)
   */
  userProperty: string;
}

/**
 * Event for tracking a user's exposure to a variant. This event will not count
 * towards your analytics event volume.
 */
export const exposureEvent = (
  user: ExperimentUser,
  key: string,
  variant: Variant,
  source: VariantSource,
): ExperimentAnalyticsEvent => {
  const name = '[Experiment] Exposure';
  const value = variant?.value;
  const userProperty = `[Experiment] ${key}`;
  return {
    name,
    user,
    key,
    variant,
    userProperty,
    properties: {
      key,
      variant: value,
      source,
    },
    userProperties: {
      [userProperty]: value,
    },
  };
};
