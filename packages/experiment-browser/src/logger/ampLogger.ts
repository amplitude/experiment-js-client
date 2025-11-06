/* eslint-disable @typescript-eslint/no-explicit-any*/
import { Logger, LogLevel } from '../types/logger';

/**
 * Internal logger class that wraps a Logger implementation and handles log level filtering.
 * This class provides a centralized logging mechanism for the Experiment client.
 * @category Logging
 */
export class AmpLogger implements Logger {
  private logger: Logger;
  private logLevel: LogLevel;

  /**
   * Creates a new AmpLogger instance
   * @param logger The underlying logger implementation to use
   * @param logLevel The minimum log level to output. Messages below this level will be ignored.
   */
  constructor(logger: Logger, logLevel: LogLevel = LogLevel.Error) {
    this.logger = logger;
    this.logLevel = logLevel;
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  error(message?: any, ...optionalParams: any[]): void {
    if (this.logLevel >= LogLevel.Error) {
      this.logger.error(message, ...optionalParams);
    }
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  warn(message?: any, ...optionalParams: any[]): void {
    if (this.logLevel >= LogLevel.Warn) {
      this.logger.warn(message, ...optionalParams);
    }
  }

  /**
   * Log an informational message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  info(message?: any, ...optionalParams: any[]): void {
    if (this.logLevel >= LogLevel.Info) {
      this.logger.info(message, ...optionalParams);
    }
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  debug(message?: any, ...optionalParams: any[]): void {
    if (this.logLevel >= LogLevel.Debug) {
      this.logger.debug(message, ...optionalParams);
    }
  }

  /**
   * Log a verbose message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  verbose(message?: any, ...optionalParams: any[]): void {
    if (this.logLevel >= LogLevel.Verbose) {
      this.logger.verbose(message, ...optionalParams);
    }
  }
}
