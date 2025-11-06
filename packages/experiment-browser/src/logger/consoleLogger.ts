/* eslint-disable no-console,@typescript-eslint/no-explicit-any*/
import { Logger } from '../types/logger';

/**
 * Default console-based logger implementation.
 * This logger uses the browser's console API to output log messages.
 * Log level filtering is handled by the AmpLogger wrapper class.
 * @category Logging
 */
export class ConsoleLogger implements Logger {
  /**
   * Log an error message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  error(message?: any, ...optionalParams: any[]): void {
    console.error(message, ...optionalParams);
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  warn(message?: any, ...optionalParams: any[]): void {
    console.warn(message, ...optionalParams);
  }

  /**
   * Log an informational message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  info(message?: any, ...optionalParams: any[]): void {
    console.info(message, ...optionalParams);
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  debug(message?: any, ...optionalParams: any[]): void {
    console.debug(message, ...optionalParams);
  }

  /**
   * Log a verbose message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  verbose(message?: any, ...optionalParams: any[]): void {
    console.debug(message, ...optionalParams);
  }
}
