/**
 * Event object for tracking exposures to Amplitude Experiment.
 *
 * This object contains all the required information to send an `$exposure`
 * event through any SDK or CDP to experiment.
 *
 * The resulting exposure event must follow the following definition:
 * ```
 * {
 *   "event_type": "$exposure",
 *   "event_properties": {
 *     "flag_key": "<flagKey>",
 *     "variant": "<variant>",
 *     "experiment_key": "<expKey>",
 *   }
 * }
 * ```
 *
 * Where `<flagKey>`, `<variant>`, and `<expKey>` are the {@link flag_key},
 * {@link variant}, and {@link experiment_key} variant members on this type:
 *
 * For example, if you're using Segment for analytics:
 *
 * ```
 * analytics.track('$exposure', exposure)
 * ```
 */
export type Exposure = {
  /**
   * (Required) The key for the flag the user was exposed to.
   */
  flag_key: string;
  /**
   * (Optional) The variant the user was exposed to. If null or missing, the
   * event will not be persisted, and will unset the user property.
   */
  variant?: string;
  /**
   * (Optional) The experiment key used to differentiate between multiple
   * experiments associated with the same flag.
   */
  experiment_key?: string;
};

/**
 * Interface for enabling tracking {@link Exposure}s through the
 * {@link ExperimentClient}.
 *
 * If you're using the Amplitude Analytics SDK for tracking you do not need
 * to implement this interface. Simply upgrade your analytics SDK version to
 * 2.36.0+ and initialize experiment using the
 * {@link Experiment.initializeWithAmplitudeAnalytics} function.
 *
 * If you're using a 3rd party analytics implementation then you'll need to
 * implement the sending of the analytics event yourself. The implementation
 * should result in the following event getting sent to amplitude:
 *
 * ```
 * {
 *   "event_type": "$exposure",
 *   "event_properties": {
 *     "flag_key": "<flagKey>",
 *     "variant": "<variant>"
 *   }
 * }
 * ```
 *
 * For example, if you're using Segment for analytics:
 *
 * ```
 * analytics.track('$exposure', exposure)
 * ```
 */
export interface ExposureTrackingProvider {
  /**
   * Called when the {@link ExperimentClient} intends to track an exposure event;
   * either when {@link ExperimentClient.variant} serves a variant (and
   * {@link ExperimentConfig.automaticExposureTracking} is `true`) or if
   * {@link ExperimentClient.exposure} is called.
   *
   * The implementation should result in the following event getting sent to
   * amplitude:
   *
   * ```
   * {
   *   "event_type": "$exposure",
   *   "event_properties": {
   *     "flag_key": "<flagKey>",
   *     "variant": "<variant>",
   *     "experiment_key": "<expKey>"
   *   }
   * }
   * ```
   *
   * For example, if you're using Segment for analytics:
   *
   * ```
   * analytics.track('$exposure', exposure)
   * ```
   */
  track(exposure: Exposure): void;
}
