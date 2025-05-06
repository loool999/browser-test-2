"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionType = void 0;
exports.initSessionService = initSessionService;
exports.createSession = createSession;
exports.getSession = getSession;
exports.updateSession = updateSession;
exports.deleteSession = deleteSession;
exports.getOrCreateSession = getOrCreateSession;
exports.validateSession = validateSession;
exports.getSessionSettings = getSessionSettings;
exports.updateSessionBrowserId = updateSessionBrowserId;
exports.getAllSessions = getAllSessions;
exports.getSessionCount = getSessionCount;
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
// Session types
var SessionType;
(function (SessionType) {
    SessionType["ANONYMOUS"] = "anonymous";
    SessionType["AUTHENTICATED"] = "authenticated";
    SessionType["ADMIN"] = "admin";
})(SessionType || (exports.SessionType = SessionType = {}));
// Session store
const sessions = new Map();
const tokenToSessionMap = new Map();
// Session timeout (in milliseconds)
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
const SESSION_CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
/**
 * Initialize session service and set up cleanup
 */
function initSessionService() {
    logger_1.logger.info('Initializing session service');
    // Set up cleanup interval
    setInterval(cleanupInactiveSessions, SESSION_CLEANUP_INTERVAL);
    return {
        createSession,
        getSession,
        updateSession,
        deleteSession,
        getOrCreateSession,
        validateSession,
        getSessionSettings,
        updateSessionBrowserId,
        getAllSessions,
        getSessionCount
    };
}
/**
 * Create a new session
 */
function createSession(options) {
    const sessionId = (0, uuid_1.v4)();
    const sessionToken = (0, uuid_1.v4)();
    const session = {
        id: sessionId,
        token: sessionToken,
        type: options.type || SessionType.ANONYMOUS,
        userId: options.userId,
        username: options.username,
        createdAt: new Date(),
        lastActivity: new Date(),
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        settings: {
            fps: 30,
            quality: 80,
            adaptiveBitrate: true,
            resolution: { width: 1920, height: 1080 },
            ...(options.settings || {})
        },
        metadata: options.metadata || {}
    };
    sessions.set(sessionId, session);
    tokenToSessionMap.set(sessionToken, sessionId);
    logger_1.logger.info(`Created session: ${sessionId}, Type: ${session.type}`);
    return session;
}
/**
 * Get a session by ID or token
 */
function getSession(idOrToken) {
    // Check if it's a token and convert to ID
    if (tokenToSessionMap.has(idOrToken)) {
        idOrToken = tokenToSessionMap.get(idOrToken);
    }
    // Get session by ID
    const session = sessions.get(idOrToken);
    if (session) {
        // Update last activity
        session.lastActivity = new Date();
        return session;
    }
    return null;
}
/**
 * Update a session
 */
function updateSession(sessionId, updates) {
    const session = sessions.get(sessionId);
    if (!session) {
        return null;
    }
    // Update session properties
    if (updates.type)
        session.type = updates.type;
    if (updates.userId)
        session.userId = updates.userId;
    if (updates.username)
        session.username = updates.username;
    if (updates.browserId)
        session.browserId = updates.browserId;
    if (updates.ipAddress)
        session.ipAddress = updates.ipAddress;
    if (updates.userAgent)
        session.userAgent = updates.userAgent;
    // Update settings
    if (updates.settings) {
        session.settings = {
            ...session.settings,
            ...updates.settings
        };
    }
    // Update metadata
    if (updates.metadata) {
        session.metadata = {
            ...session.metadata,
            ...updates.metadata
        };
    }
    // Update last activity
    session.lastActivity = new Date();
    return session;
}
/**
 * Delete a session
 */
function deleteSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
        return false;
    }
    // Remove from token map
    tokenToSessionMap.delete(session.token);
    // Remove from sessions map
    sessions.delete(sessionId);
    logger_1.logger.info(`Deleted session: ${sessionId}`);
    return true;
}
/**
 * Get an existing session or create a new one
 */
function getOrCreateSession(idOrToken, options) {
    if (idOrToken) {
        const session = getSession(idOrToken);
        if (session) {
            // Update IP and user agent if they've changed
            if (session.ipAddress !== options.ipAddress || session.userAgent !== options.userAgent) {
                updateSession(session.id, {
                    ipAddress: options.ipAddress,
                    userAgent: options.userAgent
                });
            }
            return session;
        }
    }
    // Create new session
    return createSession(options);
}
/**
 * Validate session token
 */
function validateSession(token) {
    const session = getSession(token);
    if (!session) {
        return null;
    }
    // Check if session has expired
    const now = new Date();
    const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
    if (timeSinceLastActivity > SESSION_TIMEOUT) {
        // Session has expired, delete it
        deleteSession(session.id);
        return null;
    }
    return session;
}
/**
 * Get session settings
 */
function getSessionSettings(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
        return null;
    }
    return { ...session.settings };
}
/**
 * Update session browser ID
 */
function updateSessionBrowserId(sessionId, browserId) {
    const session = sessions.get(sessionId);
    if (!session) {
        return false;
    }
    session.browserId = browserId;
    session.lastActivity = new Date();
    return true;
}
/**
 * Get all active sessions
 */
function getAllSessions() {
    return Array.from(sessions.values());
}
/**
 * Get active session count
 */
function getSessionCount() {
    return sessions.size;
}
/**
 * Clean up inactive sessions
 */
function cleanupInactiveSessions() {
    const now = new Date();
    for (const [sessionId, session] of sessions.entries()) {
        const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
        if (timeSinceLastActivity > SESSION_TIMEOUT) {
            // Session has expired, delete it
            tokenToSessionMap.delete(session.token);
            sessions.delete(sessionId);
            logger_1.logger.info(`Cleaned up inactive session: ${sessionId}`);
        }
    }
}
//# sourceMappingURL=sessionService.js.map