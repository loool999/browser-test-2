"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeStream = initializeStream;
exports.applyQualityPreset = applyQualityPreset;
exports.getStreamStats = getStreamStats;
exports.getAllStreams = getAllStreams;
exports.getActiveStreamCount = getActiveStreamCount;
exports.getTotalBandwidthUsage = getTotalBandwidthUsage;
const browserService_1 = require("./browserService");
const compression_1 = require("../utils/compression");
const logger_1 = require("../utils/logger");
const deviceProfiles_1 = require("../utils/deviceProfiles");
// Stream quality presets
const qualityPresets = {
    low: {
        fps: 15,
        quality: 60,
        keyframeInterval: 15
    },
    medium: {
        fps: 24,
        quality: 75,
        keyframeInterval: 10
    },
    high: {
        fps: 30,
        quality: 85,
        keyframeInterval: 8
    },
    ultra: {
        fps: 60,
        quality: 90,
        keyframeInterval: 5
    }
};
// Stream constants
const DEFAULT_FPS = 30;
const MIN_FPS = 5;
const MAX_FPS = 60;
const KEYFRAME_INTERVAL = 10; // Every 10 frames, send a full frame
const MIN_QUALITY = 20;
const MAX_QUALITY = 95;
const DEFAULT_QUALITY = 80;
const LATENCY_THRESHOLD_HIGH = 200; // ms
const LATENCY_THRESHOLD_MEDIUM = 100; // ms
// Client stream settings map
const clientStreams = new Map();
/**
 * Initialize streaming service for a client
 */
function initializeStream(socket, browserId, initialSettings = {}) {
    // Detect device type from user agent
    const userAgent = socket.handshake.headers['user-agent'] || '';
    const deviceType = (0, deviceProfiles_1.detectDeviceType)(userAgent);
    // Estimate connection quality (default to medium)
    const connectionQuality = initialSettings.connectionQuality || 'medium';
    // Get session ID if available
    const sessionId = socket.session?.id;
    // Calculate optimal settings based on device and connection
    const streamSettings = (0, deviceProfiles_1.calculateStreamSettings)(connectionQuality, deviceType);
    // If user provided specific settings, use those instead of calculated ones
    const fps = initialSettings.fps || streamSettings.fps;
    const quality = initialSettings.quality || streamSettings.quality;
    const adaptiveBitrate = initialSettings.adaptiveBitrate !== undefined ?
        initialSettings.adaptiveBitrate : streamSettings.adaptiveBitrate;
    // Optimize resolution based on device and connection
    const resolution = (0, deviceProfiles_1.getOptimalResolution)(deviceType, connectionQuality, initialSettings.width, initialSettings.height);
    const settings = {
        browserId,
        fps: Math.min(MAX_FPS, Math.max(MIN_FPS, fps)),
        quality: Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, quality)),
        width: resolution.width,
        height: resolution.height,
        active: true,
        adaptiveBitrate,
        lastFrameTime: Date.now(),
        frameCount: 0,
        bytesSent: 0,
        keyframeCount: 0,
        lastFullFrame: null,
        previousFrame: null,
        connectionQuality,
        deviceType: deviceType.toString(),
        sessionId
    };
    clientStreams.set(socket.id, settings);
    logger_1.logger.info(`Stream initialized for client ${socket.id}`, {
        browserId,
        fps: settings.fps,
        quality: settings.quality,
        resolution: `${settings.width}x${settings.height}`,
        deviceType: settings.deviceType,
        connectionQuality
    });
    // Start the streaming loop
    startStreamLoop(socket, settings);
    // Listen for stream setting changes
    setupStreamListeners(socket);
}
/**
 * Setup socket listeners for streaming control
 */
