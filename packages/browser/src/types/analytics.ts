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
   * User properties to identify with the user prior to sending the event.
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

export enum VariantSource {
  LOCAL_STORAGE = 'storage',
  INITIAL_VARIANTS = 'initial',
  SECONDARY_LOCAL_STORAGE = 'secondary-storage',
  SECONDARY_INITIAL_VARIANTS = 'secondary-initial',
  FALLBACK_INLINE = 'fallback-inline',
  FALLBACK_CONFIG = 'fallback-config',
}

export const isFallback = (source: VariantSource): boolean => {
  return (
    source === VariantSource.FALLBACK_INLINE ||
    source === VariantSource.FALLBACK_CONFIG
  );
};
