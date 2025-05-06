import fs from 'fs';
import path from 'path';
import util from 'util';

// Define log levels
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Set current log level from environment or default to INFO
const currentLogLevel = process.env.LOG_LEVEL 
  ? (LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] || LogLevel.INFO) 
  : LogLevel.INFO;

const logDir = path.join(process.cwd(), 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFilePath = path.join(logDir, `server-${new Date().toISOString().split('T')[0]}.log`);
const errorFilePath = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);

/**
 * Format log message with timestamp
 */
function formatLogMessage(level: string, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  let formattedMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (meta) {
    formattedMessage += '\n' + util.inspect(meta, { depth: 5, colors: false });
  }
  
  return formattedMessage;
}

/**
 * Write log to console and file
 */
function writeLog(level: LogLevel, levelName: string, message: string, meta?: any): void {
  // Skip if below current log level
  if (level < currentLogLevel) {
    return;
  }
  
  const formattedMessage = formatLogMessage(levelName, message, meta);
  
  // Write to console
  if (level >= LogLevel.WARN) {
    console.error(formattedMessage);
  } else {
    console.log(formattedMessage);
  }
  
  // Write to appropriate log file
  const filePath = level >= LogLevel.WARN ? errorFilePath : logFilePath;
  fs.appendFile(filePath, formattedMessage + '\n', (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

// Logger implementation
export const logger = {
  debug: (message: string, meta?: any) => {
    writeLog(LogLevel.DEBUG, 'DEBUG', message, meta);
  },
  
  info: (message: string, meta?: any) => {
    writeLog(LogLevel.INFO, 'INFO', message, meta);
  },
  
  warn: (message: string, meta?: any) => {
    writeLog(LogLevel.WARN, 'WARN', message, meta);
  },
  
  error: (message: string, meta?: any) => {
    writeLog(LogLevel.ERROR, 'ERROR', message, meta);
  },
};
