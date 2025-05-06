import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

interface BrowserInstance {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  url: string;
  lastActivity: number;
  viewportWidth: number;
  viewportHeight: number;
}

// Store active browser instances
const activeBrowsers: Map<string, BrowserInstance> = new Map();

// Browser configuration
const DEFAULT_URL = process.env.DEFAULT_URL || 'https://www.google.com';
const MAX_BROWSERS = parseInt(process.env.MAX_BROWSERS || '5', 10);
const BROWSER_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const DEFAULT_VIEWPORT_WIDTH = 1920;
const DEFAULT_VIEWPORT_HEIGHT = 1080;

/**
 * Initialize browser service and cleanup interval
 */
export async function setupBrowserService() {
  console.log('Setting up browser service...');
  
  // Setup cleanup interval
  setInterval(cleanupInactiveBrowsers, 5 * 60 * 1000); // Check every 5 minutes
  
  console.log('Browser service initialized');
  console.log(`Max browsers: ${MAX_BROWSERS}`);
  console.log(`Default URL: ${DEFAULT_URL}`);
}

/**
 * Create a new browser instance
 */
export async function createBrowser(
  initialUrl = DEFAULT_URL,
  viewportWidth = DEFAULT_VIEWPORT_WIDTH,
  viewportHeight = DEFAULT_VIEWPORT_HEIGHT
): Promise<string> {
  try {
    // Check if max browsers limit reached
    if (activeBrowsers.size >= MAX_BROWSERS) {
      // Find the oldest browser to replace
      let oldestId = '';
      let oldestTimestamp = Date.now();
      
      for (const [id, instance] of activeBrowsers.entries()) {
        if (instance.lastActivity < oldestTimestamp) {
          oldestTimestamp = instance.lastActivity;
          oldestId = id;
        }
      }
      
      if (oldestId) {
        await closeBrowser(oldestId);
      }
    }
    
    // Launch browser
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-infobars',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        `--window-size=${viewportWidth},${viewportHeight}`,
        '--use-gl=swiftshader',
        '--disable-software-rasterizer',
      ]
    });
    
    // Create context with viewport size
    const context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      deviceScaleFactor: 1,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      bypassCSP: true,
      permissions: ['notifications', 'geolocation'],
      javaScriptEnabled: true,
    });
    
    // Create page and navigate to initial URL
    const page = await context.newPage();
    await page.goto(initialUrl, { waitUntil: 'domcontentloaded' });
    
    // Generate unique ID
    const id = uuidv4();
    
    // Store browser instance
    const browserInstance: BrowserInstance = {
      id,
      browser,
      context,
      page,
      url: initialUrl,
      lastActivity: Date.now(),
      viewportWidth,
      viewportHeight,
    };
    
    activeBrowsers.set(id, browserInstance);
    logger.info(`Created browser: ${id}, Total: ${activeBrowsers.size}`);
    
    return id;
  } catch (error) {
    logger.error('Error creating browser:', error);
    throw error;
  }
}

/**
 * Close a browser instance
 */
export async function closeBrowser(id: string): Promise<boolean> {
  try {
    const instance = activeBrowsers.get(id);
    if (!instance) {
      return false;
    }
    
    await instance.page.close();
    await instance.context.close();
    await instance.browser.close();
    
    activeBrowsers.delete(id);
    logger.info(`Closed browser: ${id}, Remaining: ${activeBrowsers.size}`);
    
    return true;
  } catch (error) {
    logger.error(`Error closing browser ${id}:`, error);
    // Still remove it from active browsers
    activeBrowsers.delete(id);
    return false;
  }
}

// Interface for screenshot options
interface ScreenshotOptions {
  quality?: number;
  fullPage?: boolean;
  isKeyframe?: boolean;
  format?: 'jpeg' | 'png';
  omitBackground?: boolean;
}

/**
 * Get a screenshot of the current page
 */
export async function getScreenshot(id: string, options: ScreenshotOptions = {}): Promise<string | null> {
  try {
    const instance = activeBrowsers.get(id);
    if (!instance) {
      return null;
    }
    
    // Update last activity
    instance.lastActivity = Date.now();
    
    // Default options
    const screenshotType = options.format || process.env.SCREENSHOT_TYPE as 'jpeg' | 'png' || 'jpeg';
    const screenshotQuality = options.quality || parseInt(process.env.SCREENSHOT_QUALITY || '80', 10);
    const fullPage = options.fullPage || false;
    const omitBackground = options.omitBackground || false;
    
    // Take screenshot
    const screenshot = await instance.page.screenshot({
      type: screenshotType,
      quality: screenshotType === 'jpeg' ? screenshotQuality : undefined,
      fullPage,
      omitBackground,
    });
    
    // Encode as base64
    return `data:image/${screenshotType};base64,${screenshot.toString('base64')}`;
  } catch (error) {
    logger.error(`Error taking screenshot for browser ${id}:`, error);
    return null;
  }
}

