/**
 * Interactive Headless Browser - Main Application
 */
document.addEventListener('DOMContentLoaded', () => {
    // =================
    // DOM Elements
    // =================
    // Main elements
    const canvas = document.getElementById('display-canvas');
    const ctx = canvas.getContext('2d');
    const browserContainer = document.querySelector('.browser-container');
    const interactionLayer = document.querySelector('.interaction-layer');
    
    // Navigation controls
    const urlInput = document.getElementById('url-input');
    const goButton = document.getElementById('go-button');
    const backButton = document.getElementById('back-button');
    const forwardButton = document.getElementById('forward-button');
    const refreshButton = document.getElementById('refresh-button');
    
    // Status indicators
    const connectionStatus = document.getElementById('connection-status');
    const fpsCounter = document.getElementById('fps-counter');
    const latencyIndicator = document.getElementById('latency-indicator');
    const browserId = document.getElementById('browser-id');
    const activeBrowsers = document.getElementById('active-browsers');
    const currentUrl = document.getElementById('current-url');
    const framesReceived = document.getElementById('frames-received');
    const avgFps = document.getElementById('avg-fps');
    const latencyElement = document.getElementById('latency');
    const dataRateElement = document.getElementById('data-rate');
    
    // Loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // Interaction feedback elements
    const cursorIndicator = document.getElementById('cursor-indicator');
    const clickRipple = document.getElementById('click-ripple');
    const selectionBox = document.getElementById('selection-box');
    const keyboardIndicator = document.getElementById('keyboard-indicator');
    const keyboardText = document.getElementById('keyboard-text');
    
    // Stream settings
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    const fpsSlider = document.getElementById('fps-slider');
    const fpsValue = document.getElementById('fps-value');
    const adaptiveBitrateCheckbox = document.getElementById('adaptive-bitrate');
    
    // Input settings
    const enableKeyboardCheckbox = document.getElementById('enable-keyboard');
    const enableMouseCheckbox = document.getElementById('enable-mouse');
    const showInteractionFeedbackCheckbox = document.getElementById('show-interaction-feedback');
    
    // Special keys buttons
    const keyButtons = document.querySelectorAll('.key-button');
    
    // Action buttons
    const restartButton = document.getElementById('restart-browser');
    const toggleStreamButton = document.getElementById('toggle-stream');
    const fullscreenButton = document.getElementById('fullscreen-button');
    const screenshotButton = document.getElementById('screenshot-button');
    
    // Mobile controls
    const mobileControls = document.getElementById('mobile-controls');
    const mobileKeyboardToggle = document.getElementById('mobile-keyboard-toggle');
    const mobileTouchToggle = document.getElementById('mobile-touch-toggle');
    
    // Notification
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notification-message');
    const notificationClose = document.getElementById('notification-close');
    
    // =================
    // Socket.IO Connection
    // =================
    const socket = io({
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });
    
    // =================
    // State Variables
    // =================
    const state = {
        // Connection state
        isConnected: false,
        currentBrowserId: null,
        isStreaming: true,
        
        // Performance metrics
        frameCount: 0,
        lastFrameTime: performance.now(),
        startTime: performance.now(),
        fpsValues: [],
        bytesReceived: 0,
        lastBytesReceived: 0,
        lastByteCountTime: performance.now(),
        dataRate: 0,
        
        // Touch/mouse state
        isTouchDevice: isTouchSupported(),
        isMouseDown: false,
        lastClickTime: 0,
        selectionStart: null,
        selectionActive: false,
        
        // Input state
        keyboardActive: true,
        mouseActive: true,
        showFeedback: true,
        focusOnCanvas: false,
        
        // Canvas state
        canvasRect: null,
        
        // Image state
        imgObj: new Image(),
        currentImage: null,
        lastKeyframeTimestamp: 0,
        
        // Latency
        lastPingTime: 0,
        latency: 0,
        
        // Settings changes
        settingsUpdateTimeout: null
    };
    
    // Configuration
    const config = {
        fps: parseInt(fpsSlider.value),
        quality: parseInt(qualitySlider.value),
        adaptiveBitrate: adaptiveBitrateCheckbox.checked,
        width: window.innerWidth > 1920 ? 1920 : window.innerWidth,
        height: window.innerHeight > 1080 ? 1080 : window.innerHeight
    };
    
    // =================
    // Canvas Setup
    // =================
    function resizeCanvas() {
        const container = interactionLayer;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        state.canvasRect = canvas.getBoundingClientRect();
        
        // Resize browser viewport to match canvas aspect ratio
        if (state.isConnected) {
            const width = Math.min(1920, container.clientWidth);
            const height = Math.min(1080, container.clientHeight);
            
            socket.emit('resize', { width, height }, (response) => {
                if (response.success) {
                    config.width = width;
                    config.height = height;
                }
            });
        }
        
        // If we have an image, redraw it
        if (state.currentImage) {
            drawImage(state.currentImage);
        }
    }
    
    // Initialize canvas
    resizeCanvas();
    window.addEventListener('resize', debounce(resizeCanvas, 300));
    
    // =================
    // Socket Connection Handlers
    // =================
    socket.on('connect', () => {
        console.log('Socket connected');
        connectionStatus.textContent = 'Connecting...';
        
        // Initialize browser
        initializeBrowser();
        
        // Update status regularly
        updateStatus();
        setInterval(updateStatus, 5000);
        
        // Start ping for latency measurement
        startPingInterval();
        
        // Start data rate calculation
        startDataRateCalculation();
    });
    
    socket.on('reconnect', () => {
        console.log('Reconnected to server');
        loadingOverlay.style.display = 'flex';
        loadingOverlay.querySelector('p').textContent = 'Reconnecting...';
        
        initializeBrowser();
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        state.isConnected = false;
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.classList.remove('connected');
        loadingOverlay.style.display = 'flex';
        loadingOverlay.querySelector('p').textContent = 'Connection lost. Reconnecting...';
    });
    
    // =================
    // Frame/Stream Handling
    // =================
    socket.on('frame', (data) => {
        // Calculate FPS
        const now = performance.now();
        const elapsed = now - state.lastFrameTime;
        const currentFps = 1000 / elapsed;
        
        // Update FPS display with smoothing
        state.fpsValues.push(currentFps);
        if (state.fpsValues.length > 30) {
            state.fpsValues.shift();
        }
        
        const avgCurrentFps = state.fpsValues.reduce((a, b) => a + b, 0) / state.fpsValues.length;
        fpsCounter.textContent = `${Math.round(avgCurrentFps)} FPS`;
        
        // Track frame stats
        state.frameCount++;
        framesReceived.textContent = state.frameCount;
        state.lastFrameTime = now;
        state.bytesReceived += data.image.length;
        
        // Update latency estimate based on frame timestamp
        if (data.timestamp) {
            const frameLatency = now - data.timestamp;
            state.latency = frameLatency;
            latencyElement.textContent = `${Math.round(frameLatency)}ms`;
            latencyIndicator.textContent = `${Math.round(frameLatency)}ms`;
        }
        
        // Calculate overall average FPS
        const totalTimeSeconds = (now - state.startTime) / 1000;
        avgFps.textContent = (state.frameCount / totalTimeSeconds).toFixed(1);
        
        // If this is a keyframe, track the timestamp
        if (data.isKeyframe) {
            state.lastKeyframeTimestamp = data.timestamp;
        }
        
        // Decompress and draw the image
        try {
            const imageData = decompressBase64(data.image);
            state.currentImage = imageData;
            drawImage(imageData);
        } catch (error) {
            console.error('Error processing frame:', error);
        }
    });
    
    // Handle ping responses for latency measurement
    socket.on('pong', (startTime) => {
        const latency = performance.now() - startTime;
        // Only update if we don't have frame-based latency
        if (!state.lastKeyframeTimestamp) {
            state.latency = latency;
            latencyElement.textContent = `${Math.round(latency)}ms`;
            latencyIndicator.textContent = `${Math.round(latency)}ms`;
        }
    });
    
    // Handle stream settings updates
    socket.on('stream-settings-updated', (settings) => {
        if (settings.fps) {
            config.fps = settings.fps;
            fpsSlider.value = settings.fps;
            fpsValue.textContent = settings.fps;
        }
        
        if (settings.quality) {
            config.quality = settings.quality;
            qualitySlider.value = settings.quality;
            qualityValue.textContent = settings.quality;
        }
        
        if (settings.width) config.width = settings.width;
        if (settings.height) config.height = settings.height;
        
        if (settings.adaptiveBitrate !== undefined) {
            config.adaptiveBitrate = settings.adaptiveBitrate;
            adaptiveBitrateCheckbox.checked = settings.adaptiveBitrate;
        }
        
        console.log('Stream settings updated:', settings);
    });
    
    // =================
    // Core Functions
    // =================
    function initializeBrowser() {
        socket.emit('init', { 
            url: 'https://www.google.com',
            width: config.width,
            height: config.height,
            fps: config.fps,
            quality: config.quality,
            adaptiveBitrate: config.adaptiveBitrate
        }, (response) => {
            if (response.success) {
                state.isConnected = true;
                state.currentBrowserId = response.browserId;
                connectionStatus.textContent = 'Connected';
                connectionStatus.classList.add('connected');
                browserId.textContent = state.currentBrowserId;
                loadingOverlay.style.display = 'none';
                console.log('Browser initialized:', response.browserId);
                
                // Reset timing variables
                state.startTime = performance.now();
                state.frameCount = 0;
                state.bytesReceived = 0;
                state.lastBytesReceived = 0;
                state.lastByteCountTime = performance.now();
                state.fpsValues = [];
                
                // Update URL display
                updateCurrentUrl();
                
                // Show notification
                showNotification('Connected to browser');
            } else {
                connectionStatus.textContent = 'Connection Failed';
                console.error('Failed to initialize browser:', response.error);
                showNotification('Failed to connect to browser', 5000);
            }
        });
    }
    
    function drawImage(imageData) {
        state.imgObj.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Calculate aspect ratio preservation
            const imgAspect = state.imgObj.width / state.imgObj.height;
            const canvasAspect = canvas.width / canvas.height;
            
            let drawWidth, drawHeight, offsetX, offsetY;
            
            if (imgAspect > canvasAspect) {
                // Image is wider than canvas (relative to height)
                drawWidth = canvas.width;
                drawHeight = canvas.width / imgAspect;
                offsetX = 0;
                offsetY = (canvas.height - drawHeight) / 2;
            } else {
                // Image is taller than canvas (relative to width)
                drawHeight = canvas.height;
                drawWidth = canvas.height * imgAspect;
                offsetX = (canvas.width - drawWidth) / 2;
                offsetY = 0;
            }
            
            ctx.drawImage(state.imgObj, offsetX, offsetY, drawWidth, drawHeight);
        };
        
        state.imgObj.src = imageData;
    }
    
    function updateStatus() {
        if (!state.isConnected) return;
        
        socket.emit('status', (data) => {
            if (data.connected) {
                activeBrowsers.textContent = data.activeBrowsers;
                
                if (data.browserId !== state.currentBrowserId) {
                    state.currentBrowserId = data.browserId;
                    browserId.textContent = state.currentBrowserId || 'None';
                }
                
                // Update stream stats if available
                if (data.stream) {
                    document.getElementById('avg-fps').textContent = data.stream.avgFps.toFixed(1);
                }
                
                // Update URL display
                updateCurrentUrl();
            }
        });
    }
    
    function updateCurrentUrl() {
        if (!state.isConnected) return;
        
        socket.emit('action', { 
            action: 'getCurrentUrl', 
            params: {} 
        }, (response) => {
            if (response.success && response.url) {
                currentUrl.textContent = response.url;
                urlInput.value = response.url.replace(/^https?:\/\//, '');
            }
        });
    }
    
    function startPingInterval() {
        setInterval(() => {
            if (!state.isConnected) return;
            
            state.lastPingTime = performance.now();
            socket.emit('ping', state.lastPingTime);
        }, 2000);
    }
    
    function startDataRateCalculation() {
        setInterval(() => {
            const now = performance.now();
            const bytesPerSecond = (state.bytesReceived - state.lastBytesReceived) / 
                ((now - state.lastByteCountTime) / 1000);
            
            state.dataRate = bytesPerSecond;
            dataRateElement.textContent = formatDataRate(bytesPerSecond);
            
            state.lastBytesReceived = state.bytesReceived;
            state.lastByteCountTime = now;
        }, 1000);
    }
    
    function updateStreamSettings() {
        clearTimeout(state.settingsUpdateTimeout);
        
        state.settingsUpdateTimeout = setTimeout(() => {
            socket.emit('stream-settings', {
                fps: config.fps,
                quality: config.quality,
                adaptiveBitrate: config.adaptiveBitrate
            });
        }, 300);
    }
    
    function getRelativePosition(e) {
        if (!state.canvasRect) {
            state.canvasRect = canvas.getBoundingClientRect();
        }
        
        // Get position within canvas
        let clientX, clientY;
        
        if (e.type.startsWith('touch')) {
            // Touch event
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            // Mouse event
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        // The image dimensions should match the browser viewport
        const imageWidth = config.width;
        const imageHeight = config.height;
        
        // Account for any letterboxing due to aspect ratio preservation
        const imgAspect = imageWidth / imageHeight;
        const canvasAspect = canvas.width / canvas.height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgAspect > canvasAspect) {
            // Image is wider than canvas (relative to height)
            drawWidth = canvas.width;
            drawHeight = canvas.width / imgAspect;
            offsetX = 0;
            offsetY = (canvas.height - drawHeight) / 2;
        } else {
            // Image is taller than canvas (relative to width)
            drawHeight = canvas.height;
            drawWidth = canvas.height * imgAspect;
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = 0;
        }
        
        // Calculate the point within the displayed image
        const relX = clientX - state.canvasRect.left - offsetX;
        const relY = clientY - state.canvasRect.top - offsetY;
        
        // Scale to actual image dimensions
        const virtualX = (relX / drawWidth) * imageWidth;
        const virtualY = (relY / drawHeight) * imageHeight;
        
        return {
            x: Math.max(0, Math.min(imageWidth, virtualX)),
            y: Math.max(0, Math.min(imageHeight, virtualY)),
            canvasX: clientX - state.canvasRect.left,
            canvasY: clientY - state.canvasRect.top,
            offsetX,
            offsetY,
            drawWidth,
            drawHeight
        };
    }
    
    function takeScreenshot() {
        if (!state.currentImage) {
            showNotification('No image available to capture');
            return;
        }
        
        try {
            // Get current date and time for filename
            const date = new Date();
            const timestamp = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}-${date.getSeconds().toString().padStart(2, '0')}`;
            const filename = `screenshot_${timestamp}.jpg`;
            
            // Convert data URL to blob and download
            const blob = dataURLtoBlob(state.currentImage);
            downloadBlob(blob, filename);
            
            showNotification('Screenshot saved');
        } catch (error) {
            console.error('Error taking screenshot:', error);
            showNotification('Failed to save screenshot');
        }
    }
    
    function toggleFullscreenMode() {
        document.body.classList.toggle('fullscreen-mode');
        
        if (document.body.classList.contains('fullscreen-mode')) {
            fullscreenButton.innerHTML = '<i class="fas fa-compress"></i>';
            fullscreenButton.title = 'Exit Fullscreen';
        } else {
            fullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
            fullscreenButton.title = 'Fullscreen';
        }
        
        // Resize canvas to fit new container size
        setTimeout(resizeCanvas, 100);
    }
    
    function showKeyboardFeedback(key) {
        if (!state.showFeedback) return;
        
        // Display visual feedback for keyboard input
        keyboardText.textContent = key;
        keyboardIndicator.style.opacity = 1;
        
        // Hide after a short delay
        setTimeout(() => {
            keyboardIndicator.style.opacity = 0;
        }, 800);
    }
    
    function showCursorFeedback(x, y) {
        if (!state.showFeedback) return;
        
        // Show cursor dot at position
        cursorIndicator.style.left = `${x}px`;
        cursorIndicator.style.top = `${y}px`;
        cursorIndicator.style.opacity = 1;
        
        // Hide after a short delay
        setTimeout(() => {
            cursorIndicator.style.opacity = 0;
        }, 200);
    }
    
    function showClickFeedback(x, y) {
        if (!state.showFeedback) return;
        
        // Create ripple effect
        createRipple(x, y, interactionLayer);
    }
    
    // =================
    // Event Handlers
    // =================
    
    // ---- Navigation Controls ----
    goButton.addEventListener('click', () => {
        let url = urlInput.value.trim();
        if (url) {
            // Add https:// if not present
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = `https://${url}`;
            }
            
            loadingOverlay.style.display = 'flex';
            loadingOverlay.querySelector('p').textContent = 'Loading page...';
            
            socket.emit('navigate', { url }, (response) => {
                if (response.success) {
                    if (response.currentUrl) {
                        currentUrl.textContent = response.currentUrl;
                        urlInput.value = response.currentUrl.replace(/^https?:\/\//, '');
                    }
                } else {
                    console.error('Navigation failed:', response.error);
                    showNotification('Navigation failed');
                }
                loadingOverlay.style.display = 'none';
            });
        }
    });
    
    // Allow using Enter key in URL input
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            goButton.click();
        }
    });
    
    backButton.addEventListener('click', () => {
        socket.emit('action', { 
            action: 'goBack', 
            params: {} 
        }, (response) => {
            if (response.success) {
                updateCurrentUrl();
            } else {
                console.error('Navigation failed:', response.error);
            }
        });
    });
    
    forwardButton.addEventListener('click', () => {
        socket.emit('action', { 
            action: 'goForward', 
            params: {} 
        }, (response) => {
            if (response.success) {
                updateCurrentUrl();
            } else {
                console.error('Navigation failed:', response.error);
            }
        });
    });
    
    refreshButton.addEventListener('click', () => {
        socket.emit('action', { 
            action: 'reload', 
            params: {} 
        }, (response) => {
            if (response.success) {
                updateCurrentUrl();
            } else {
                console.error('Reload failed:', response.error);
            }
        });
    });
    
    // ---- Canvas Mouse Interaction ----
    function setupMouseInteractions() {
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('click', handleClick);
        canvas.addEventListener('dblclick', handleDoubleClick);
        canvas.addEventListener('contextmenu', handleContextMenu);
        canvas.addEventListener('wheel', handleWheel);
        
        // Focus handling for keyboard input
        canvas.addEventListener('mouseenter', () => {
            state.focusOnCanvas = true;
            canvas.focus();
        });
        
        canvas.addEventListener('mouseleave', () => {
            state.focusOnCanvas = false;
        });
    }
    
    function handleMouseDown(e) {
        if (!state.isConnected || !state.mouseActive) return;
        e.preventDefault();
        
        state.isMouseDown = true;
        const pos = getRelativePosition(e);
        
        // Start selection tracking for drag operations
        state.selectionStart = {
            x: pos.canvasX,
            y: pos.canvasY
        };
        
        // Show visual feedback
        showCursorFeedback(pos.canvasX, pos.canvasY);
        
        // Send mouse down event to browser
        socket.emit('action', { 
            action: 'mouseDown', 
            params: { 
                x: pos.x, 
                y: pos.y,
                button: e.button === 2 ? 'right' : 'left'
            } 
        });
        
        // Also send mouse position
        socket.emit('action', { 
            action: 'mouseMove', 
            params: { x: pos.x, y: pos.y } 
        });
    }
    
    function handleMouseUp(e) {
        if (!state.isConnected || !state.mouseActive) return;
        e.preventDefault();
        
        state.isMouseDown = false;
        const pos = getRelativePosition(e);
        
        // End selection if active
        if (state.selectionActive) {
            state.selectionActive = false;
            selectionBox.style.display = 'none';
        }
        
        // Show visual feedback
        showCursorFeedback(pos.canvasX, pos.canvasY);
        
        // Send mouse up event to browser
        socket.emit('action', { 
            action: 'mouseUp', 
            params: { 
                button: e.button === 2 ? 'right' : 'left'
            } 
        });
        
        // Send position
        socket.emit('action', { 
            action: 'mouseMove', 
            params: { x: pos.x, y: pos.y } 
        });
    }
    
    function handleMouseMove(e) {
        if (!state.isConnected || !state.mouseActive) return;
        
        const pos = getRelativePosition(e);
        
        // Show visual feedback for cursor position
        if (state.showFeedback) {
            cursorIndicator.style.left = `${pos.canvasX}px`;
            cursorIndicator.style.top = `${pos.canvasY}px`;
            cursorIndicator.style.opacity = 0.5;
        }
        
        // Handle selection box for drag operations
        if (state.isMouseDown && state.selectionStart) {
            state.selectionActive = true;
            
            // Calculate selection box dimensions
            const left = Math.min(state.selectionStart.x, pos.canvasX);
            const top = Math.min(state.selectionStart.y, pos.canvasY);
            const width = Math.abs(pos.canvasX - state.selectionStart.x);
            const height = Math.abs(pos.canvasY - state.selectionStart.y);
            
            // Only show if selecting more than a few pixels
            if (width > 5 || height > 5) {
                selectionBox.style.display = 'block';
                selectionBox.style.left = `${left}px`;
                selectionBox.style.top = `${top}px`;
                selectionBox.style.width = `${width}px`;
                selectionBox.style.height = `${height}px`;
            }
        }
        
        // Send mouse move event to browser if dragging
        if (state.isMouseDown) {
            socket.emit('action', { 
                action: 'mouseMove', 
                params: { x: pos.x, y: pos.y } 
            });
        }
    }
    
    function handleClick(e) {
        if (!state.isConnected || !state.mouseActive) return;
        e.preventDefault();
        
        const pos = getRelativePosition(e);
        
        // Show visual feedback
        showClickFeedback(pos.canvasX, pos.canvasY);
        
        // We don't need to send a separate click event as it's handled by mouseDown + mouseUp
        // But we can track click time for double-click detection
        const now = performance.now();
        state.lastClickTime = now;
    }
    
    function handleDoubleClick(e) {
        if (!state.isConnected || !state.mouseActive) return;
        e.preventDefault();
        
        const pos = getRelativePosition(e);
        
        // Show visual feedback
        showClickFeedback(pos.canvasX, pos.canvasY);
        
        // Send double click event to browser
        socket.emit('action', { 
            action: 'doubleClick', 
            params: { x: pos.x, y: pos.y } 
        });
    }
    
    function handleContextMenu(e) {
        if (!state.isConnected || !state.mouseActive) return;
        e.preventDefault(); // Prevent browser's context menu
        
        const pos = getRelativePosition(e);
        
        // Visual feedback
        showCursorFeedback(pos.canvasX, pos.canvasY);
        
        // Send right click events to browser
        socket.emit('action', { 
            action: 'mouseDown', 
            params: { 
                x: pos.x, 
                y: pos.y,
                button: 'right'
            } 
        });
        
        socket.emit('action', { 
            action: 'mouseUp', 
            params: { 
                button: 'right'
            } 
        });
    }
    
    function handleWheel(e) {
        if (!state.isConnected || !state.mouseActive) return;
        e.preventDefault();
        
        const deltaY = e.deltaY;
        const deltaX = e.deltaX;
        
        // Send scroll event to browser
        socket.emit('action', { 
            action: 'scrollBy', 
            params: { 
                x: deltaX, 
                y: deltaY 
            } 
        });
    }
    
    // ---- Canvas Touch Interactions ----
    function setupTouchInteractions() {
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
    
    function handleTouchStart(e) {
        if (!state.isConnected || !state.mouseActive) return;
        e.preventDefault();
        
        if (e.touches.length === 1) {
            // Single touch = left click
            state.isMouseDown = true;
            const pos = getRelativePosition(e);
            
            // Start selection tracking
            state.selectionStart = {
                x: pos.canvasX,
                y: pos.canvasY
            };
            
            // Show visual feedback
            showCursorFeedback(pos.canvasX, pos.canvasY);
            
            // Send mouse down event to browser
            socket.emit('action', { 
                action: 'mouseDown', 
                params: { x: pos.x, y: pos.y } 
            });
            
            // Also send position
            socket.emit('action', { 
                action: 'mouseMove', 
                params: { x: pos.x, y: pos.y } 
            });
        } else if (e.touches.length === 2) {
            // Two-finger touch = right click
            const pos = getRelativePosition(e);
            
            // Show visual feedback
            showCursorFeedback(pos.canvasX, pos.canvasY);
            
            // Send right click events
            socket.emit('action', { 
                action: 'mouseDown', 
                params: { 
                    x: pos.x, 
                    y: pos.y,
                    button: 'right'
                } 
            });
            
            socket.emit('action', { 
                action: 'mouseUp', 
                params: { 
                    button: 'right'
                } 
            });
        }
    }
    
    function handleTouchEnd(e) {
        if (!state.isConnected || !state.mouseActive) return;
        e.preventDefault();
        
        state.isMouseDown = false;
        
        // End selection if active
        if (state.selectionActive) {
            state.selectionActive = false;
            selectionBox.style.display = 'none';
        }
        
        // Get last touch position if available
        let pos;
        if (e.changedTouches.length > 0) {
            pos = getRelativePosition({
                type: 'touch',
                touches: [e.changedTouches[0]]
            });
            
            // Show visual feedback
            showClickFeedback(pos.canvasX, pos.canvasY);
        }
        
        // Send mouse up event to browser
        socket.emit('action', { 
            action: 'mouseUp', 
            params: {} 
        });
        
        // Send position if available
        if (pos) {
            socket.emit('action', { 
                action: 'mouseMove', 
                params: { x: pos.x, y: pos.y } 
            });
        }
        
        // Handle tap as click
        const now = performance.now();
        if (now - state.lastClickTime < 300) {
            // Double tap/click
            if (pos) {
                socket.emit('action', { 
                    action: 'doubleClick', 
                    params: { x: pos.x, y: pos.y } 
                });
            }
        } else {
            // Single tap (already handled by mouseDown + mouseUp)
            state.lastClickTime = now;
        }
    }
    
    function handleTouchMove(e) {
        if (!state.isConnected || !state.mouseActive) return;
        e.preventDefault();
        
        if (e.touches.length === 1 && state.isMouseDown) {
            const pos = getRelativePosition(e);
            
            // Handle selection box for drag operations
            if (state.selectionStart) {
                state.selectionActive = true;
                
                // Calculate selection box dimensions
                const left = Math.min(state.selectionStart.x, pos.canvasX);
                const top = Math.min(state.selectionStart.y, pos.canvasY);
                const width = Math.abs(pos.canvasX - state.selectionStart.x);
                const height = Math.abs(pos.canvasY - state.selectionStart.y);
                
                // Only show if selecting more than a few pixels
                if (width > 10 || height > 10) {
                    selectionBox.style.display = 'block';
                    selectionBox.style.left = `${left}px`;
                    selectionBox.style.top = `${top}px`;
                    selectionBox.style.width = `${width}px`;
                    selectionBox.style.height = `${height}px`;
                }
            }
            
            // Show visual feedback
            cursorIndicator.style.left = `${pos.canvasX}px`;
            cursorIndicator.style.top = `${pos.canvasY}px`;
            cursorIndicator.style.opacity = 0.5;
            
            // Send mouse move event to browser
            socket.emit('action', { 
                action: 'mouseMove', 
                params: { x: pos.x, y: pos.y } 
            });
        }
    }
    
    // ---- Keyboard Handling ----
    function setupKeyboardHandling() {
        // Make canvas focusable
        canvas.tabIndex = 1;
        
        canvas.addEventListener('keydown', handleKeyDown);
        canvas.addEventListener('keyup', handleKeyUp);
        
        // Special keys buttons
        keyButtons.forEach(button => {
            button.addEventListener('click', () => {
                const key = button.getAttribute('data-key');
                if (key && state.isConnected && state.keyboardActive) {
                    socket.emit('action', { 
                        action: 'key', 
                        params: { key } 
                    });
                    
                    showKeyboardFeedback(key);
                }
            });
        });
    }
    
    function handleKeyDown(e) {
        if (!state.isConnected || !state.keyboardActive || !state.focusOnCanvas) return;
        
        // Prevent some browser shortcuts
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
            e.preventDefault();
        }
        
        // Show keyboard feedback
        showKeyboardFeedback(e.key);
        
        // Handle special keys and modifiers
        if (e.key.length > 1 || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
            // Create a key representation with modifiers
            let keyWithModifiers = '';
            if (e.ctrlKey) keyWithModifiers += 'Control+';
            if (e.altKey) keyWithModifiers += 'Alt+';
            if (e.metaKey) keyWithModifiers += 'Meta+';
            if (e.shiftKey) keyWithModifiers += 'Shift+';
            keyWithModifiers += e.key;
            
            socket.emit('action', { 
                action: 'key', 
                params: { key: keyWithModifiers } 
            });
        } else {
            // For regular character keys
            socket.emit('action', { 
                action: 'type', 
                params: { text: e.key } 
            });
        }
    }
    
    function handleKeyUp(e) {
        // Just used for focus tracking, actual key handling is done in keydown
        if (!state.isConnected || !state.keyboardActive || !state.focusOnCanvas) return;
    }
    
    // ---- Stream Settings ----
    function setupStreamSettings() {
        qualitySlider.addEventListener('input', () => {
            const value = parseInt(qualitySlider.value);
            qualityValue.textContent = value;
            config.quality = value;
            updateStreamSettings();
        });
        
        fpsSlider.addEventListener('input', () => {
            const value = parseInt(fpsSlider.value);
            fpsValue.textContent = value;
            config.fps = value;
            updateStreamSettings();
        });
        
        adaptiveBitrateCheckbox.addEventListener('change', () => {
            config.adaptiveBitrate = adaptiveBitrateCheckbox.checked;
            updateStreamSettings();
        });
    }
    
    // ---- Input Settings ----
    function setupInputSettings() {
        enableKeyboardCheckbox.addEventListener('change', () => {
            state.keyboardActive = enableKeyboardCheckbox.checked;
        });
        
        enableMouseCheckbox.addEventListener('change', () => {
            state.mouseActive = enableMouseCheckbox.checked;
        });
        
        showInteractionFeedbackCheckbox.addEventListener('change', () => {
            state.showFeedback = showInteractionFeedbackCheckbox.checked;
        });
    }
    
    // ---- Action Buttons ----
    function setupActionButtons() {
        // Restart browser
        restartButton.addEventListener('click', () => {
            loadingOverlay.style.display = 'flex';
            loadingOverlay.querySelector('p').textContent = 'Restarting browser...';
            
            initializeBrowser();
        });
        
        // Toggle streaming
        toggleStreamButton.addEventListener('click', () => {
            state.isStreaming = !state.isStreaming;
            socket.emit('stream-control', { streaming: state.isStreaming });
            
            if (state.isStreaming) {
                toggleStreamButton.innerHTML = '<i class="fas fa-pause"></i>';
                toggleStreamButton.title = 'Pause Stream';
            } else {
                toggleStreamButton.innerHTML = '<i class="fas fa-play"></i>';
                toggleStreamButton.title = 'Resume Stream';
            }
            
            showNotification(state.isStreaming ? 'Streaming resumed' : 'Streaming paused');
        });
        
        // Fullscreen mode
        fullscreenButton.addEventListener('click', toggleFullscreenMode);
        
        // Screenshot
        screenshotButton.addEventListener('click', takeScreenshot);
    }
    
    // ---- Notification ----
    function setupNotifications() {
        notificationClose.addEventListener('click', () => {
            notification.classList.remove('show');
        });
    }
    
    // ---- Mobile Controls ----
    function setupMobileControls() {
        if (state.isTouchDevice) {
            mobileControls.style.display = 'flex';
            
            mobileKeyboardToggle.addEventListener('click', () => {
                // Toggle virtual keyboard
                const input = document.createElement('input');
                input.type = 'text';
                input.style.position = 'absolute';
                input.style.top = '-100px';
                document.body.appendChild(input);
                input.focus();
                
                // Clean up after focus
                input.addEventListener('blur', () => {
                    document.body.removeChild(input);
                });
            });
            
            mobileTouchToggle.addEventListener('click', () => {
                // Toggle between touch modes (click vs scroll)
                state.touchMode = state.touchMode === 'click' ? 'scroll' : 'click';
                showNotification(`Touch mode: ${state.touchMode}`);
            });
        }
    }
    
    // =================
    // Initialize App
    // =================
    function initApp() {
        // Setup event handlers
        setupMouseInteractions();
        setupTouchInteractions();
        setupKeyboardHandling();
        setupStreamSettings();
        setupInputSettings();
        setupActionButtons();
        setupNotifications();
        setupMobileControls();
        
        // Update UI with initial values
        qualityValue.textContent = config.quality;
        fpsValue.textContent = config.fps;
        
        // Handle fullscreen events
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                document.body.classList.add('fullscreen-mode');
                fullscreenButton.innerHTML = '<i class="fas fa-compress"></i>';
                fullscreenButton.title = 'Exit Fullscreen';
            } else {
                document.body.classList.remove('fullscreen-mode');
                fullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
                fullscreenButton.title = 'Fullscreen';
            }
            setTimeout(resizeCanvas, 100);
        });
    }
    
    // Start the application
    initApp();
});
