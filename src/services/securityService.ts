import { logger } from '../utils/logger';

// Rate limit entry structure
interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

// IP block entry structure
interface IPBlockEntry {
  ip: string;
  reason: string;
  blockedAt: number;
  expiresAt?: number;
}

// Request logging entry
interface RequestLogEntry {
  ip: string;
  method: string;
  path: string;
  userAgent: string;
  timestamp: number;
  sessionId?: string;
}

// Security settings
const settings = {
  rateLimiting: {
    enabled: true,
    requestLimit: 100, // Max requests per window
    timeWindow: 60 * 1000, // Window size in ms (1 minute)
    blockDuration: 10 * 60 * 1000, // 10 minutes
  },
  ipBlocking: {
    enabled: true,
    maxFailedAttempts: 5,
    failureWindow: 5 * 60 * 1000, // 5 minutes
    blockDuration: 60 * 60 * 1000, // 1 hour
  },
  requestLogging: {
    enabled: true,
    logSize: 1000, // Max number of requests to keep in memory
  },
  security: {
    allowedOrigins: ['*'], // Set to specific origins in production
    allowedMethods: ['GET', 'POST', 'OPTIONS'],
    contentSecurityPolicy: "default-src 'self'; connect-src 'self' wss://*; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
    frameOptions: 'DENY',
    xssProtection: '1; mode=block',
    noSniff: true,
  }
};

// Store rate limits by IP
const rateLimits = new Map<string, RateLimitEntry>();

// Store blocked IPs
const blockedIPs = new Map<string, IPBlockEntry>();

// Store authentication failures
const authFailures = new Map<string, { count: number, firstFailure: number }>();

// Store recent requests for monitoring
const requestLog: RequestLogEntry[] = [];

// Known bad user agents (bots, crawlers, etc.)
const badUserAgents = [
  'bot', 'crawler', 'spider', 'wget', 'curl', 'scraper', 'semrush', 
  'python-requests', 'go-http-client', 'aiohttp', 'apachebench', 'zgrab'
];

/**
 * Initialize security service
 */
export function initSecurityService() {
  logger.info('Initializing security service');
  
  // Clean up expired blocks periodically
  setInterval(cleanupExpiredBlocks, 15 * 60 * 1000);
  
  return {
    checkRateLimit,
    isIPBlocked,
    blockIP,
    unblockIP,
    recordAuthFailure,
    resetAuthFailures,
    logRequest,
    getSecurityHeaders,
    isSuspiciousUserAgent,
    validateOrigin,
    validateRequestMethod,
    getSettings,
    updateSettings,
  };
}

/**
 * Check if an IP is rate limited
 */
export function checkRateLimit(ip: string): { 
  allowed: boolean; 
  remaining: number; 
  resetTime?: number;
} {
  if (!settings.rateLimiting.enabled) {
    return { allowed: true, remaining: Infinity };
  }
  
  // Check if IP is already blocked
  if (isIPBlocked(ip)) {
    return { allowed: false, remaining: 0 };
  }
  
  const now = Date.now();
  let entry = rateLimits.get(ip);
  
  // If no entry or entry has expired, create a new one
  if (!entry || (now - entry.firstRequest) > settings.rateLimiting.timeWindow) {
    entry = {
      count: 1,
      firstRequest: now,
      lastRequest: now
    };
    rateLimits.set(ip, entry);
    
    return {
      allowed: true,
      remaining: settings.rateLimiting.requestLimit - 1,
      resetTime: now + settings.rateLimiting.timeWindow
    };
  }
  
  // Update existing entry
  entry.count++;
  entry.lastRequest = now;
  
  // Check if limit exceeded
  if (entry.count > settings.rateLimiting.requestLimit) {
    // Block IP temporarily
    blockIP(ip, 'Rate limit exceeded', now + settings.rateLimiting.blockDuration);
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: now + settings.rateLimiting.blockDuration
    };
  }
  
  return {
    allowed: true,
    remaining: settings.rateLimiting.requestLimit - entry.count,
    resetTime: entry.firstRequest + settings.rateLimiting.timeWindow
  };
}

/**
 * Check if an IP is blocked
 */
export function isIPBlocked(ip: string): boolean {
  if (!settings.ipBlocking.enabled) {
    return false;
  }
  
  const block = blockedIPs.get(ip);
  if (!block) {
    return false;
  }
  
  // Check if block has expired
  if (block.expiresAt && block.expiresAt < Date.now()) {
    blockedIPs.delete(ip);
    return false;
  }
  
  return true;
}

/**
 * Block an IP address
 */
