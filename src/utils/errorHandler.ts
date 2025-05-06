import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Define error types
export enum ErrorType {
  VALIDATION = 'validation_error',
  AUTHENTICATION = 'authentication_error',
  AUTHORIZATION = 'authorization_error',
  NOT_FOUND = 'not_found',
  RATE_LIMIT = 'rate_limit',
  BROWSER_ERROR = 'browser_error',
  STREAM_ERROR = 'stream_error',
  SYSTEM_ERROR = 'system_error',
  CONFIGURATION_ERROR = 'configuration_error',
  EXTERNAL_SERVICE_ERROR = 'external_service_error',
  DATABASE_ERROR = 'database_error',
  UNEXPECTED_ERROR = 'unexpected_error'
}

// Custom error class
export class AppError extends Error {
  constructor(
    public message: string,
    public type: ErrorType = ErrorType.UNEXPECTED_ERROR,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    
    // Maintains proper stack trace (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Validation error
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.VALIDATION, 400, details);
    this.name = 'ValidationError';
  }
}

// Authentication error
export class AuthenticationError extends AppError {
  constructor(message: string) {
    super(message, ErrorType.AUTHENTICATION, 401);
    this.name = 'AuthenticationError';
  }
}

// Authorization error
export class AuthorizationError extends AppError {
  constructor(message: string) {
    super(message, ErrorType.AUTHORIZATION, 403);
    this.name = 'AuthorizationError';
  }
}

// Not found error
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, ErrorType.NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

// Rate limit error
export class RateLimitError extends AppError {
  constructor(message: string) {
    super(message, ErrorType.RATE_LIMIT, 429);
    this.name = 'RateLimitError';
  }
}

// Browser error
export class BrowserError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.BROWSER_ERROR, 500, details);
    this.name = 'BrowserError';
  }
}

// Streaming error
export class StreamError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.STREAM_ERROR, 500, details);
    this.name = 'StreamError';
  }
}

// System error
export class SystemError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.SYSTEM_ERROR, 500, details);
    this.name = 'SystemError';
  }
}

// Simplified error for client responses
interface ClientError {
  error: {
    type: string;
    message: string;
    details?: any;
  };
  success: false;
}

/**
 * Global error handler middleware for Express
 */
export function errorHandlerMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log the error
  if (err instanceof AppError) {
    logger.error(`${err.name}: ${err.message}`, {
      type: err.type,
      details: err.details,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      user: (req as any).user?.id
    });
  } else {
    logger.error(`Unexpected Error: ${err.message}`, {
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
  }
  
  // Format error for client
  const formattedError: ClientError = {
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
export function asyncHandler(fn: Function) {
  return function(req: Request, res: Response, next: NextFunction) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Report an error without throwing it
 */
export function reportError(
  error: Error | string,
  context?: Record<string, any>
) {
  if (typeof error === 'string') {
    logger.error(error, context);
  } else {
    logger.error(`${error.name}: ${error.message}`, {
      stack: error.stack,
      ...context
    });
  }
}