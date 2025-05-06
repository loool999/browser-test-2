"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
const browserService_1 = require("./browserService");
const streamingService_1 = require("./streamingService");
const logger_1 = require("../utils/logger");
// Map to track socket-to-browser associations
const socketBrowserMap = new Map();
function setupSocketHandlers(io) {
    // Setup ping handler for all clients
    io.use((socket, next) => {
        socket.on('ping', (startTime) => {
            socket.emit('pong', startTime);
        });
        next();
    });
    io.on('connection', (socket) => {
        logger_1.logger.info(`Client connected: ${socket.id}`);
        // Initialize browser when client connects
        socket.on('init', async (data, callback) => {
            try {
                // Check if this socket already has a browser
                let browserId = socketBrowserMap.get(socket.id);
                if (!browserId) {
                    // Create new browser instance
                    browserId = await (0, browserService_1.createBrowser)(data.url, data.width || 1920, data.height || 1080);
                    socketBrowserMap.set(socket.id, browserId);
                }
                callback({ success: true, browserId });
                // Start streaming frames
                (0, streamingService_1.initializeStream)(socket, browserId, {
                    fps: data.fps,
                    quality: data.quality,
                    width: data.width,
                    height: data.height,
                    adaptiveBitrate: data.adaptiveBitrate
                });
            }
            catch (error) {
                logger_1.logger.error('Error during initialization:', error);
                callback({ success: false, error: error.message });
            }
        });
        // Handle navigation requests
        socket.on('navigate', async (data, callback) => {
            try {
                const browserId = socketBrowserMap.get(socket.id);
                if (!browserId) {
                    callback({ success: false, error: 'No browser instance found' });
                    return;
                }
                const success = await (0, browserService_1.navigateTo)(browserId, data.url);
                const currentUrl = await (0, browserService_1.getCurrentUrl)(browserId);
                callback({ success, currentUrl });
            }
            catch (error) {
                logger_1.logger.error('Error during navigation:', error);
                callback({ success: false, error: error.message });
            }
        });
        // Handle user interactions
        socket.on('action', async (data, callback) => {
            try {
                const browserId = socketBrowserMap.get(socket.id);
                if (!browserId) {
                    if (callback)
                        callback({ success: false, error: 'No browser instance found' });
                    return;
                }
                // Special case for getting current URL
                if (data.action === 'getCurrentUrl') {
                    const url = await (0, browserService_1.getCurrentUrl)(browserId);
                    if (callback)
                        callback({ success: true, url });
                    return;
                }
                const success = await (0, browserService_1.executeAction)(browserId, data.action, data.params);
                if (callback)
                    callback({ success });
            }
            catch (error) {
                logger_1.logger.error('Error executing action:', error);
                if (callback)
                    callback({ success: false, error: error.message });
            }
        });
        // Handle viewport resize
        socket.on('resize', async (data, callback) => {
            try {
                const browserId = socketBrowserMap.get(socket.id);
                if (!browserId) {
                    callback({ success: false, error: 'No browser instance found' });
                    return;
                }
                const success = await (0, browserService_1.resizeViewport)(browserId, data.width, data.height);
                callback({ success });
            }
            catch (error) {
                logger_1.logger.error('Error resizing viewport:', error);
                callback({ success: false, error: error.message });
            }
        });
        // Handle status requests
        socket.on('status', (callback) => {
            try {
                const browserId = socketBrowserMap.get(socket.id);
                const activeBrowsers = (0, browserService_1.getActiveBrowserCount)();
                const allBrowserIds = (0, browserService_1.getActiveBrowserIds)();
                const streamStats = (0, streamingService_1.getStreamStats)(socket.id);
                callback({
                    connected: !!browserId,
                    browserId: browserId || null,
                    activeBrowsers,
                    allBrowserIds,
                    stream: streamStats
                });
            }
            catch (error) {
                logger_1.logger.error('Error getting status:', error);
                callback({
                    connected: false,
                    error: error.message
                });
            }
        });
        // Handle stream settings updates
        socket.on('stream-settings', (settings, callback) => {
            try {
                const browserId = socketBrowserMap.get(socket.id);
                if (!browserId) {
                    if (callback)
                        callback({ success: false, error: 'No browser instance found' });
                    return;
                }
                // Updates are handled by the streaming service
                socket.emit('stream-settings-updated', settings);
                if (callback)
                    callback({ success: true });
            }
            catch (error) {
                logger_1.logger.error('Error updating stream settings:', error);
                if (callback)
                    callback({ success: false, error: error.message });
            }
        });
        // Handle disconnect
        socket.on('disconnect', async () => {
            logger_1.logger.info(`Client disconnected: ${socket.id}`);
            const browserId = socketBrowserMap.get(socket.id);
            if (browserId) {
                try {
                    await (0, browserService_1.closeBrowser)(browserId);
                }
                catch (error) {
                    logger_1.logger.error(`Error closing browser on disconnect: ${error}`);
                }
                socketBrowserMap.delete(socket.id);
            }
        });
    });
}
//# sourceMappingURL=socketService.js.map