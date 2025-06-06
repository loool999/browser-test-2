/**
 * Device profiles and screen resolution utilities
 * This module helps adapt the browser experience to different devices and screen sizes
 */

// Device types
export enum DeviceType {
  DESKTOP = 'desktop',
  TABLET = 'tablet',
  MOBILE = 'mobile',
  TV = 'tv',
  UNKNOWN = 'unknown'
}

// Device orientation
export enum Orientation {
  LANDSCAPE = 'landscape',
  PORTRAIT = 'portrait'
}

// Preset device resolutions
export const deviceResolutions = {
  // Desktop resolutions
  desktop: {
    hd: { width: 1280, height: 720 },
    fullHd: { width: 1920, height: 1080 },
    qhd: { width: 2560, height: 1440 },
    ultraHd: { width: 3840, height: 2160 }
  },
  // Tablet resolutions
  tablet: {
    ipadPro12: { width: 2048, height: 2732 },
    ipadPro11: { width: 1668, height: 2388 },
    ipadPro10: { width: 1668, height: 2224 },
    ipad: { width: 1620, height: 2160 },
    galaxyTab: { width: 1600, height: 2560 },
    surface: { width: 1500, height: 1000 }
  },
  // Mobile resolutions
  mobile: {
    iphone15ProMax: { width: 1290, height: 2796 },
    iphone15Pro: { width: 1179, height: 2556 },
    iphone15: { width: 1179, height: 2556 },
    iphoneSE: { width: 750, height: 1334 },
    galaxyS23: { width: 1080, height: 2340 },
    pixel7Pro: { width: 1440, height: 3120 }
  }
};

// Common device capabilities
export interface DeviceCapabilities {
  touchSupported: boolean;
  pointerSupported: boolean;
  maxTouchPoints: number;
  hoverSupported: boolean;
  devicePixelRatio: number;
  colorDepth: number;
  webGLSupported: boolean;
  orientationSupported: boolean;
}

// Common devices with capabilities
export const deviceProfiles: Record<string, {
  name: string;
  type: DeviceType;
  resolution: { width: number; height: number };
  userAgent: string;
  capabilities: DeviceCapabilities;
}> = {
  desktop: {
    name: 'Desktop',
    type: DeviceType.DESKTOP,
    resolution: deviceResolutions.desktop.fullHd,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    capabilities: {
      touchSupported: false,
      pointerSupported: true,
      maxTouchPoints: 0,
      hoverSupported: true,
      devicePixelRatio: 1,
      colorDepth: 24,
      webGLSupported: true,
      orientationSupported: false
    }
  },
  iphone15Pro: {
    name: 'iPhone 15 Pro',
    type: DeviceType.MOBILE,
    resolution: deviceResolutions.mobile.iphone15Pro,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    capabilities: {
      touchSupported: true,
      pointerSupported: true,
      maxTouchPoints: 5,
      hoverSupported: false,
      devicePixelRatio: 3,
      colorDepth: 30,
      webGLSupported: true,
      orientationSupported: true
    }
  },
  galaxyS23: {
    name: 'Samsung Galaxy S23',
    type: DeviceType.MOBILE,
    resolution: deviceResolutions.mobile.galaxyS23,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    capabilities: {
      touchSupported: true,
      pointerSupported: true,
      maxTouchPoints: 5,
      hoverSupported: false,
      devicePixelRatio: 2.625,
      colorDepth: 24,
      webGLSupported: true,
      orientationSupported: true
    }
  },
  ipadPro: {
    name: 'iPad Pro',
    type: DeviceType.TABLET,
    resolution: deviceResolutions.tablet.ipadPro12,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    capabilities: {
      touchSupported: true,
      pointerSupported: true,
      maxTouchPoints: 10,
      hoverSupported: false,
      devicePixelRatio: 2,
      colorDepth: 24,
      webGLSupported: true,
      orientationSupported: true
    }
  }
};

/**
 * Get a device profile by name
 */
export function getDeviceProfile(name: string) {
  return deviceProfiles[name] || deviceProfiles.desktop;
}

/**
 * Determine device type from user agent
 */
export function detectDeviceType(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();
  
  if (/iphone|android.*mobile|windows.*phone|blackberry|bb10|webos|ipod|opera mini|nokia|mobile safari|iemobile/i.test(ua)) {
    return DeviceType.MOBILE;
  } else if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) {
    return DeviceType.TABLET;
  } else if (/smart-tv|hbbtv|appletv|roku|kdl|netcast|viera|boxee|samsung.*tv|lg.*tv|webos.*tv|tv safari/i.test(ua)) {
    return DeviceType.TV;
  } else {
    return DeviceType.DESKTOP;
  }
}

