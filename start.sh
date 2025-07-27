#!/bin/bash

# Claude Load Balancer Service Start Script
# Suitable for both direct execution and macOS service (launchd)

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="claude-loadbalancer"
NODE_EXECUTABLE="node"
SERVER_SCRIPT="server.js"
PID_FILE="$SCRIPT_DIR/logs/$SERVICE_NAME.pid"
LOG_DIR="$SCRIPT_DIR/logs"
ACCESS_LOG="$LOG_DIR/access.log"
ERROR_LOG="$LOG_DIR/error.log"

# Default environment variables
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-13255}"
export LOG_LEVEL="${LOG_LEVEL:-info}"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Create logs directory if it doesn't exist
create_log_dir() {
    if [ ! -d "$LOG_DIR" ]; then
        mkdir -p "$LOG_DIR"
        log "Created logs directory: $LOG_DIR"
    fi
}

# Check if service is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            # PID file exists but process is not running
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# Get service status
status() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        log "Service is running (PID: $pid)"
        return 0
    else
        log "Service is not running"
        return 1
    fi
}

# Start the service
start() {
    cd "$SCRIPT_DIR"
    
    if is_running; then
        local pid=$(cat "$PID_FILE")
        warn "Service is already running (PID: $pid)"
        return 0
    fi
    
    create_log_dir
    
    log "Starting $SERVICE_NAME..."
    log "Working directory: $SCRIPT_DIR"
    log "Environment: NODE_ENV=$NODE_ENV, PORT=$PORT, LOG_LEVEL=$LOG_LEVEL"
    
    # Check if config file exists
    local config_file="$SCRIPT_DIR/config/endpoints.js"
    if [ ! -f "$config_file" ]; then
        error "Configuration file not found: $config_file"
        error "Please copy config/endpoints.example.js to config/endpoints.js and configure it"
        exit 1
    fi
    
    # Start the Node.js application
    if command -v "$NODE_EXECUTABLE" >/dev/null 2>&1; then
        # Parse additional arguments for config file
        local config_args=""
        shift # Remove --service or start argument
        while [[ $# -gt 0 ]]; do
            case $1 in
                -c)
                    config_args="-c $2"
                    shift 2
                    ;;
                *)
                    shift
                    ;;
            esac
        done
        
        # For service mode (launchd), redirect to logs
        if [ -n "$LAUNCHD_SOCKET" ] || [ "$1" = "--service" ]; then
            exec "$NODE_EXECUTABLE" "$SERVER_SCRIPT" $config_args >> "$ACCESS_LOG" 2>> "$ERROR_LOG"
        else
            # For interactive mode, show output and save PID
            "$NODE_EXECUTABLE" "$SERVER_SCRIPT" $config_args &
            local pid=$!
            echo "$pid" > "$PID_FILE"
            log "Service started (PID: $pid)"
            log "Logs: $ACCESS_LOG, $ERROR_LOG"
            log "Use 'npm run stop' to stop the service"
        fi
    else
        error "Node.js not found. Please ensure Node.js is installed and in PATH"
        exit 1
    fi
}

# Stop the service
stop() {
    if ! is_running; then
        log "Service is not running"
        return 0
    fi
    
    local pid=$(cat "$PID_FILE")
    log "Stopping $SERVICE_NAME (PID: $pid)..."
    
    # Try graceful shutdown first
    if kill -TERM "$pid" 2>/dev/null; then
        # Wait up to 10 seconds for graceful shutdown
        for i in {1..10}; do
            if ! ps -p "$pid" > /dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        
        # Force kill if still running
        if ps -p "$pid" > /dev/null 2>&1; then
            warn "Graceful shutdown failed, force killing..."
            kill -KILL "$pid" 2>/dev/null || true
        fi
    fi
    
    rm -f "$PID_FILE"
    log "Service stopped"
}

# Restart the service
restart() {
    log "Restarting $SERVICE_NAME..."
    stop
    sleep 2
    start "$@"
}

# Show help
show_help() {
    echo "Usage: $0 {start|stop|restart|status|--service}"
    echo ""
    echo "Commands:"
    echo "  start     Start the service"
    echo "  stop      Stop the service"
    echo "  restart   Restart the service"
    echo "  status    Show service status"
    echo "  --service Run in service mode (for launchd)"
    echo ""
    echo "Environment Variables:"
    echo "  NODE_ENV   Node.js environment (default: production)"
    echo "  PORT       Server port (default: 3000)"
    echo "  LOG_LEVEL  Logging level (default: info)"
}

# Handle signals for graceful shutdown
trap 'stop; exit 0' SIGTERM SIGINT

# Main script logic
case "${1:-start}" in
    start)
        start "$@"
        ;;
    stop)
        stop
        ;;
    restart)
        restart "$@"
        ;;
    status)
        status
        ;;
    --service)
        # Service mode for launchd
        start --service
        ;;
    --help|-h)
        show_help
        ;;
    *)
        error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac