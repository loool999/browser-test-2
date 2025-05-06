import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// Define metric types
type MetricType = 'counter' | 'gauge' | 'histogram';

// Metric interface
interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

// Define event interface
interface Event {
  name: string;
  data: Record<string, any>;
  timestamp: number;
}

// Performance data for streaming
interface StreamingStats {
  sessionId: string;
  browserId: string;
  fps: number;
  quality: number;
  resolution: string;
  avgBitrateBps: number;
  frameCount: number;
  latencyMs: number;
  timestamp: number;
}

// Browser session data
interface BrowserSession {
  browserId: string;
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  url?: string;
  userAgent?: string;
  ipAddress?: string;
  actions: Array<{
    type: string;
    timestamp: number;
    data?: any;
  }>;
}

// Analytics data storage
const metrics: Metric[] = [];
const events: Event[] = [];
const streamingStats: StreamingStats[] = [];
const browserSessions: Record<string, BrowserSession> = {};

// Metric aggregation
const aggregatedMetrics: Record<string, {
  count: number;
  sum: number;
  min: number;
  max: number;
  values: number[];
}> = {};

// Storage paths
const STORAGE_DIR = path.join(process.cwd(), 'analytics');
const METRICS_FILE = path.join(STORAGE_DIR, 'metrics.json');
const EVENTS_FILE = path.join(STORAGE_DIR, 'events.json');
const STREAMING_STATS_FILE = path.join(STORAGE_DIR, 'streaming-stats.json');
const BROWSER_SESSIONS_FILE = path.join(STORAGE_DIR, 'browser-sessions.json');

// Maximum records to keep in memory
const MAX_METRICS = 1000;
const MAX_EVENTS = 1000;
const MAX_STREAMING_STATS = 500;

/**
 * Initialize analytics service
 */
export function initAnalyticsService() {
  logger.info('Initializing analytics service');
  
  // Create storage directory if it doesn't exist
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    logger.info(`Created analytics storage directory: ${STORAGE_DIR}`);
  }
  
  // Load existing data
  loadData();
  
  // Schedule regular data saving
  setInterval(saveData, 5 * 60 * 1000); // Save every 5 minutes
  
  return {
    recordMetric,
    recordEvent,
    recordStreamingStats,
    startBrowserSession,
    recordBrowserAction,
    endBrowserSession,
    getMetrics,
    getEvents,
    getStreamingStats,
    getBrowserSessions,
    getAggregatedMetrics
  };
}

/**
 * Record a metric
 */
export function recordMetric(
  name: string, 
  value: number, 
  type: MetricType = 'gauge', 
  labels?: Record<string, string>
) {
  const metric: Metric = {
    name,
    type,
    value,
    labels,
    timestamp: Date.now()
  };
  
  metrics.unshift(metric);
  
  // Trim if exceeds max size
  if (metrics.length > MAX_METRICS) {
    metrics.pop();
  }
  
  // Update aggregated metrics
  const key = name + (labels ? Object.entries(labels).map(([k, v]) => `_${k}_${v}`).join('') : '');
  
  if (!aggregatedMetrics[key]) {
    aggregatedMetrics[key] = {
      count: 0,
      sum: 0,
      min: value,
      max: value,
      values: []
    };
  }
  
  const agg = aggregatedMetrics[key];
  agg.count++;
  agg.sum += value;
  agg.min = Math.min(agg.min, value);
  agg.max = Math.max(agg.max, value);
  
  // Keep last 100 values for histograms
  if (type === 'histogram') {
    agg.values.unshift(value);
    if (agg.values.length > 100) {
      agg.values.pop();
    }
  }
}

/**
 * Record an event
 */
export function recordEvent(name: string, data: Record<string, any> = {}) {
  const event: Event = {
    name,
    data,
    timestamp: Date.now()
  };
  
  events.unshift(event);
  
  // Trim if exceeds max size
  if (events.length > MAX_EVENTS) {
    events.pop();
  }
}

/**
 * Record streaming statistics
 */
