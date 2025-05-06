"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAnalyticsService = initAnalyticsService;
exports.recordMetric = recordMetric;
exports.recordEvent = recordEvent;
exports.recordStreamingStats = recordStreamingStats;
exports.startBrowserSession = startBrowserSession;
exports.recordBrowserAction = recordBrowserAction;
exports.endBrowserSession = endBrowserSession;
exports.getMetrics = getMetrics;
exports.getEvents = getEvents;
exports.getStreamingStats = getStreamingStats;
exports.getBrowserSessions = getBrowserSessions;
exports.getAggregatedMetrics = getAggregatedMetrics;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
// Analytics data storage
const metrics = [];
const events = [];
const streamingStats = [];
const browserSessions = {};
// Metric aggregation
const aggregatedMetrics = {};
// Storage paths
const STORAGE_DIR = path_1.default.join(process.cwd(), 'analytics');
const METRICS_FILE = path_1.default.join(STORAGE_DIR, 'metrics.json');
const EVENTS_FILE = path_1.default.join(STORAGE_DIR, 'events.json');
const STREAMING_STATS_FILE = path_1.default.join(STORAGE_DIR, 'streaming-stats.json');
const BROWSER_SESSIONS_FILE = path_1.default.join(STORAGE_DIR, 'browser-sessions.json');
// Maximum records to keep in memory
const MAX_METRICS = 1000;
const MAX_EVENTS = 1000;
const MAX_STREAMING_STATS = 500;
/**
 * Initialize analytics service
 */
function initAnalyticsService() {
    logger_1.logger.info('Initializing analytics service');
    // Create storage directory if it doesn't exist
    if (!fs_1.default.existsSync(STORAGE_DIR)) {
        fs_1.default.mkdirSync(STORAGE_DIR, { recursive: true });
        logger_1.logger.info(`Created analytics storage directory: ${STORAGE_DIR}`);
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
function recordMetric(name, value, type = 'gauge', labels) {
    const metric = {
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
function recordEvent(name, data = {}) {
    const event = {
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
function recordStreamingStats(stats) {
    const statsWithTimestamp = {
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
function startBrowserSession(browserId, sessionId, data = {}) {
    const session = {
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
function recordBrowserAction(browserId, actionType, actionData) {
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
function endBrowserSession(browserId) {
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
function getMetrics(options = {}) {
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
            if (!m.labels)
                return false;
            return Object.entries(labels).every(([key, value]) => m.labels?.[key] === value);
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
function getEvents(options = {}) {
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
function getStreamingStats(options = {}) {
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
function getBrowserSessions(options = {}) {
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
        }
        else {
            sessions = sessions.filter(s => !!s.endTime);
        }
    }
    return sessions;
}
/**
 * Get aggregated metrics
 */
function getAggregatedMetrics(options = {}) {
    const { name, labels } = options;
    const result = {};
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
        if (fs_1.default.existsSync(METRICS_FILE)) {
            const metricsData = JSON.parse(fs_1.default.readFileSync(METRICS_FILE, 'utf8'));
            metrics.push(...metricsData);
            logger_1.logger.info(`Loaded ${metricsData.length} metrics from storage`);
        }
        // Load events
        if (fs_1.default.existsSync(EVENTS_FILE)) {
            const eventsData = JSON.parse(fs_1.default.readFileSync(EVENTS_FILE, 'utf8'));
            events.push(...eventsData);
            logger_1.logger.info(`Loaded ${eventsData.length} events from storage`);
        }
        // Load streaming stats
        if (fs_1.default.existsSync(STREAMING_STATS_FILE)) {
            const statsData = JSON.parse(fs_1.default.readFileSync(STREAMING_STATS_FILE, 'utf8'));
            streamingStats.push(...statsData);
            logger_1.logger.info(`Loaded ${statsData.length} streaming stats from storage`);
        }
        // Load browser sessions
        if (fs_1.default.existsSync(BROWSER_SESSIONS_FILE)) {
            const sessionsData = JSON.parse(fs_1.default.readFileSync(BROWSER_SESSIONS_FILE, 'utf8'));
            Object.assign(browserSessions, sessionsData);
            logger_1.logger.info(`Loaded ${Object.keys(sessionsData).length} browser sessions from storage`);
        }
    }
    catch (error) {
        logger_1.logger.error('Error loading analytics data:', error);
    }
}
/**
 * Save data to storage
 */
function saveData() {
    try {
        // Create directory if it doesn't exist
        if (!fs_1.default.existsSync(STORAGE_DIR)) {
            fs_1.default.mkdirSync(STORAGE_DIR, { recursive: true });
        }
        // Save metrics
        fs_1.default.writeFileSync(METRICS_FILE, JSON.stringify(metrics), 'utf8');
        // Save events
        fs_1.default.writeFileSync(EVENTS_FILE, JSON.stringify(events), 'utf8');
        // Save streaming stats
        fs_1.default.writeFileSync(STREAMING_STATS_FILE, JSON.stringify(streamingStats), 'utf8');
        // Save browser sessions
        fs_1.default.writeFileSync(BROWSER_SESSIONS_FILE, JSON.stringify(browserSessions), 'utf8');
        logger_1.logger.info('Analytics data saved to storage');
    }
    catch (error) {
        logger_1.logger.error('Error saving analytics data:', error);
    }
}
// Clean up on process exit
process.on('exit', () => {
    saveData();
});
//# sourceMappingURL=analyticsService.js.map