function setupStreamListeners(socket) {
    // Update streaming settings
    socket.on('stream-settings', (settings, callback) => {
        const currentSettings = clientStreams.get(socket.id);
        if (!currentSettings)
            return;
        // Track changes for logging
        const changes = {};
        // Update settings
        if (settings.fps !== undefined) {
            const newFps = Math.max(MIN_FPS, Math.min(MAX_FPS, settings.fps));
            if (newFps !== currentSettings.fps) {
                changes.fps = { from: currentSettings.fps, to: newFps };
                currentSettings.fps = newFps;
            }
        }
        if (settings.quality !== undefined) {
            const newQuality = Math.max(MIN_QUALITY, Math.min(MAX_QUALITY, settings.quality));
            if (newQuality !== currentSettings.quality) {
                changes.quality = { from: currentSettings.quality, to: newQuality };
                currentSettings.quality = newQuality;
            }
        }
        if (settings.width !== undefined || settings.height !== undefined) {
            const newWidth = settings.width || currentSettings.width;
            const newHeight = settings.height || currentSettings.height;
            if (newWidth !== currentSettings.width || newHeight !== currentSettings.height) {
                changes.resolution = {
                    from: `${currentSettings.width}x${currentSettings.height}`,
                    to: `${newWidth}x${newHeight}`
                };
                currentSettings.width = newWidth;
                currentSettings.height = newHeight;
            }
        }
        if (settings.adaptiveBitrate !== undefined) {
            if (settings.adaptiveBitrate !== currentSettings.adaptiveBitrate) {
                changes.adaptiveBitrate = {
                    from: currentSettings.adaptiveBitrate,
                    to: settings.adaptiveBitrate
                };
                currentSettings.adaptiveBitrate = settings.adaptiveBitrate;
            }
        }
        if (settings.connectionQuality !== undefined) {
            if (settings.connectionQuality !== currentSettings.connectionQuality) {
                changes.connectionQuality = {
                    from: currentSettings.connectionQuality,
                    to: settings.connectionQuality
                };
                currentSettings.connectionQuality = settings.connectionQuality;
            }
        }
        // Force a keyframe on settings change
        currentSettings.keyframeCount = 0;
        // Log changes if any were made
        if (Object.keys(changes).length > 0) {
            logger_1.logger.info(`Stream settings updated for client ${socket.id}`, changes);
        }
        // Acknowledge settings update
        const updatedSettings = {
            fps: currentSettings.fps,
            quality: currentSettings.quality,
            width: currentSettings.width,
            height: currentSettings.height,
            adaptiveBitrate: currentSettings.adaptiveBitrate,
            connectionQuality: currentSettings.connectionQuality
        };
        socket.emit('stream-settings-updated', updatedSettings);
        if (callback) {
            callback({ success: true, settings: updatedSettings });
        }
    });
    // Pause/resume streaming
    socket.on('stream-control', ({ streaming }, callback) => {
        const settings = clientStreams.get(socket.id);
        if (!settings) {
            if (callback)
                callback({ success: false, error: 'No stream found' });
            return;
        }
        const wasActive = settings.active;
        settings.active = !!streaming;
        // If resuming, restart the loop if needed
        if (settings.active && !wasActive) {
            const now = Date.now();
            // If it's been a while, restart the stream loop
            if (now - settings.lastFrameTime > 1000) {
                startStreamLoop(socket, settings);
            }
        }
        logger_1.logger.info(`Stream ${settings.active ? 'resumed' : 'paused'} for client ${socket.id}`);
        if (callback) {
            callback({ success: true, streaming: settings.active });
        }
    });
    // Track latency information
    socket.on('latency-report', (data) => {
        const settings = clientStreams.get(socket.id);
        if (!settings)
            return;
        // Update latency information
        settings.latency = data.latency;
        // Adjust quality based on latency if adaptive bitrate is enabled
        if (settings.adaptiveBitrate && settings.latency) {
            adjustQualityBasedOnLatency(settings);
        }
    });
    // Clean up on disconnect
    socket.on('disconnect', () => {
        clientStreams.delete(socket.id);
        logger_1.logger.info(`Stream ended for client ${socket.id} (disconnected)`);
    });
}
/**
 * Adjust quality settings based on latency
 */
function adjustQualityBasedOnLatency(settings) {
    if (!settings.latency)
        return;
    // High latency - reduce quality and FPS
    if (settings.latency > LATENCY_THRESHOLD_HIGH) {
        if (settings.quality > MIN_QUALITY + 10) {
            settings.quality = Math.max(MIN_QUALITY, settings.quality - 5);
        }
        if (settings.fps > MIN_FPS + 5) {
            settings.fps = Math.max(MIN_FPS, settings.fps - 2);
        }
    }
    // Medium latency - slightly reduce quality
    else if (settings.latency > LATENCY_THRESHOLD_MEDIUM) {
        if (settings.quality > MIN_QUALITY + 5) {
            settings.quality = Math.max(MIN_QUALITY, settings.quality - 2);
        }
    }
    // Low latency - can increase quality if it was previously reduced
    else {
        if (settings.quality < DEFAULT_QUALITY) {
            settings.quality = Math.min(MAX_QUALITY, settings.quality + 1);
        }
        // If fps was reduced, gradually increase it back
        if (settings.fps < DEFAULT_FPS) {
            settings.fps = Math.min(DEFAULT_FPS, settings.fps + 1);
        }
    }
}
/**
 * Start streaming loop for a client
 */
