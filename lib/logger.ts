import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const appLogger = pino({
  level: isProduction ? 'info' : 'debug',
  formatters: {
    level(label: string) {
      return { level: label, channel: 'app' }; // Standard pino practice is to keep 'level'
    },
  },
  transport: isProduction
    ? undefined // Default to stdout in production, or configure specific production transport
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname', // Optional: clean up pretty print
          translateTime: 'SYS:standard', // Optional: human-readable time
        },
      },
});

export const statusLogger = pino({
  level: 'info',
  name: 'status', // Name can be useful for filtering if logs are aggregated
  formatters: {
    level(label: string) {
      return { level: label, channel: 'status' };
    },
  },
  // Ensure the 'logs' directory exists or pino might have issues
  transport: {
    target: 'pino/file',
    options: { destination: './logs/status.log', mkdir: true }, // mkdir: true will create the directory if it doesn't exist
  },
});

// Example usage (will be replaced in actual files):
// appLogger.info('This is an app information message.');
// appLogger.debug('This is an app debug message.');
// appLogger.error(new Error('Something went wrong in the app!'), 'App error details');
// statusLogger.info('A status update has occurred.'); 