import { Variant, Flags } from './types/variant';

/**
 * @category Configuration
 */
export interface ExperimentConfig {
  /**
   * The environment API key (required).
   */
  apiKey: string;

  /**
   * Debug all assignment requests in the UI Debugger and log additional information to the console.
   * This should be false for production builds.
   */
  debug?: boolean;

  /**
   * The default fallback variant for all {@link ExperimentClient.getVariant} calls.
   */
  fallbackVariant?: Variant;

  /**
   * Initial variant values for flags. This is useful for bootstrapping the client with
   * values determined on the server.
   */
  initialFlags?: Flags;

  /**
   * The server endpoint from which to request variants.
   */
  serverUrl?: string;

  /**
   * The assignment request timeout, in milliseconds, used when fetching variants triggered by calling start() or setUser().
   */
  assignmentTimeoutMillis?: number;

  /**
   * Set to true to retry assignment requests in the background if the initial requests fails or times out.
   */
  retryAssignmentOnFailure?: boolean;
}

/**
 Defaults for Experiment Config options

 | **Option**       | **Default**                       |
 |------------------|-----------------------------------|
 | **debug**        | false                             |
 | **fallbackVariant**         | null                   |
 | **initialFlags**         | null                   |
 | **serverUrl**    | `"https://api.lab.amplitude.com"` |
 | **assignmentTimeoutMillis**    | `10000` |
 | **retryFailedAssignment**    | `true` |


 *
 * @category Configuration
 */
export const Defaults: ExperimentConfig = {
  debug: false,
  fallbackVariant: null,
  initialFlags: null,
  serverUrl: 'https://api.lab.amplitude.com',
  assignmentTimeoutMillis: 10000,
  retryAssignmentOnFailure: true,
};
