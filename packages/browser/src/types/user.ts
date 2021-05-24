/**
 * Defines a user context for evaluation.
 * `device_id` and `user_id` are used for identity resolution.
 * All other predefined fields and user properties are used for
 * rule based user targeting.
 * @category Types
 */
export type SkylabUser = {
  /**
   * Device ID for associating with an identity in Amplitude
   */
  device_id?: string;

  /**
   * User ID for associating with an identity in Amplitude
   */
  user_id?: string;

  /**
   * Predefined field, can be manually provided
   */
  country?: string;

  /**
   * Predefined field, can be manually provided
   */
  city?: string;

  /**
   * Predefined field, can be manually provided
   */
  region?: string;

  /**
   * Predefined field, can be manually provided
   */
  dma?: string;

  /**
   * Predefined field, auto populated via a ContextProvider
   * or can be manually provided
   */
  language?: string;

  /**
   * Predefined field, auto populated via a ContextProvider
   * or can be manually provided
   */
  platform?: string;

  /**
   * Predefined field, auto populated via a ContextProvider
   * or can be manually provided
   */
  os?: string;

  /**
   * Predefined field, can be manually provided
   */
  device_family?: string;

  /**
   * Predefined field, can be manually provided
   */
  device_type?: string;

  /**
   * Predefined field, auto populated via a ContextProvider
   * or can be manually provided
   */
  device_model?: string;

  /**
   * Predefined field, can be manually provided
   */
  carrier?: string;

  /**
   * Predefined field, auto populated, can be manually overridden
   */
  library?: string;

  /**
   * Custom user properties
   */
  user_properties?: {
    [propertyName: string]:
      | string
      | number
      | boolean
      | Array<string | number | boolean>;
  };
};
