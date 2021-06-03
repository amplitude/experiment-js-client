import { Variant, Variants } from './types/variant';

/**
 * Determines the primary source of variants before falling back.
 *
 * @category Configuration
 */
export enum Source {
  /**
   * The default way to source variants within your application. Before the
   * assignments are fetched, `getVariant(s)` will fallback to local storage
   * first, then `initialVariants` if local storage is empty. This option
   * effectively falls back to an assignment fetched previously.
   */
  LocalStorage = 'localStorage',

  /**
   * This bootstrap option is used primarily for servers-side rendering using an
   * Experiment server SDK. This bootstrap option always prefers the config
   * `initialVariants` over data in local storage, even if variants are fetched
   * successfully and stored locally.
   */
  InitialVariants = 'initialVariants',
}

/**
 * @category Configuration
 */
export interface ExperimentConfig {
  /**
   * Debug all assignment requests in the UI Debugger and log additional
   * information to the console. This should be false for production builds.
   */
  debug?: boolean;

  /**
   * The default fallback variant for all {@link ExperimentClient.variant}
   * calls.
   */
  fallbackVariant?: Variant;

  /**
   * Initial values for variants. This is useful for bootstrapping the
   * client with fallbacks and values evaluated from server-side rendering.
   * @see Variants
   */
  initialVariants?: Variants;

  /**
   * Determines the primary source of variants and variants before falling back.
   * @see Source
   */
  source?: Source;

  /**
   * The server endpoint from which to request variants.
   */
  serverUrl?: string;

  /**
   * The request timeout, in milliseconds, when fetching variants.
   */
  fetchTimeoutMillis?: number;

  /**
   * Set to true to retry fetch requests in the background if the initial
   * requests fails or times out.
   */
  retryFetchOnFailure?: boolean;
}

/**
 Defaults for Experiment Config options

 | **Option**       | **Default**                       |
 |------------------|-----------------------------------|
 | **debug**        | `false`                           |
 | **fallbackVariant**         | `null`                 |
 | **initialVariants**         | `null`                 |
 | **source** | `Source.LocalStorage` |
 | **serverUrl**    | `"https://api.lab.amplitude.com"` |
 | **assignmentTimeoutMillis**    | `10000` |
 | **retryFailedAssignment**    | `true` |

 *
 * @category Configuration
 */
export const Defaults: ExperimentConfig = {
  debug: false,
  fallbackVariant: {},
  initialVariants: {},
  source: Source.LocalStorage,
  serverUrl: 'https://api.lab.amplitude.com',
  fetchTimeoutMillis: 10000,
  retryFetchOnFailure: true,
};
