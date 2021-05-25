import { Variant, Flags } from './types/variant';

/**
 * Determines the primary source of flags and variants before falling back.
 * @category Configuration
 */
export enum Source {
  /**
   * The default way to source variants within your application. Before the
   * assignments are fetched, `getVariant(s)` will fallback to local storage
   * first, then `initialFlags` if local storage is empty. This option
   * effectively falls back to an assignment fetched previously.
   */
  LocalStorage = 'localStorage',
  /**
   * This bootstrap option is used primarily for servers-side rendering using an
   * Experiment server SDK. This bootstrap option always prefers `intialFlags`
   * over data in local storage, even if variants are fetched successfully and
   * stored locally.
   */
  InitialFlags = 'intialFlags',
}

/**
 * @category Configuration
 */
export interface ExperimentConfig {
  /**
   * The environment API key (required).
   */
  apiKey: string;

  /**
   * Debug all assignment requests in the UI Debugger and log additional
   * information to the console. This should be false for production builds.
   */
  debug?: boolean;

  /**
   * The default fallback variant for all {@link ExperimentClient.getVariant}
   * calls.
   */
  fallbackVariant?: Variant;

  /**
   * Initial variant values for flags. This is useful for bootstrapping the
   * client with fallbacks and values evaluated from server-side rendering.
   * @see Flags
   */
  initialFlags?: Flags;

  /**
   * Determines the primary source of flags and variants before falling back.
   * @see Source
   */
  source?: Source;

  /**
   * The server endpoint from which to request variants.
   */
  serverUrl?: string;

  /**
   * The assignment request timeout, in milliseconds, used when fetching
   * variants triggered by calling start() or setUser().
   */
  assignmentTimeoutMillis?: number;

  /**
   * Set to true to retry assignment requests in the background if the initial
   * requests fails or times out.
   */
  retryAssignmentOnFailure?: boolean;
}

/**
 Defaults for Experiment Config options

 | **Option**       | **Default**                       |
 |------------------|-----------------------------------|
 | **debug**        | `false`                           |
 | **fallbackVariant**         | `null`                 |
 | **initialFlags**         | `null`                 |
 | **serverUrl**    | `"https://api.lab.amplitude.com"` |
 | **assignmentTimeoutMillis**    | `10000` |
 | **retryFailedAssignment**    | `true` |


 *
 * @category Configuration
 */
export const Defaults: ExperimentConfig = {
  apiKey: null,
  debug: false,
  fallbackVariant: null,
  initialFlags: null,
  source: Source.LocalStorage,
  serverUrl: 'https://api.lab.amplitude.com',
  assignmentTimeoutMillis: 10000,
  retryAssignmentOnFailure: true,
};
