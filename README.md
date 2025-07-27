# Claude Load Balancer

A Node.js proxy server that distributes Claude API requests across multiple endpoints using round-robin load balancing.

## Features

- **Load Balancing**: Automatically distributes requests across multiple Claude API endpoints
- **Round-Robin Strategy**: Ensures even distribution of requests
- **Health Monitoring**: Built-in health check endpoint
- **Error Handling**: Comprehensive error handling with appropriate HTTP status codes
- **Request Logging**: Logs all incoming requests and routing decisions
- **CORS Support**: Enables cross-origin requests for web applications

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Access to Claude API endpoints

### Installation

1. Clone the repository:
```bash
git clone https://github.com/geminiwen/claude-loadbalancer.git
cd claude-loadbalancer
```

2. Install dependencies:
```bash
npm install
```

3. Configure endpoints:
```bash
cp config/endpoints.example.js config/endpoints.js
```

4. Edit `config/endpoints.js` with your actual Claude API endpoints:
```javascript
module.exports = [
  {
    baseURL: 'https://your-claude-endpoint-1.com/api/',
    authToken: 'your_auth_token_here_1'
  },
  {
    baseURL: 'https://your-claude-endpoint-2.com/api/',
    authToken: 'your_auth_token_here_2'
  }
  // Add more endpoints as needed
];
```

5. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Usage

### API Endpoint

Send Claude API requests to:
```
POST http://localhost:13255/v1/messages
```

The server will automatically route requests to available endpoints using round-robin distribution.

### Health Check

Check server status and endpoint configuration:
```
GET http://localhost:13255/health
```

Response example:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "endpoints": [
    {
      "index": 1,
      "baseURL": "https://endpoint1.com/api/",
      "hasToken": true
    },
    {
      "index": 2,
      "baseURL": "https://endpoint2.com/api/",
      "hasToken": true
    }
  ],
  "currentEndpoint": 1
}
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 13255)

### Endpoint Configuration

Each endpoint in `config/endpoints.js` must have:

- `baseURL`: Claude API base URL (the server will append `v1/messages` to this URL)
- `authToken`: Authentication token for the endpoint

## Error Handling

The load balancer handles various error scenarios:

- **API Errors**: Forwards the original error response from Claude API
- **Timeout Errors**: Returns 408 status with timeout error message
- **Internal Errors**: Returns 500 status for unexpected errors

## License

MIT License - see LICENSE file for details.

## Author

Gemini Wen