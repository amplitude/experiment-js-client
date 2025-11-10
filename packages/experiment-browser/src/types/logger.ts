/**
 * Log level enumeration for controlling logging verbosity.
 * @category Logging
 */
export enum LogLevel {
  /**
   * Disable all logging
   */
  Disable = 0,
  /**
   * Error level logging - only critical errors
   */
  Error = 1,
  /**
   * Warning level logging - errors and warnings
   */
  Warn = 2,
  /**
   * Info level logging - errors, warnings, and informational messages
   */
  Info = 3,
  /**
   * Debug level logging - errors, warnings, info, and debug messages
   */
  Debug = 4,
  /**
   * Verbose level logging - all messages including verbose details
   */
  Verbose = 5,
}

/**
 * Logger interface that can be implemented to provide custom logging.
 * @category Logging
 */
export interface Logger {
  /**
   * Log an error message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  error(message?: any, ...optionalParams: any[]): void;

  /**
   * Log a warning message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  warn(message?: any, ...optionalParams: any[]): void;

  /**
   * Log an informational message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  info(message?: any, ...optionalParams: any[]): void;

  /**
   * Log a debug message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  debug(message?: any, ...optionalParams: any[]): void;

  /**
   * Log a verbose message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  verbose(message?: any, ...optionalParams: any[]): void;
}
