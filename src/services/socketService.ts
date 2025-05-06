import { Server, Socket } from 'socket.io';
import {
  createBrowser,
  closeBrowser,
  navigateTo,
  executeAction,
  getActiveBrowserCount,
  getActiveBrowserIds,
  getCurrentUrl,
  resizeViewport
} from './browserService';
import { initializeStream, getStreamStats } from './streamingService';
import { logger } from '../utils/logger';

// Map to track socket-to-browser associations
const socketBrowserMap = new Map<string, string>();

export function setupSocketHandlers(io: Server) {
  // Setup ping handler for all clients
  io.use((socket, next) => {
    socket.on('ping', (startTime) => {
      socket.emit('pong', startTime);
    });
    next();
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Client connected: ${socket.id}`);
    
    // Initialize browser when client connects
    socket.on('init', async (data: { 
      url?: string, 
      width?: number, 
      height?: number,
      fps?: number,
      quality?: number,
      adaptiveBitrate?: boolean
    }, callback) => {
      try {
        // Check if this socket already has a browser
        let browserId = socketBrowserMap.get(socket.id);
        
        if (!browserId) {
          // Create new browser instance
          browserId = await createBrowser(
            data.url,
            data.width || 1920,
            data.height || 1080
          );
          socketBrowserMap.set(socket.id, browserId);
        }
        
        callback({ success: true, browserId });
        
        // Start streaming frames
        initializeStream(socket, browserId, {
          fps: data.fps,
          quality: data.quality,
          width: data.width,
          height: data.height,
          adaptiveBitrate: data.adaptiveBitrate
        });
      } catch (error) {
        logger.error('Error during initialization:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
    
    // Handle navigation requests
    socket.on('navigate', async (data: { url: string }, callback) => {
      try {
        const browserId = socketBrowserMap.get(socket.id);
        if (!browserId) {
          callback({ success: false, error: 'No browser instance found' });
          return;
        }
        
        const success = await navigateTo(browserId, data.url);
        const currentUrl = await getCurrentUrl(browserId);
        
        callback({ success, currentUrl });
      } catch (error) {
        logger.error('Error during navigation:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
    
    // Handle user interactions
    socket.on('action', async (data: { action: string, params: any }, callback) => {
      try {
        const browserId = socketBrowserMap.get(socket.id);
        if (!browserId) {
          if (callback) callback({ success: false, error: 'No browser instance found' });
          return;
        }
        
        // Special case for getting current URL
        if (data.action === 'getCurrentUrl') {
          const url = await getCurrentUrl(browserId);
          if (callback) callback({ success: true, url });
          return;
        }
        
        const success = await executeAction(browserId, data.action, data.params);
        if (callback) callback({ success });
      } catch (error) {
        logger.error('Error executing action:', error);
        if (callback) callback({ success: false, error: (error as Error).message });
      }
    });

    // Handle viewport resize
    socket.on('resize', async (data: { width: number, height: number }, callback) => {
      try {
        const browserId = socketBrowserMap.get(socket.id);
        if (!browserId) {
          callback({ success: false, error: 'No browser instance found' });
          return;
        }
        
        const success = await resizeViewport(browserId, data.width, data.height);
        callback({ success });
      } catch (error) {
        logger.error('Error resizing viewport:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });

    // Handle status requests
    socket.on('status', (callback) => {
      try {
        const browserId = socketBrowserMap.get(socket.id);
        const activeBrowsers = getActiveBrowserCount();
        const allBrowserIds = getActiveBrowserIds();
        const streamStats = getStreamStats(socket.id);
        
        callback({
          connected: !!browserId,
          browserId: browserId || null,
          activeBrowsers,
          allBrowserIds,
          stream: streamStats
        });
      } catch (error) {
        logger.error('Error getting status:', error);
        callback({
          connected: false,
          error: (error as Error).message
        });
      }
    });
    
    // Handle stream settings updates
    socket.on('stream-settings', (settings, callback) => {
      try {
        const browserId = socketBrowserMap.get(socket.id);
        if (!browserId) {
          if (callback) callback({ success: false, error: 'No browser instance found' });
          return;
        }
        
        // Updates are handled by the streaming service
        socket.emit('stream-settings-updated', settings);
        
        if (callback) callback({ success: true });
      } catch (error) {
        logger.error('Error updating stream settings:', error);
        if (callback) callback({ success: false, error: (error as Error).message });
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', async () => {
      logger.info(`Client disconnected: ${socket.id}`);
      
      const browserId = socketBrowserMap.get(socket.id);
      if (browserId) {
        try {
          await closeBrowser(browserId);
        } catch (error) {
          logger.error(`Error closing browser on disconnect: ${error}`);
        }
        socketBrowserMap.delete(socket.id);
      }
    });
  });
}