"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemError = exports.StreamError = exports.BrowserError = exports.RateLimitError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = exports.ErrorType = void 0;
exports.errorHandlerMiddleware = errorHandlerMiddleware;
exports.asyncHandler = asyncHandler;
exports.reportError = reportError;
const logger_1 = require("./logger");
// Define error types
var ErrorType;
(function (ErrorType) {
    ErrorType["VALIDATION"] = "validation_error";
    ErrorType["AUTHENTICATION"] = "authentication_error";
    ErrorType["AUTHORIZATION"] = "authorization_error";
    ErrorType["NOT_FOUND"] = "not_found";
    ErrorType["RATE_LIMIT"] = "rate_limit";
    ErrorType["BROWSER_ERROR"] = "browser_error";
    ErrorType["STREAM_ERROR"] = "stream_error";
    ErrorType["SYSTEM_ERROR"] = "system_error";
    ErrorType["CONFIGURATION_ERROR"] = "configuration_error";
    ErrorType["EXTERNAL_SERVICE_ERROR"] = "external_service_error";
    ErrorType["DATABASE_ERROR"] = "database_error";
    ErrorType["UNEXPECTED_ERROR"] = "unexpected_error";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
// Custom error class
class AppError extends Error {
    message;
    type;
    statusCode;
    details;
    constructor(message, type = ErrorType.UNEXPECTED_ERROR, statusCode = 500, details) {
        super(message);
        this.message = message;
        this.type = type;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AppError';
        // Maintains proper stack trace (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
exports.AppError = AppError;
// Validation error
class ValidationError extends AppError {
    constructor(message, details) {
        super(message, ErrorType.VALIDATION, 400, details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
// Authentication error
class AuthenticationError extends AppError {
    constructor(message) {
        super(message, ErrorType.AUTHENTICATION, 401);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
// Authorization error
class AuthorizationError extends AppError {
    constructor(message) {
        super(message, ErrorType.AUTHORIZATION, 403);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
// Not found error
class NotFoundError extends AppError {
    constructor(message) {
        super(message, ErrorType.NOT_FOUND, 404);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
// Rate limit error
class RateLimitError extends AppError {
    constructor(message) {
        super(message, ErrorType.RATE_LIMIT, 429);
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
// Browser error
class BrowserError extends AppError {
    constructor(message, details) {
        super(message, ErrorType.BROWSER_ERROR, 500, details);
        this.name = 'BrowserError';
    }
}
exports.BrowserError = BrowserError;
// Streaming error
class StreamError extends AppError {
    constructor(message, details) {
        super(message, ErrorType.STREAM_ERROR, 500, details);
        this.name = 'StreamError';
    }
}
exports.StreamError = StreamError;
// System error
class SystemError extends AppError {
    constructor(message, details) {
        super(message, ErrorType.SYSTEM_ERROR, 500, details);
        this.name = 'SystemError';
    }
}
exports.SystemError = SystemError;
/**
 * Global error handler middleware for Express
 */
function errorHandlerMiddleware(err, req, res, next) {
    // Log the error
    if (err instanceof AppError) {
        logger_1.logger.error(`${err.name}: ${err.message}`, {
            type: err.type,
            details: err.details,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            user: req.user?.id
        });
    }
    else {
        logger_1.logger.error(`Unexpected Error: ${err.message}`, {
            stack: err.stack,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip
        });
    }
    // Format error for client
    const formattedError = {
        error: {
            type: err instanceof AppError ? err.type : ErrorType.UNEXPECTED_ERROR,
            message: err.message || 'An unexpected error occurred'
        },
        success: false
    };
    // Include error details if available and safe to share
    if (err instanceof AppError && err.details) {
        formattedError.error.details = err.details;
    }
    // Set status code
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    // Send JSON response
    res.status(statusCode).json(formattedError);
}
/**
 * Async wrapper to handle promise rejections in Express routes
 */
function asyncHandler(fn) {
    return function (req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
/**
 * Report an error without throwing it
 */
function reportError(error, context) {
    if (typeof error === 'string') {
        logger_1.logger.error(error, context);
    }
    else {
        logger_1.logger.error(`${error.name}: ${error.message}`, {
            stack: error.stack,
            ...context
        });
    }
}
//# sourceMappingURL=errorHandler.js.map