/**
 * Navigate the browser to a new URL
 */
export async function navigateTo(id: string, url: string): Promise<boolean> {
  try {
    const instance = activeBrowsers.get(id);
    if (!instance) {
      return false;
    }
    
    // Update last activity
    instance.lastActivity = Date.now();
    
    // Format URL if it doesn't include http(s)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    // Navigate to URL
    await instance.page.goto(url, { waitUntil: 'domcontentloaded' });
    instance.url = url;
    
    return true;
  } catch (error) {
    logger.error(`Error navigating browser ${id} to ${url}:`, error);
    return false;
  }
}

/**
 * Execute user interaction on the browser
 */
export async function executeAction(id: string, action: string, params: any): Promise<boolean> {
  try {
    const instance = activeBrowsers.get(id);
    if (!instance) {
      return false;
    }
    
    // Update last activity
    instance.lastActivity = Date.now();
    
    // Execute action based on type
    switch (action) {
      case 'click':
        await instance.page.mouse.click(params.x, params.y);
        break;
      case 'doubleClick':
        await instance.page.mouse.dblclick(params.x, params.y);
        break;
      case 'mouseDown':
        await instance.page.mouse.down({
          button: params.button || 'left',
        });
        break;
      case 'mouseUp':
        await instance.page.mouse.up({
          button: params.button || 'left',
        });
        break;
      case 'mouseMove':
        await instance.page.mouse.move(params.x, params.y);
        break;
      case 'type':
        await instance.page.keyboard.type(params.text);
        break;
      case 'key':
        await instance.page.keyboard.press(params.key);
        break;
      case 'keyDown':
        await instance.page.keyboard.down(params.key);
        break;
      case 'keyUp':
        await instance.page.keyboard.up(params.key);
        break;
      case 'scroll':
        await instance.page.evaluate(({ x, y }) => {
          window.scrollTo(x, y);
        }, { x: params.x || 0, y: params.y || 0 });
        break;
      case 'scrollBy':
        await instance.page.evaluate(({ x, y }) => {
          window.scrollBy(x, y);
        }, { x: params.x || 0, y: params.y || 0 });
        break;
      case 'hover':
        await instance.page.hover(`text=${params.text}`);
        break;
      case 'reload':
        await instance.page.reload({ waitUntil: 'domcontentloaded' });
        break;
      case 'goBack':
        await instance.page.goBack({ waitUntil: 'domcontentloaded' });
        break;
      case 'goForward':
        await instance.page.goForward({ waitUntil: 'domcontentloaded' });
        break;
      default:
        logger.warn(`Unknown action: ${action}`);
        return false;
    }
    
    return true;
  } catch (error) {
    logger.error(`Error executing action ${action} on browser ${id}:`, error);
    return false;
  }
}

/**
 * Get the current URL of the browser
 */
export async function getCurrentUrl(id: string): Promise<string | null> {
  try {
    const instance = activeBrowsers.get(id);
    if (!instance) {
      return null;
    }
    
    return instance.page.url();
  } catch (error) {
    logger.error(`Error getting URL for browser ${id}:`, error);
    return null;
  }
}

/**
 * Resize browser viewport
 */
export async function resizeViewport(id: string, width: number, height: number): Promise<boolean> {
  try {
    const instance = activeBrowsers.get(id);
    if (!instance) {
      return false;
    }
    
    await instance.page.setViewportSize({ width, height });
    instance.viewportWidth = width;
    instance.viewportHeight = height;
    
    return true;
  } catch (error) {
    logger.error(`Error resizing viewport for browser ${id}:`, error);
    return false;
  }
}

/**
 * Clean up inactive browser instances
 */
function cleanupInactiveBrowsers() {
  const now = Date.now();
  
  for (const [id, instance] of activeBrowsers.entries()) {
    if (now - instance.lastActivity > BROWSER_TIMEOUT) {
      logger.info(`Cleaning up inactive browser: ${id}`);
      closeBrowser(id).catch(err => {
        logger.error(`Error during cleanup of browser ${id}:`, err);
      });
    }
  }
}

/**
 * Get browser instance by ID
 */
export function getBrowserInstance(id: string): BrowserInstance | undefined {
  return activeBrowsers.get(id);
}

/**
 * Get all active browser IDs
 */
export function getActiveBrowserIds(): string[] {
  return Array.from(activeBrowsers.keys());
}

/**
 * Get count of active browsers
 */
export function getActiveBrowserCount(): number {
  return activeBrowsers.size;
}