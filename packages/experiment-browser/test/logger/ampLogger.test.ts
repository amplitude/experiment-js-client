import { AmpLogger } from '../../src/logger/ampLogger';
import { Logger, LogLevel } from '../../src/types/logger';

describe('AmpLogger', () => {
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };
  });

  const logLevelTests = [
    { level: LogLevel.Disable, logs: [] },
    { level: LogLevel.Error, logs: ['error'] },
    { level: LogLevel.Warn, logs: ['error', 'warn'] },
    { level: LogLevel.Info, logs: ['error', 'warn', 'info'] },
    { level: LogLevel.Debug, logs: ['error', 'warn', 'info', 'debug'] },
    {
      level: LogLevel.Verbose,
      logs: ['error', 'warn', 'info', 'debug', 'verbose'],
    },
  ];

  test.each(logLevelTests)(
    'LogLevel.$level should log: $logs',
    ({ level, logs }) => {
      const logger = new AmpLogger(mockLogger, level);
      const methods = ['error', 'warn', 'info', 'debug', 'verbose'] as const;

      methods.forEach((method) => {
        logger[method](method);
      });

      methods.forEach((method) => {
        if (logs.includes(method)) {
          expect(mockLogger[method]).toHaveBeenCalledWith(method);
        } else {
          expect(mockLogger[method]).not.toHaveBeenCalled();
        }
      });
    },
  );

  test('should default to LogLevel.Error when no log level is provided', () => {
    const logger = new AmpLogger(mockLogger);

    logger.error('error');
    logger.warn('warn');

    expect(mockLogger.error).toHaveBeenCalledWith('error');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('should pass optional parameters to underlying logger', () => {
    const logger = new AmpLogger(mockLogger, LogLevel.Verbose);

    logger.error('error', { code: 500 }, 'extra');
    logger.verbose('verbose', 1, 2, 3);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'error',
      { code: 500 },
      'extra',
    );
    expect(mockLogger.verbose).toHaveBeenCalledWith('verbose', 1, 2, 3);
  });
});
