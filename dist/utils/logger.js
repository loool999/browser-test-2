"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = __importDefault(require("util"));
// Define log levels
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
// Set current log level from environment or default to INFO
const currentLogLevel = process.env.LOG_LEVEL
    ? (LogLevel[process.env.LOG_LEVEL] || LogLevel.INFO)
    : LogLevel.INFO;
const logDir = path_1.default.join(process.cwd(), 'logs');
// Create logs directory if it doesn't exist
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir);
}
const logFilePath = path_1.default.join(logDir, `server-${new Date().toISOString().split('T')[0]}.log`);
const errorFilePath = path_1.default.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);
/**
 * Format log message with timestamp
 */
function formatLogMessage(level, message, meta) {
    const timestamp = new Date().toISOString();
    let formattedMessage = `[${timestamp}] [${level}] ${message}`;
    if (meta) {
        formattedMessage += '\n' + util_1.default.inspect(meta, { depth: 5, colors: false });
    }
    return formattedMessage;
}
/**
 * Write log to console and file
 */
function writeLog(level, levelName, message, meta) {
    // Skip if below current log level
    if (level < currentLogLevel) {
        return;
    }
    const formattedMessage = formatLogMessage(levelName, message, meta);
    // Write to console
    if (level >= LogLevel.WARN) {
        console.error(formattedMessage);
    }
    else {
        console.log(formattedMessage);
    }
    // Write to appropriate log file
    const filePath = level >= LogLevel.WARN ? errorFilePath : logFilePath;
    fs_1.default.appendFile(filePath, formattedMessage + '\n', (err) => {
        if (err) {
            console.error('Failed to write to log file:', err);
        }
    });
}
// Logger implementation
exports.logger = {
    debug: (message, meta) => {
        writeLog(LogLevel.DEBUG, 'DEBUG', message, meta);
    },
    info: (message, meta) => {
        writeLog(LogLevel.INFO, 'INFO', message, meta);
    },
    warn: (message, meta) => {
        writeLog(LogLevel.WARN, 'WARN', message, meta);
    },
    error: (message, meta) => {
        writeLog(LogLevel.ERROR, 'ERROR', message, meta);
    },
};
//# sourceMappingURL=logger.js.map