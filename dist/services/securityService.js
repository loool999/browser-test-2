"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSecurityService = initSecurityService;
exports.checkRateLimit = checkRateLimit;
exports.isIPBlocked = isIPBlocked;
exports.blockIP = blockIP;
exports.unblockIP = unblockIP;
exports.recordAuthFailure = recordAuthFailure;
exports.resetAuthFailures = resetAuthFailures;
exports.logRequest = logRequest;
exports.getSecurityHeaders = getSecurityHeaders;
exports.isSuspiciousUserAgent = isSuspiciousUserAgent;
exports.validateOrigin = validateOrigin;
exports.validateRequestMethod = validateRequestMethod;
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
exports.getRequestLogs = getRequestLogs;
exports.getBlockedIPs = getBlockedIPs;
const logger_1 = require("../utils/logger");
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
const rateLimits = new Map();
// Store blocked IPs
const blockedIPs = new Map();
// Store authentication failures
const authFailures = new Map();
// Store recent requests for monitoring
const requestLog = [];
// Known bad user agents (bots, crawlers, etc.)
const badUserAgents = [
    'bot', 'crawler', 'spider', 'wget', 'curl', 'scraper', 'semrush',
    'python-requests', 'go-http-client', 'aiohttp', 'apachebench', 'zgrab'
];
/**
 * Initialize security service
 */
function initSecurityService() {
    logger_1.logger.info('Initializing security service');
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
function checkRateLimit(ip) {
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
function isIPBlocked(ip) {
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
function blockIP(ip, reason, expiresAt) {
    const blockEntry = {
        ip,
        reason,
        blockedAt: Date.now(),
        expiresAt
    };
    blockedIPs.set(ip, blockEntry);
    logger_1.logger.warn(`Blocked IP: ${ip}, Reason: ${reason}`);
}
/**
 * Unblock an IP address
 */
function unblockIP(ip) {
    if (!blockedIPs.has(ip)) {
        return false;
    }
    blockedIPs.delete(ip);
    logger_1.logger.info(`Unblocked IP: ${ip}`);
    return true;
}
/**
 * Record an authentication failure
 */
function recordAuthFailure(ip) {
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
        blockIP(ip, `${failures.count} authentication failures`, now + settings.ipBlocking.blockDuration);
        authFailures.delete(ip);
        return true;
    }
    return false;
}
/**
 * Reset authentication failures for an IP
 */
function resetAuthFailures(ip) {
    authFailures.delete(ip);
}
/**
 * Log a request
 */
function logRequest(entry) {
    if (!settings.requestLogging.enabled) {
        return;
    }
    const logEntry = {
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
function getSecurityHeaders() {
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
function isSuspiciousUserAgent(userAgent) {
    const lowerUA = userAgent.toLowerCase();
    return badUserAgents.some(agent => lowerUA.includes(agent));
}
/**
 * Validate request origin
 */
function validateOrigin(origin) {
    if (settings.security.allowedOrigins.includes('*')) {
        return true;
    }
    return settings.security.allowedOrigins.includes(origin);
}
/**
 * Validate request method
 */
function validateRequestMethod(method) {
    return settings.security.allowedMethods.includes(method.toUpperCase());
}
/**
 * Get current security settings
 */
function getSettings() {
    return { ...settings };
}
/**
 * Update security settings
 */
function updateSettings(updates) {
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
function getRequestLogs(limit = 100) {
    return requestLog.slice(0, limit);
}
/**
 * Get blocked IP list
 */
function getBlockedIPs() {
    return Array.from(blockedIPs.values());
}
/**
 * Clean up expired blocks
 */
function cleanupExpiredBlocks() {
    const now = Date.now();
    for (const [ip, entry] of blockedIPs.entries()) {
        if (entry.expiresAt && entry.expiresAt < now) {
            blockedIPs.delete(ip);
            logger_1.logger.info(`Auto-unblocked IP ${ip} (expired)`);
        }
    }
}
//# sourceMappingURL=securityService.js.map