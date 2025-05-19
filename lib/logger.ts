import pino from 'pino';
import log from 'loglevel'; // Import loglevel

const isProduction = process.env.NODE_ENV === 'production';
const isBrowser = typeof window !== 'undefined';
const isOnVercel = !!process.env.VERCEL; // Check for Vercel environment

// --- appLogger setup with loglevel --- 
const appChannel = 'app';
const appLogLevel = isProduction ? 'info' : 'debug';

if (!isBrowser && !isProduction) {
  // Server-side Development: Customize method factory for structured JSON output
  const originalFactory = log.methodFactory;
  log.methodFactory = (methodName, logLevel, loggerName) => {
    const rawMethod = originalFactory(methodName, logLevel, loggerName);
    return (...args: any[]) => {
      // Format into JSON object
      const logObject: Record<string, any> = {
        level: methodName.toUpperCase(), // e.g., INFO, WARN
        channel: appChannel,
        time: Date.now(), // Or use a more sophisticated timestamp
      };

      if (args.length === 1 && typeof args[0] === 'string') {
        logObject.msg = args[0];
      } else if (args.length === 1 && typeof args[0] === 'object') {
        // If single argument is an object, merge it (excluding potential Error properties)
        // Error objects will be handled by the next condition more specifically
        if (!(args[0] instanceof Error)) {
            Object.assign(logObject, args[0]);
        }
      }

      // Handle Error objects specifically
      const errorArg = args.find(arg => arg instanceof Error);
      if (errorArg) {
        logObject.err = {
          message: errorArg.message,
          stack: errorArg.stack,
          name: errorArg.name,
        };
        // If there are other arguments, add them as 'details' or merge them
        const otherArgs = args.filter(arg => !(arg instanceof Error));
        if (otherArgs.length > 0) {
            if (otherArgs.length === 1 && typeof otherArgs[0] === 'string') {
                logObject.msg = otherArgs[0]; // If a string message accompanies an error
            } else {
                logObject.details = otherArgs.length === 1 ? otherArgs[0] : otherArgs;
            }
        }
      } else if (args.length > 1) {
        // If multiple arguments and no error, assume first is msg and rest are details
        logObject.msg = args[0];
        logObject.details = args.slice(1).length === 1 ? args.slice(1)[0] : args.slice(1);
      }
      
      console.log(JSON.stringify(logObject));
    };
  };
  log.setLevel(appLogLevel as log.LogLevelDesc); 
  console.log(`[Logger Setup] appLogger (server-dev) using loglevel with JSON output, level: ${appLogLevel}`);
} else if (isBrowser && !isProduction) {
  // Client-side Development: Default loglevel behavior (uses console.* directly)
  log.setLevel(appLogLevel as log.LogLevelDesc);
  console.log(`[Logger Setup] appLogger (client-dev) using loglevel with direct console output, level: ${appLogLevel}`);
} else {
  // Production (Server & Client): Customize for JSON output if server, default for client
  if (!isBrowser) { // Production Server
    const originalFactory = log.methodFactory;
    log.methodFactory = (methodName, logLevel, loggerName) => {
      const rawMethod = originalFactory(methodName, logLevel, loggerName);
      return (...args: any[]) => {
        const logObject: Record<string, any> = {
          level: methodName.toUpperCase(),
          channel: appChannel,
          time: Date.now(),
        };
        if (args.length === 1 && typeof args[0] === 'string') logObject.msg = args[0];
        else if (args.length > 0) {
            logObject.msg = args[0];
            if (args.length > 1) logObject.details = args.slice(1).length === 1 ? args.slice(1)[0] : args.slice(1);
        }
        console.log(JSON.stringify(logObject));
      };
    };
  }
  log.setLevel(appLogLevel as log.LogLevelDesc);
  console.log(`[Logger Setup] appLogger (production) initialized, level: ${appLogLevel}`);
}

export const appLogger = log.getLogger(appChannel);

// --- statusLogger setup with pino --- 
let statusLoggerTransport: pino.TransportSingleOptions | undefined = {
  target: 'pino/file',
  options: { destination: './logs/status.log', mkdir: true },
};

if (isOnVercel && isProduction) {
  // On Vercel production, disable file logging for statusLogger, fallback to stdout
  console.log('[Logger Setup] statusLogger (Vercel prod) falling back to stdout, file logging disabled.');
  statusLoggerTransport = undefined; 
}

export const statusLogger = pino({
  level: 'info',
  name: 'status',
  formatters: {
    level(label: string) {
      return { level: label, channel: 'status' };
    },
  },
  transport: statusLoggerTransport,
});

// --- Test statusLogger --- 
// statusLogger.info({ action: 'logger_init', message: 'statusLogger initialized and test log written.' }); // Test line removed
// -------------------------

// Example usage:
// appLogger.info('Application event');
// statusLogger.info('System status update'); 