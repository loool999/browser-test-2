import express, { RequestHandler } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import compression from 'compression';
import { instrument } from '@socket.io/admin-ui';
import { Request, Response } from 'express';

// Import services
import { setupBrowserService, getScreenshot } from './services/browserService';
import { setupSocketHandlers } from './services/socketService';
import { initSessionService } from './services/sessionService';
import { initSecurityService } from './services/securityService';
import { initConfigService } from './services/configService';
import { initAnalyticsService } from './services/analyticsService';

// Import utilities
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Initialize services
const configService = initConfigService();
const securityService = initSecurityService();
const sessionService = initSessionService();
const analyticsService = initAnalyticsService();

// Get configuration
const config = configService.getConfig();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Configure middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize Socket.IO with CORS configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e8, // 100MB max buffer size for binary data
});

// Setup Socket.IO Admin UI
instrument(io, {
  auth: false,
  mode: 'development',
});

// Setup browser service and socket handlers
setupBrowserService();
setupSocketHandlers(io);

// Basic session management
io.use((socket, next) => {
  // Extract session token from handshake
  const token = socket.handshake.auth.token || '';
  const ip = socket.handshake.address;
  const userAgent = socket.handshake.headers['user-agent'] || '';
  
  // Validate or create session
  const session = sessionService.getOrCreateSession(token, {
    ipAddress: ip,
    userAgent
  });
  
  // Attach session to socket
  (socket as any).session = session;
  
  next();
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API endpoints
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Add route to capture screenshot
app.get('/api/screenshot/:id', (async (req, res) => {
  const { id } = req.params;
  try {
    const screenshot = await getScreenshot(id);
    if (!screenshot) {
      return res.status(404).json({ success: false, message: 'Browser instance not found or screenshot failed' });
    }
    res.json({ success: true, screenshot });
  } catch (error) {
    logger.error('Error capturing screenshot:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}) as RequestHandler);

// Start server
const PORT = 8002;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Socket.IO path: /socket.io`);
  logger.info(`Environment: development`);
});
