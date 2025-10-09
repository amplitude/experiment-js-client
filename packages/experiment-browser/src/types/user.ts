/**
 * Defines a user context for evaluation.
 * `device_id` and `user_id` are used for identity resolution.
 * All other predefined fields and user properties are used for
 * rule based user targeting.
 * @category Types
 */
export type ExperimentUser = {
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
   * Predefined field, auto populated via a ExperimentUserProvider
   * or can be manually provided
   */
  language?: string;

  /**
   * Predefined field, auto populated via a ExperimentUserProvider
   * or can be manually provided
   */
  platform?: string;

  /**
   * Predefined field, auto populated via a ExperimentUserProvider
   * or can be manually provided
   */
  version?: string;

  /**
   * Predefined field, auto populated via a ExperimentUserProvider
   * or can be manually provided
   */
  os?: string;

  /**
   * Predefined field, auto populated via a ExperimentUserProvider
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
   * Predefined field, can be manually provided
   */
  ip_address?: string;

  /**
   * The time first saw this user, stored in local storage, can be manually overridden
   */
  first_seen?: string;

  /**
   * The device category of the device, auto populated via a ExperimentUserProvider, can be manually overridden
   */
  device_category?:
    | 'mobile'
    | 'tablet'
    | 'desktop'
    | 'wearable'
    | 'console'
    | 'smarttv'
    | 'embedded';

  /**
   * The referring url that redirected to this page, auto populated via a ExperimentUserProvider, can be manually overridden
   */
  referring_url?: string;

  /**
   * The cookies, auto populated via a ExperimentUserProvider, can be manually overridden
   * Local evaluation only. Stripped before remote evaluation.
   */
  cookie?: Record<string, string>;

  /**
   * The browser used, auto populated via a ExperimentUserProvider, can be manually overridden
   */
  browser?: string;

  /**
   * The landing page of the user, the first page that this user sees for this deployment
   * Auto populated via a ExperimentUserProvider, can be manually overridden
   */
  landing_url?: string;

  /**
   * The url params of the page, for one param, value is string if single value, array of string if multiple values
   * Auto populated via a ExperimentUserProvider, can be manually overridden
   */
  url_param?: Record<string, string | string[]>;

  persisted_utm_param?: Record<string, string | string[]>;

  /**
   * The user agent string.
   */
  user_agent?: string;

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

  groups?: {
    [groupType: string]: string[];
  };

  group_properties?: {
    [groupType: string]: {
      [groupName: string]: {
        [propertyName: string]:
          | string
          | number
          | boolean
          | Array<string | number | boolean>;
      };
    };
  };
};

export type UserProperties = {
  [propertyName: string]:
    | string
    | number
    | boolean
    | Array<string | number | boolean>;
};