export function blockIP(ip: string, reason: string, expiresAt?: number): void {
  const blockEntry: IPBlockEntry = {
    ip,
    reason,
    blockedAt: Date.now(),
    expiresAt
  };
  
  blockedIPs.set(ip, blockEntry);
  logger.warn(`Blocked IP: ${ip}, Reason: ${reason}`);
}

/**
 * Unblock an IP address
 */
export function unblockIP(ip: string): boolean {
  if (!blockedIPs.has(ip)) {
    return false;
  }
  
  blockedIPs.delete(ip);
  logger.info(`Unblocked IP: ${ip}`);
  return true;
}

/**
 * Record an authentication failure
 */
export function recordAuthFailure(ip: string): boolean {
  if (!settings.ipBlocking.enabled) {
    return false;
  }
  
  const now = Date.now();
  let failures = authFailures.get(ip);
  
  if (!failures || (now - failures.firstFailure) > settings.ipBlocking.failureWindow) {
    failures = {
      count: 1,
      firstFailure: now
    };
    authFailures.set(ip, failures);
    return false;
  }
  
  failures.count++;
  
  // Check if max failures exceeded
  if (failures.count >= settings.ipBlocking.maxFailedAttempts) {
    blockIP(
      ip, 
      `${failures.count} authentication failures`, 
      now + settings.ipBlocking.blockDuration
    );
    authFailures.delete(ip);
    return true;
  }
  
  return false;
}

/**
 * Reset authentication failures for an IP
 */
export function resetAuthFailures(ip: string): void {
  authFailures.delete(ip);
}

/**
 * Log a request
 */
export function logRequest(entry: Omit<RequestLogEntry, 'timestamp'>): void {
  if (!settings.requestLogging.enabled) {
    return;
  }
  
  const logEntry: RequestLogEntry = {
    ...entry,
    timestamp: Date.now()
  };
  
  requestLog.unshift(logEntry);
  
  // Trim log if it exceeds max size
  if (requestLog.length > settings.requestLogging.logSize) {
    requestLog.pop();
  }
}

/**
 * Get security headers for HTTP responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': settings.security.contentSecurityPolicy,
    'X-Frame-Options': settings.security.frameOptions,
    'X-XSS-Protection': settings.security.xssProtection,
    'X-Content-Type-Options': settings.security.noSniff ? 'nosniff' : '',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'no-referrer-when-downgrade',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  };
}

/**
 * Check if a user agent string is suspicious
 */
export function isSuspiciousUserAgent(userAgent: string): boolean {
  const lowerUA = userAgent.toLowerCase();
  return badUserAgents.some(agent => lowerUA.includes(agent));
}

/**
 * Validate request origin
 */
export function validateOrigin(origin: string): boolean {
  if (settings.security.allowedOrigins.includes('*')) {
    return true;
  }
  
  return settings.security.allowedOrigins.includes(origin);
}

/**
 * Validate request method
 */
export function validateRequestMethod(method: string): boolean {
  return settings.security.allowedMethods.includes(method.toUpperCase());
}

/**
 * Get current security settings
 */
export function getSettings(): typeof settings {
  return { ...settings };
}

/**
 * Update security settings
 */
export function updateSettings(updates: Partial<typeof settings>): typeof settings {
  // Deep merge the updates
  if (updates.rateLimiting) {
    settings.rateLimiting = {
      ...settings.rateLimiting,
      ...updates.rateLimiting
    };
  }
  
  if (updates.ipBlocking) {
    settings.ipBlocking = {
      ...settings.ipBlocking,
      ...updates.ipBlocking
    };
  }
  
  if (updates.requestLogging) {
    settings.requestLogging = {
      ...settings.requestLogging,
      ...updates.requestLogging
    };
  }
  
  if (updates.security) {
    settings.security = {
      ...settings.security,
      ...updates.security
    };
  }
  
  return { ...settings };
}

/**
 * Get recent request logs
 */
export function getRequestLogs(limit: number = 100): RequestLogEntry[] {
  return requestLog.slice(0, limit);
}

/**
 * Get blocked IP list
 */
export function getBlockedIPs(): IPBlockEntry[] {
  return Array.from(blockedIPs.values());
}

/**
 * Clean up expired blocks
 */
function cleanupExpiredBlocks(): void {
  const now = Date.now();
  
  for (const [ip, entry] of blockedIPs.entries()) {
    if (entry.expiresAt && entry.expiresAt < now) {
      blockedIPs.delete(ip);
      logger.info(`Auto-unblocked IP ${ip} (expired)`);
    }
  }
}