# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
# Start the load balancer server
npm start

# Start with custom configuration file
node server.js -c /path/to/my/endpoints.js

# Start in development mode with file watching
npm run dev

# Start with custom config in development
node --watch server.js -c ./custom-config/endpoints.js

# Install dependencies
npm install
```

## Architecture Overview

This is a Claude API load balancer proxy server built with Express.js that distributes requests across multiple Claude API endpoints using round-robin scheduling.

### Core Components

- **server.js**: Main Express server that handles load balancing logic
- **config/endpoints.js**: Configuration file containing array of API endpoints with their baseURL and authToken
- **config/endpoints.example.js**: Template file showing the expected configuration format

### Load Balancing Strategy

The server uses a simple round-robin algorithm implemented in the `getNextEndpoint()` function. Each request to `/v1/messages` is forwarded to the next endpoint in the configured list.

### Key Endpoints

- `POST /v1/messages`: Main API endpoint that proxies Claude API requests with load balancing
- `GET /health`: Health check endpoint that shows server status and endpoint configuration

### Configuration Requirements

Before running the server, you must:
1. Copy `config/endpoints.example.js` to `config/endpoints.js`
2. Replace placeholder values with actual Claude API endpoints and authentication tokens
3. Each endpoint object requires `baseURL` (ending with `/api/`) and `authToken` fields

### Command Line Options

- `-c <path>`: Specify custom configuration file path (defaults to `./config/endpoints`)
  - Supports both relative and absolute paths
  - Example: `node server.js -c /home/user/my-endpoints.js`

### Error Handling

The proxy handles three types of errors:
- API response errors (forwards original status and response)
- Timeout errors (returns 408 with timeout_error type)
- Internal errors (returns 500 with internal_error type)

### Environment Variables

- `PORT`: Server port (defaults to 3000)
- `LOG_LEVEL`: Logging level (`debug`, `info`, `warn`, `error` - defaults to `info`)

### Logging

The server uses Winston for structured logging with configurable levels:
- `info`: Important operational information (default)
- `debug`: Detailed debugging information including chunk transfers
- `warn`: Warning messages for recoverable issues
- `error`: Error conditions

Example: `LOG_LEVEL=debug node server.js` for verbose logging.