# Interactive Web-Based Headless Browser with High-FPS Streaming

A real-time interactive headless browser that can be viewed and controlled through a web interface with high-performance streaming capabilities.

## Features

- **High-FPS Streaming**: Achieve ~30 FPS streaming of browser content
- **Interactive Interface**: Direct interaction with the streamed content (click, type, drag, scroll)
- **Multi-Browser Support**: Handle multiple browser instances simultaneously
- **Real-time Interaction**: Low-latency bidirectional communication
- **Performance Monitoring**: Built-in FPS and latency tracking
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **Backend**:
  - Node.js with Express
  - Playwright for headless browser automation
  - Socket.IO for real-time communication
  - TypeScript for type safety

- **Frontend**:
  - HTML5 Canvas for rendering
  - Socket.IO client for real-time updates
  - Responsive CSS for multi-device support

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/headless-browser-stream.git
cd headless-browser-stream
```

2. Install dependencies
```bash
npm install
```

3. Install Playwright browsers
```bash
npx playwright install chromium
```

### Development

Start the development server with:
```bash
npm run dev
```

The server will be available at http://localhost:8001

### Production

Build the application for production:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## Configuration

Configuration is handled via environment variables defined in `.env` file:

- `PORT`: Server port (default: 8001)
- `NODE_ENV`: Environment (development/production)
- `CORS_ORIGIN`: CORS origin for API requests
- `DEFAULT_URL`: Default URL to load when browser starts
- `MAX_BROWSERS`: Maximum number of concurrent browser instances
- `SCREENSHOT_QUALITY`: JPEG quality for screenshots (1-100)
- `SCREENSHOT_TYPE`: Screenshot format (jpeg/png)

## Architecture

The system consists of three main components:

1. **Browser Service**: Manages headless browsers using Playwright
2. **Socket Service**: Handles real-time communication between clients and browsers
3. **Frontend Interface**: Renders the browser content and processes user interactions

## Performance Optimization

- Using efficient image compression and encoding for streaming
- WebSocket binary data transfer for reduced overhead
- Canvas-based rendering for smooth display
- Frame rate limiting to balance performance and resource usage

## Security Considerations

- Input sanitization for all URL inputs
- Browser isolation to prevent malicious interactions
- Rate limiting for API requests
- No persistent storage of browsing data

## License

[MIT License](LICENSE)

## Acknowledgements

- [Playwright](https://playwright.dev/)
- [Socket.IO](https://socket.io/)
- [Express](https://expressjs.com/)