/**
 * Determine orientation from dimensions
 */
export function getOrientation(width: number, height: number): Orientation {
  return width >= height ? Orientation.LANDSCAPE : Orientation.PORTRAIT;
}

/**
 * Calculate aspect ratio as a string (e.g., "16:9")
 */
export function calculateAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  
  return `${width / divisor}:${height / divisor}`;
}

/**
 * Get optimal resolution based on device type and connection speed
 */
export function getOptimalResolution(
  deviceType: DeviceType, 
  connectionSpeed: 'slow' | 'medium' | 'fast',
  maxWidth?: number,
  maxHeight?: number
): { width: number; height: number } {
  let resolution: { width: number; height: number };
  
  switch (deviceType) {
    case DeviceType.MOBILE:
      resolution = connectionSpeed === 'slow' 
        ? { width: 640, height: 1136 } 
        : connectionSpeed === 'medium'
          ? { width: 750, height: 1334 }
          : { width: 1080, height: 1920 };
      break;
    case DeviceType.TABLET:
      resolution = connectionSpeed === 'slow'
        ? { width: 1024, height: 768 }
        : connectionSpeed === 'medium'
          ? { width: 1280, height: 800 }
          : { width: 1668, height: 2224 };
      break;
    case DeviceType.TV:
      resolution = connectionSpeed === 'slow'
        ? { width: 1280, height: 720 }
        : { width: 1920, height: 1080 };
      break;
    default: // Desktop
      resolution = connectionSpeed === 'slow'
        ? { width: 1280, height: 720 }
        : connectionSpeed === 'medium'
          ? { width: 1920, height: 1080 }
          : { width: 2560, height: 1440 };
  }
  
  // Apply maximum dimensions if specified
  if (maxWidth && resolution.width > maxWidth) {
    const ratio = resolution.height / resolution.width;
    resolution.width = maxWidth;
    resolution.height = Math.round(maxWidth * ratio);
  }
  
  if (maxHeight && resolution.height > maxHeight) {
    const ratio = resolution.width / resolution.height;
    resolution.height = maxHeight;
    resolution.width = Math.round(maxHeight * ratio);
  }
  
  return resolution;
}

/**
 * Calculate streaming settings based on connection and device
 */
export function calculateStreamSettings(
  connectionSpeed: 'slow' | 'medium' | 'fast',
  deviceType: DeviceType
): { 
  fps: number; 
  quality: number; 
  adaptiveBitrate: boolean;
  keyframeInterval: number;
} {
  // Default settings
  const settings = {
    fps: 30,
    quality: 80,
    adaptiveBitrate: true,
    keyframeInterval: 10
  };
  
  // Adjust based on connection speed
  switch (connectionSpeed) {
    case 'slow':
      settings.fps = 15;
      settings.quality = 60;
      settings.keyframeInterval = 15;
      break;
    case 'medium':
      settings.fps = 24;
      settings.quality = 75;
      settings.keyframeInterval = 10;
      break;
    case 'fast':
      settings.fps = 30;
      settings.quality = 85;
      settings.keyframeInterval = 8;
      break;
  }
  
  // Further adjust for device type
  if (deviceType === DeviceType.MOBILE) {
    settings.fps = Math.min(settings.fps, 24); // Cap FPS for mobile
    settings.quality -= 5; // Slightly lower quality
  } else if (deviceType === DeviceType.DESKTOP) {
    if (connectionSpeed === 'fast') {
      settings.fps = 60; // Higher FPS for desktop on fast connections
    }
  }
  
  return settings;
}

/**
 * Estimate connection speed based on network info
 * This is meant to be used in the browser
 */
export function estimateConnectionSpeed(
  downloadSpeed?: number, // In Mbps
  rtt?: number, // In ms
  connectionType?: string // 4g, wifi, etc.
): 'slow' | 'medium' | 'fast' {
  if (downloadSpeed) {
    if (downloadSpeed < 1) return 'slow';
    if (downloadSpeed < 5) return 'medium';
    return 'fast';
  }
  
  if (rtt) {
    if (rtt > 300) return 'slow';
    if (rtt > 100) return 'medium';
    return 'fast';
  }
  
  if (connectionType) {
    if (['slow-2g', '2g', 'cellular'].includes(connectionType)) return 'slow';
    if (['3g', 'dsl'].includes(connectionType)) return 'medium';
    if (['4g', '5g', 'wifi', 'ethernet'].includes(connectionType)) return 'fast';
  }
  
  return 'medium'; // Default to medium if no information available
}