export function recordStreamingStats(stats: Omit<StreamingStats, 'timestamp'>) {
  const statsWithTimestamp: StreamingStats = {
    ...stats,
    timestamp: Date.now()
  };
  
  streamingStats.unshift(statsWithTimestamp);
  
  // Trim if exceeds max size
  if (streamingStats.length > MAX_STREAMING_STATS) {
    streamingStats.pop();
  }
  
  // Record metrics for streaming stats
  recordMetric('stream.fps', stats.fps, 'gauge', { sessionId: stats.sessionId });
  recordMetric('stream.quality', stats.quality, 'gauge', { sessionId: stats.sessionId });
  recordMetric('stream.bitrate', stats.avgBitrateBps, 'gauge', { sessionId: stats.sessionId });
  recordMetric('stream.latency', stats.latencyMs, 'gauge', { sessionId: stats.sessionId });
}

/**
 * Start tracking a browser session
 */
export function startBrowserSession(
  browserId: string, 
  sessionId: string, 
  data: { 
    url?: string; 
    userAgent?: string; 
    ipAddress?: string;
  } = {}
): BrowserSession {
  const session: BrowserSession = {
    browserId,
    sessionId,
    startTime: Date.now(),
    url: data.url,
    userAgent: data.userAgent,
    ipAddress: data.ipAddress,
    actions: []
  };
  
  browserSessions[browserId] = session;
  recordEvent('browser.session.start', { browserId, sessionId });
  
  return session;
}

/**
 * Record a browser action
 */
export function recordBrowserAction(
  browserId: string, 
  actionType: string, 
  actionData?: any
): boolean {
  const session = browserSessions[browserId];
  if (!session) {
    return false;
  }
  
  session.actions.push({
    type: actionType,
    timestamp: Date.now(),
    data: actionData
  });
  
  return true;
}

/**
 * End a browser session
 */
export function endBrowserSession(browserId: string): BrowserSession | null {
  const session = browserSessions[browserId];
  if (!session) {
    return null;
  }
  
  session.endTime = Date.now();
  session.duration = session.endTime - session.startTime;
  
  recordEvent('browser.session.end', { 
    browserId, 
    sessionId: session.sessionId, 
    duration: session.duration 
  });
  
  // Record metrics
  recordMetric('browser.session.duration', session.duration, 'histogram', {
    browserId,
    sessionId: session.sessionId
  });
  
  recordMetric('browser.session.actions', session.actions.length, 'counter', {
    browserId,
    sessionId: session.sessionId
  });
  
  return session;
}

/**
 * Get metrics for a time range
 */
export function getMetrics(
  options: {
    name?: string;
    type?: MetricType;
    labels?: Record<string, string>;
    from?: number;
    to?: number;
    limit?: number;
  } = {}
): Metric[] {
  const { name, type, labels, from, to, limit } = options;
  
  let filtered = metrics;
  
  if (name) {
    filtered = filtered.filter(m => m.name === name);
  }
  
  if (type) {
    filtered = filtered.filter(m => m.type === type);
  }
  
  if (labels) {
    filtered = filtered.filter(m => {
      if (!m.labels) return false;
      
      return Object.entries(labels).every(([key, value]) => 
        m.labels?.[key] === value
      );
    });
  }
  
  if (from) {
    filtered = filtered.filter(m => m.timestamp >= from);
  }
  
  if (to) {
    filtered = filtered.filter(m => m.timestamp <= to);
  }
  
  if (limit) {
    filtered = filtered.slice(0, limit);
  }
  
  return filtered;
}

/**
 * Get events for a time range
 */
export function getEvents(
  options: {
    name?: string;
    from?: number;
    to?: number;
    limit?: number;
  } = {}
): Event[] {
  const { name, from, to, limit } = options;
  
  let filtered = events;
  
  if (name) {
    filtered = filtered.filter(e => e.name === name);
  }
  
  if (from) {
    filtered = filtered.filter(e => e.timestamp >= from);
  }
  
  if (to) {
    filtered = filtered.filter(e => e.timestamp <= to);
  }
  
  if (limit) {
    filtered = filtered.slice(0, limit);
  }
  
  return filtered;
}

/**
 * Get streaming stats for a time range
 */
export function getStreamingStats(
  options: {
    sessionId?: string;
    browserId?: string;
    from?: number;
    to?: number;
    limit?: number;
  } = {}
): StreamingStats[] {
  const { sessionId, browserId, from, to, limit } = options;
  
  let filtered = streamingStats;
  
  if (sessionId) {
    filtered = filtered.filter(s => s.sessionId === sessionId);
  }
  
  if (browserId) {
    filtered = filtered.filter(s => s.browserId === browserId);
  }
  
  if (from) {
    filtered = filtered.filter(s => s.timestamp >= from);
  }
  
  if (to) {
    filtered = filtered.filter(s => s.timestamp <= to);
  }
  
  if (limit) {
    filtered = filtered.slice(0, limit);
  }
  
  return filtered;
}

