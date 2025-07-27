# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
# Install dependencies
npm install

# Start the load balancer server
npm start

# Stop the server
npm stop

# Restart the server
npm restart

# Check server status
npm run status

# Start in development mode with file watching
npm run dev

# Start with custom configuration file
node server.js -c /path/to/my/endpoints.js

# Start with custom config in development
node --watch server.js -c ./custom-config/endpoints.js
```

## macOS Service Management

```bash
# Install as macOS service
./service.sh install

# Load and start the service
./service.sh load

# Check service status
./service.sh status

# View service logs
./service.sh logs

# Restart the service
./service.sh restart

# Stop the service
./service.sh unload

# Uninstall the service
./service.sh uninstall
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
1. Copy `config/endpoints.example.js` to `config/endpoints.js` (for local development)
2. For macOS service installation, copy the configuration to `/usr/local/etc/claude/loadbalancer.conf`
3. Replace placeholder values with actual Claude API endpoints and authentication tokens
4. Each endpoint object requires `baseURL` (ending with `/api/`) and `authToken` fields

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

- `PORT`: Server port (defaults to 13255)
- `LOG_LEVEL`: Logging level (`debug`, `info`, `warn`, `error` - defaults to `info`)

### Logging

The server uses Winston for structured logging with configurable levels:
- `info`: Important operational information (default)
- `debug`: Detailed debugging information including chunk transfers
- `warn`: Warning messages for recoverable issues
- `error`: Error conditions

Example: `LOG_LEVEL=debug node server.js` for verbose logging.

## macOS Service Setup

This load balancer can be installed as a macOS system service using launchd, which provides automatic startup, monitoring, and restart capabilities.

### Installation Steps

1. **Prepare the configuration**:
   ```bash
   sudo mkdir -p /usr/local/etc/claude
   sudo cp config/endpoints.example.js /usr/local/etc/claude/loadbalancer.conf
   sudo nano /usr/local/etc/claude/loadbalancer.conf  # Edit with your endpoints
   ```

2. **Install the service**:
   ```bash
   ./service.sh install
   ```
   This copies the plist configuration to `~/Library/LaunchAgents/`

3. **Load and start the service**:
   ```bash
   ./service.sh load
   ```
   The service will start immediately and automatically start on system boot

4. **Verify installation**:
   ```bash
   ./service.sh status
   ```

### Service Management

- **Start**: `./service.sh load` (loads and starts the service)
- **Stop**: `./service.sh unload` (stops the service)
- **Restart**: `./service.sh restart` (stops and starts the service)
- **Status**: `./service.sh status` (shows running status and logs location)
- **Logs**: `./service.sh logs` (shows recent logs)
- **Uninstall**: `./service.sh uninstall` (completely removes the service)

### Service Features

- **Automatic startup**: Service starts automatically when macOS boots
- **Process monitoring**: launchd automatically restarts the service if it crashes
- **Dedicated logging**: Service logs are written to `logs/service.out.log` and `logs/service.err.log`
- **Background operation**: Runs as a background service without terminal dependency
- **Resource limits**: Configured with appropriate process limits and throttling

### Log Files

The service creates several log files in the `logs/` directory:

- `service.out.log`: Standard output from the service
- `service.err.log`: Error output from the service
- `access.log`: Application access logs (when running via start.sh)
- `error.log`: Application error logs (when running via start.sh)
- `claude-loadbalancer.pid`: Process ID file (when running via start.sh)

### Troubleshooting

1. **Service won't start**: Check `./service.sh status` and `./service.sh logs error`
2. **Permission issues**: Ensure the script has execute permissions (`chmod +x service.sh start.sh`)
3. **Configuration errors**: Verify `config/endpoints.js` exists and is properly configured
4. **Port conflicts**: Check if port 13255 is already in use by another service