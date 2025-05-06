"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const compression_1 = __importDefault(require("compression"));
const admin_ui_1 = require("@socket.io/admin-ui");
// Import services
const browserService_1 = require("./services/browserService");
const socketService_1 = require("./services/socketService");
const sessionService_1 = require("./services/sessionService");
const securityService_1 = require("./services/securityService");
const configService_1 = require("./services/configService");
const analyticsService_1 = require("./services/analyticsService");
// Import utilities
const logger_1 = require("./utils/logger");
// Load environment variables
dotenv_1.default.config();
// Initialize services
const configService = (0, configService_1.initConfigService)();
const securityService = (0, securityService_1.initSecurityService)();
const sessionService = (0, sessionService_1.initSessionService)();
const analyticsService = (0, analyticsService_1.initAnalyticsService)();
// Get configuration
const config = configService.getConfig();
// Initialize Express app
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Configure middleware
app.use((0, cors_1.default)());
app.use((0, compression_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Initialize Socket.IO with CORS configuration
const io = new socket_io_1.Server(server, {
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
(0, admin_ui_1.instrument)(io, {
    auth: false,
    mode: 'development',
});
// Setup browser service and socket handlers
(0, browserService_1.setupBrowserService)();
(0, socketService_1.setupSocketHandlers)(io);
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
    socket.session = session;
    next();
});
// Routes
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
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
        const screenshot = await (0, browserService_1.getScreenshot)(id);
        if (!screenshot) {
            return res.status(404).json({ success: false, message: 'Browser instance not found or screenshot failed' });
        }
        res.json({ success: true, screenshot });
    }
    catch (error) {
        logger_1.logger.error('Error capturing screenshot:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}));
// Start server
const PORT = 8002;
server.listen(PORT, () => {
    logger_1.logger.info(`Server running on port ${PORT}`);
    logger_1.logger.info(`Socket.IO path: /socket.io`);
    logger_1.logger.info(`Environment: development`);
});
//# sourceMappingURL=index.js.map