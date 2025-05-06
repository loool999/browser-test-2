import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

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
    screenshotType: process.env.SCREENSHOT_TYPE as 'jpeg' | 'png' || 'jpeg',
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
const configFilePath = path.join(process.cwd(), 'config.json');

/**
 * Initialize config service
 */
export function initConfigService() {
  logger.info('Initializing config service');
  
  // Try to load config from file
  try {
    if (fs.existsSync(configFilePath)) {
      const fileConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
      currentConfig = deepMerge(currentConfig, fileConfig);
      logger.info('Loaded configuration from file');
    } else {
      // Save default config to file
      saveConfig();
      logger.info('Created default configuration file');
    }
  } catch (error) {
    logger.error('Error loading configuration file:', error);
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
export function getConfig() {
  return { ...currentConfig };
}

/**
 * Update configuration
 */
export function updateConfig(updates: Partial<typeof currentConfig>, save = true): typeof currentConfig {
  currentConfig = deepMerge(currentConfig, updates);
  
  if (save) {
    saveConfig();
  }
  
  return { ...currentConfig };
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): typeof currentConfig {
  currentConfig = { ...defaultConfig };
  saveConfig();
  return { ...currentConfig };
}

/**
 * Save configuration to file
 */
export function saveConfig(): void {
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(currentConfig, null, 2), 'utf8');
    logger.info('Configuration saved to file');
  } catch (error) {
    logger.error('Error saving configuration:', error);
  }
}

/**
 * Get a specific configuration value by path
 * @example getConfigValue('server.port')
 */
export function getConfigValue<T = any>(path: string, defaultValue?: T): T {
  const parts = path.split('.');
  let current: any = currentConfig;
  
  for (const part of parts) {
    if (current === undefined || current === null) {
      return defaultValue as T;
    }
    current = current[part];
  }
  
  return current !== undefined ? current : defaultValue as T;
}

/**
 * Deep merge two objects
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}
