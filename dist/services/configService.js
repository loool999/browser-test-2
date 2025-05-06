"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initConfigService = initConfigService;
exports.getConfig = getConfig;
exports.updateConfig = updateConfig;
exports.resetConfig = resetConfig;
exports.saveConfig = saveConfig;
exports.getConfigValue = getConfigValue;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("../utils/logger");
// Load environment variables
dotenv_1.default.config();
// Default configuration
const defaultConfig = {
    server: {
        port: parseInt(process.env.PORT || '8002', 10),
        host: process.env.HOST || '0.0.0.0',
        corsOrigin: process.env.CORS_ORIGIN || '*',
        socketPath: process.env.SOCKET_PATH || '/socket.io'
    },
    browser: {
        defaultUrl: process.env.DEFAULT_URL || 'https://www.google.com',
        maxBrowsers: parseInt(process.env.MAX_BROWSERS || '5', 10),
        defaultViewport: {
            width: 1920,
            height: 1080
        },
        defaultUserAgent: process.env.DEFAULT_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        browserTimeout: parseInt(process.env.BROWSER_TIMEOUT || '900000', 10) // 15 minutes
    },
    streaming: {
        defaultQuality: parseInt(process.env.SCREENSHOT_QUALITY || '80', 10),
        defaultFps: parseInt(process.env.DEFAULT_FPS || '30', 10),
        screenshotType: process.env.SCREENSHOT_TYPE || 'jpeg',
        adaptiveBitrate: process.env.ADAPTIVE_BITRATE !== 'false',
        keyframeInterval: parseInt(process.env.KEYFRAME_INTERVAL || '10', 10),
        maxFps: parseInt(process.env.MAX_FPS || '60', 10),
        minFps: parseInt(process.env.MIN_FPS || '5', 10)
    },
    security: {
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '7200000', 10), // 2 hours
        maxFailedAttempts: parseInt(process.env.MAX_FAILED_ATTEMPTS || '5', 10),
        rateLimit: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // 1 minute
            max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10) // 100 requests per minute
        }
    },
    features: {
        recording: process.env.ENABLE_RECORDING === 'true',
        plugins: process.env.ENABLE_PLUGINS === 'true',
        userAccounts: process.env.ENABLE_USER_ACCOUNTS === 'true',
        adminPanel: process.env.ENABLE_ADMIN_PANEL === 'true'
    },
    storage: {
        type: process.env.STORAGE_TYPE || 'local',
        path: process.env.STORAGE_PATH || './storage'
    }
};
// Current configuration (will be updated at runtime)
let currentConfig = { ...defaultConfig };
// Configuration file path
const configFilePath = path_1.default.join(process.cwd(), 'config.json');
/**
 * Initialize config service
 */
function initConfigService() {
    logger_1.logger.info('Initializing config service');
    // Try to load config from file
    try {
        if (fs_1.default.existsSync(configFilePath)) {
            const fileConfig = JSON.parse(fs_1.default.readFileSync(configFilePath, 'utf8'));
            currentConfig = deepMerge(currentConfig, fileConfig);
            logger_1.logger.info('Loaded configuration from file');
        }
        else {
            // Save default config to file
            saveConfig();
            logger_1.logger.info('Created default configuration file');
        }
    }
    catch (error) {
        logger_1.logger.error('Error loading configuration file:', error);
    }
    return {
        getConfig,
        updateConfig,
        resetConfig,
        saveConfig,
        getConfigValue
    };
}
/**
 * Get entire configuration
 */
function getConfig() {
    return { ...currentConfig };
}
/**
 * Update configuration
 */
function updateConfig(updates, save = true) {
    currentConfig = deepMerge(currentConfig, updates);
    if (save) {
        saveConfig();
    }
    return { ...currentConfig };
}
/**
 * Reset configuration to defaults
 */
function resetConfig() {
    currentConfig = { ...defaultConfig };
    saveConfig();
    return { ...currentConfig };
}
/**
 * Save configuration to file
 */
function saveConfig() {
    try {
        fs_1.default.writeFileSync(configFilePath, JSON.stringify(currentConfig, null, 2), 'utf8');
        logger_1.logger.info('Configuration saved to file');
    }
    catch (error) {
        logger_1.logger.error('Error saving configuration:', error);
    }
}
/**
 * Get a specific configuration value by path
 * @example getConfigValue('server.port')
 */
function getConfigValue(path, defaultValue) {
    const parts = path.split('.');
    let current = currentConfig;
    for (const part of parts) {
        if (current === undefined || current === null) {
            return defaultValue;
        }
        current = current[part];
    }
    return current !== undefined ? current : defaultValue;
}
/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
            result[key] = deepMerge(target[key], source[key]);
        }
        else {
            result[key] = source[key];
        }
    }
    return result;
}
//# sourceMappingURL=configService.js.map