/**
 * Get browser sessions
 */
export function getBrowserSessions(
  options: {
    sessionId?: string;
    browserId?: string;
    from?: number;
    to?: number;
    active?: boolean;
  } = {}
): BrowserSession[] {
  const { sessionId, browserId, from, to, active } = options;
  
  let sessions = Object.values(browserSessions);
  
  if (sessionId) {
    sessions = sessions.filter(s => s.sessionId === sessionId);
  }
  
  if (browserId) {
    sessions = sessions.filter(s => s.browserId === browserId);
  }
  
  if (from) {
    sessions = sessions.filter(s => s.startTime >= from);
  }
  
  if (to) {
    sessions = sessions.filter(s => s.startTime <= to);
  }
  
  if (active !== undefined) {
    if (active) {
      sessions = sessions.filter(s => !s.endTime);
    } else {
      sessions = sessions.filter(s => !!s.endTime);
    }
  }
  
  return sessions;
}

/**
 * Get aggregated metrics
 */
export function getAggregatedMetrics(
  options: {
    name?: string;
    labels?: Record<string, string>;
  } = {}
): Record<string, {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  values?: number[];
}> {
  const { name, labels } = options;
  
  const result: Record<string, any> = {};
  
  for (const [key, agg] of Object.entries(aggregatedMetrics)) {
    // Skip if name filter is set and doesn't match
    if (name && !key.startsWith(name)) {
      continue;
    }
    
    // Skip if labels filter is set and doesn't match
    if (labels) {
      let labelMatch = true;
      
      for (const [labelKey, labelValue] of Object.entries(labels)) {
        if (!key.includes(`_${labelKey}_${labelValue}`)) {
          labelMatch = false;
          break;
        }
      }
      
      if (!labelMatch) {
        continue;
      }
    }
    
    result[key] = {
      count: agg.count,
      sum: agg.sum,
      min: agg.min,
      max: agg.max,
      avg: agg.sum / agg.count
    };
    
    // Include values for histograms
    if (agg.values.length > 0) {
      result[key].values = [...agg.values];
    }
  }
  
  return result;
}

/**
 * Load data from storage
 */
function loadData() {
  try {
    // Load metrics
    if (fs.existsSync(METRICS_FILE)) {
      const metricsData = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
      metrics.push(...metricsData);
      logger.info(`Loaded ${metricsData.length} metrics from storage`);
    }
    
    // Load events
    if (fs.existsSync(EVENTS_FILE)) {
      const eventsData = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
      events.push(...eventsData);
      logger.info(`Loaded ${eventsData.length} events from storage`);
    }
    
    // Load streaming stats
    if (fs.existsSync(STREAMING_STATS_FILE)) {
      const statsData = JSON.parse(fs.readFileSync(STREAMING_STATS_FILE, 'utf8'));
      streamingStats.push(...statsData);
      logger.info(`Loaded ${statsData.length} streaming stats from storage`);
    }
    
    // Load browser sessions
    if (fs.existsSync(BROWSER_SESSIONS_FILE)) {
      const sessionsData = JSON.parse(fs.readFileSync(BROWSER_SESSIONS_FILE, 'utf8'));
      Object.assign(browserSessions, sessionsData);
      logger.info(`Loaded ${Object.keys(sessionsData).length} browser sessions from storage`);
    }
  } catch (error) {
    logger.error('Error loading analytics data:', error);
  }
}

/**
 * Save data to storage
 */
function saveData() {
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    
    // Save metrics
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics), 'utf8');
    
    // Save events
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events), 'utf8');
    
    // Save streaming stats
    fs.writeFileSync(STREAMING_STATS_FILE, JSON.stringify(streamingStats), 'utf8');
    
    // Save browser sessions
    fs.writeFileSync(BROWSER_SESSIONS_FILE, JSON.stringify(browserSessions), 'utf8');
    
    logger.info('Analytics data saved to storage');
  } catch (error) {
    logger.error('Error saving analytics data:', error);
  }
}

// Clean up on process exit
process.on('exit', () => {
  saveData();
});