/**
 * Utility functions for the headless browser interface
 */

/**
 * Debounce function to limit calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Throttle function to limit calls by time interval
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Bytes to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format data rate (bytes per second)
 * @param {number} bytesPerSecond - Bytes per second
 * @returns {string} Formatted string
 */
function formatDataRate(bytesPerSecond) {
    return formatBytes(bytesPerSecond) + '/s';
}

/**
 * Convert base64 to array buffer
 * @param {string} base64 - Base64 string
 * @returns {Uint8Array} Byte array
 */
function base64ToArrayBuffer(base64) {
    // Remove data URL prefix if present
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
}

/**
 * Convert array buffer to base64
 * @param {ArrayBuffer} buffer - Array buffer
 * @returns {string} Base64 string
 */
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
}

/**
 * Decompress base64 data using pako
 * @param {string} compressedBase64 - Compressed base64 string
 * @param {boolean} isImage - Whether to return as image data URL
 * @returns {string} Decompressed string or data URL
 */
function decompressBase64(compressedBase64, isImage = true) {
    try {
        // Convert base64 to binary array
        const bytes = base64ToArrayBuffer(compressedBase64);
        
        // Use pako to decompress
        const decompressed = pako.inflate(bytes);
        
        // Convert back to base64
        const decompressedBase64 = arrayBufferToBase64(decompressed);
        
        // Return with or without data URL prefix
        return isImage ? `data:image/jpeg;base64,${decompressedBase64}` : decompressedBase64;
    } catch (e) {
        console.error('Decompression error:', e);
        // Fallback to just using the data directly if decompression fails
        return isImage ? `data:image/jpeg;base64,${compressedBase64}` : compressedBase64;
    }
}

/**
 * Show notification
 * @param {string} message - Message to show
 * @param {number} duration - Duration in milliseconds
 */
function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    const messageEl = document.getElementById('notification-message');
    
    messageEl.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

/**
 * Download blob as file
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Filename
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Convert data URL to blob
 * @param {string} dataUrl - Data URL
 * @returns {Blob} Blob
 */
function dataURLtoBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
}

/**
 * Enable fullscreen for an element
 * @param {HTMLElement} element - Element to make fullscreen
 */
function toggleFullscreen(element) {
    if (!document.fullscreenElement) {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.mozRequestFullScreen) { // Firefox
            element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) { // Chrome, Safari, Opera
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) { // IE/Edge
            element.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

/**
 * Generate a random ID
 * @returns {string} Random ID
 */
function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Check if device is mobile
 * @returns {boolean} True if mobile
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Check if touch is supported
 * @returns {boolean} True if touch supported
 */
function isTouchSupported() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Create ripple effect
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {HTMLElement} parent - Parent element
 */
function createRipple(x, y, parent) {
    const ripple = document.getElementById('click-ripple');
    
    // Clear any existing animation
    ripple.classList.remove('ripple-animation');
    
    // Set position
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    // Trigger reflow
    void ripple.offsetWidth;
    
    // Start animation
    ripple.classList.add('ripple-animation');
}