function startStreamLoop(socket, settings) {
    let isStreaming = true;
    let targetInterval = 1000 / settings.fps;
    // Function to get the next frame
    const getNextFrame = async () => {
        if (!isStreaming || !settings.active)
            return;
        try {
            const now = Date.now();
            const elapsed = now - settings.lastFrameTime;
            // Update the target interval based on the actual FPS
            if (settings.adaptiveBitrate && elapsed > 0) {
                const currentFps = 1000 / elapsed;
                // If we're below 90% of target FPS, reduce quality
                if (currentFps < settings.fps * 0.9 && settings.quality > 20) {
                    settings.quality = Math.max(20, settings.quality - 5);
                }
                // If we're above target FPS with room to spare, increase quality
                else if (currentFps > settings.fps * 1.1 && settings.quality < 95) {
                    settings.quality = Math.min(95, settings.quality + 2);
                }
            }
            // Determine if we should send a keyframe (full frame)
            const isKeyframe = settings.keyframeCount % KEYFRAME_INTERVAL === 0;
            settings.keyframeCount++;
            // Get screenshot from browser
            const screenshot = await (0, browserService_1.getScreenshot)(settings.browserId, {
                quality: settings.quality,
                isKeyframe
            });
            if (screenshot) {
                // Track frame stats
                settings.frameCount++;
                settings.lastFrameTime = now;
                // For keyframes, compress and send the full frame
                if (isKeyframe) {
                    const compressedFrame = (0, compression_1.compressBase64)(screenshot);
                    settings.lastFullFrame = screenshot;
                    settings.bytesSent += compressedFrame.length;
                    socket.volatile.emit('frame', {
                        image: compressedFrame,
                        isKeyframe: true,
                        quality: settings.quality,
                        timestamp: now
                    });
                }
                // For delta frames, send compressed frame
                else {
                    const compressedFrame = (0, compression_1.compressBase64)(screenshot);
                    settings.bytesSent += compressedFrame.length;
                    socket.volatile.emit('frame', {
                        image: compressedFrame,
                        isKeyframe: false,
                        quality: settings.quality,
                        timestamp: now
                    });
                }
                // Store the previous frame
                settings.previousFrame = screenshot;
            }
            // Calculate time to next frame
            const processingTime = Date.now() - now;
            targetInterval = 1000 / settings.fps;
            const nextFrameTime = Math.max(1, targetInterval - processingTime);
            // Schedule next frame
            setTimeout(getNextFrame, nextFrameTime);
        }
        catch (error) {
            logger_1.logger.error(`Streaming error for client ${socket.id}:`, error);
            isStreaming = false;
        }
    };
    // Start the frame loop
    getNextFrame();
    // Attach cleanup to socket
    socket.on('disconnect', () => {
        isStreaming = false;
    });
}
/**
 * Apply a quality preset to a stream
 */
function applyQualityPreset(socketId, preset) {
    const settings = clientStreams.get(socketId);
    if (!settings)
        return false;
    const presetConfig = qualityPresets[preset];
    if (!presetConfig)
        return false;
    settings.fps = presetConfig.fps;
    settings.quality = presetConfig.quality;
    settings.keyframeCount = 0; // Force next frame to be a keyframe
    return true;
}
/**
 * Get stream statistics for a client
 */
function getStreamStats(socketId) {
    const settings = clientStreams.get(socketId);
    if (!settings)
        return null;
    const now = Date.now();
    const runtimeMs = now - settings.lastFrameTime + 1; // Add 1 to avoid division by zero
    return {
        browserId: settings.browserId,
        fps: settings.fps,
        quality: settings.quality,
        resolution: `${settings.width}x${settings.height}`,
        active: settings.active,
        adaptiveBitrate: settings.adaptiveBitrate,
        frameCount: settings.frameCount,
        bytesSent: settings.bytesSent,
        avgBitrateBps: Math.round(settings.bytesSent * 8 / (runtimeMs / 1000)),
        avgFps: settings.frameCount / (runtimeMs / 1000),
        latency: settings.latency || 0,
        connectionQuality: settings.connectionQuality,
        deviceType: settings.deviceType
    };
}
/**
 * Get all active streams
 */
function getAllStreams() {
    const streams = [];
    for (const [socketId, settings] of clientStreams.entries()) {
        const stats = getStreamStats(socketId);
        if (stats) {
            streams.push({ socketId, stats });
        }
    }
    return streams;
}
/**
 * Get total active stream count
 */
function getActiveStreamCount() {
    let activeCount = 0;
    for (const settings of clientStreams.values()) {
        if (settings.active) {
            activeCount++;
        }
    }
    return activeCount;
}
/**
 * Get total bandwidth usage in bytes per second
 */
function getTotalBandwidthUsage() {
    let totalBytesSent = 0;
    let totalDuration = 0;
    for (const settings of clientStreams.values()) {
        if (settings.active) {
            totalBytesSent += settings.bytesSent;
            const duration = Date.now() - settings.lastFrameTime + 1;
            totalDuration += duration;
        }
    }
    // Average bytes per second across all streams
    return totalDuration > 0 ? (totalBytesSent / (totalDuration / 1000)) : 0;
}
//# sourceMappingURL=streamingService.js.map