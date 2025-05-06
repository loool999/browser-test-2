import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// Session types
export enum SessionType {
  ANONYMOUS = 'anonymous',
  AUTHENTICATED = 'authenticated',
  ADMIN = 'admin'
}

// Session data structure
export interface Session {
  id: string;
  token: string;
  type: SessionType;
  userId?: string;
  username?: string;
  browserId?: string;
  createdAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  settings: {
    fps: number;
    quality: number;
    adaptiveBitrate: boolean;
    resolution: { width: number; height: number };
    [key: string]: any;
  };
  metadata: {
    [key: string]: any;
  };
}

// Session store
const sessions = new Map<string, Session>();
const tokenToSessionMap = new Map<string, string>();

// Session timeout (in milliseconds)
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
const SESSION_CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes

/**
 * Initialize session service and set up cleanup
 */
export function initSessionService() {
  logger.info('Initializing session service');
  
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
export function createSession(options: {
  type?: SessionType;
  userId?: string;
  username?: string;
  ipAddress: string;
  userAgent: string;
  settings?: Partial<Session['settings']>;
  metadata?: Record<string, any>;
}): Session {
  const sessionId = uuidv4();
  const sessionToken = uuidv4();
  
  const session: Session = {
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
  
  logger.info(`Created session: ${sessionId}, Type: ${session.type}`);
  
  return session;
}

/**
 * Get a session by ID or token
 */
export function getSession(idOrToken: string): Session | null {
  // Check if it's a token and convert to ID
  if (tokenToSessionMap.has(idOrToken)) {
    idOrToken = tokenToSessionMap.get(idOrToken) as string;
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
export function updateSession(
  sessionId: string, 
  updates: Partial<Omit<Session, 'id' | 'token' | 'createdAt'>>
): Session | null {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return null;
  }
  
  // Update session properties
  if (updates.type) session.type = updates.type;
  if (updates.userId) session.userId = updates.userId;
  if (updates.username) session.username = updates.username;
  if (updates.browserId) session.browserId = updates.browserId;
  if (updates.ipAddress) session.ipAddress = updates.ipAddress;
  if (updates.userAgent) session.userAgent = updates.userAgent;
  
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
export function deleteSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return false;
  }
  
  // Remove from token map
  tokenToSessionMap.delete(session.token);
  
  // Remove from sessions map
  sessions.delete(sessionId);
  
  logger.info(`Deleted session: ${sessionId}`);
  
  return true;
}

/**
 * Get an existing session or create a new one
 */
export function getOrCreateSession(
  idOrToken: string | null,
  options: Parameters<typeof createSession>[0]
): Session {
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
export function validateSession(token: string): Session | null {
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
export function getSessionSettings(sessionId: string): Session['settings'] | null {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return null;
  }
  
  return { ...session.settings };
}

/**
 * Update session browser ID
 */
export function updateSessionBrowserId(sessionId: string, browserId: string): boolean {
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
export function getAllSessions(): Session[] {
  return Array.from(sessions.values());
}

/**
 * Get active session count
 */
export function getSessionCount(): number {
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
      
      logger.info(`Cleaned up inactive session: ${sessionId}`);
    }
  }
}