const express = require('express');
const axios = require('axios');
const cors = require('cors');
const apiEndpoints = require('./config/endpoints');

const app = express();
const PORT = process.env.PORT || 3000;

let currentEndpointIndex = 0;

function getNextEndpoint() {
  const endpoint = apiEndpoints[currentEndpointIndex];
  currentEndpointIndex = (currentEndpointIndex + 1) % apiEndpoints.length;
  return endpoint;
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.post('/v1/messages', async (req, res) => {
  try {
    const endpoint = getNextEndpoint();
    
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': endpoint.authToken,
      'anthropic-version': req.headers['anthropic-version'] || '2023-06-01'
    };

    console.log(`Proxying request to ${endpoint.baseURL} (endpoint ${(currentEndpointIndex === 0 ? apiEndpoints.length : currentEndpointIndex)}/${apiEndpoints.length})`);
    
    const response = await axios.post(
      `${endpoint.baseURL}/v1/messages`,
      req.body,
      { 
        headers,
        timeout: 60000
      }
    );

    res.status(response.status).json(response.data);
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.code === 'ECONNABORTED') {
      res.status(408).json({
        error: {
          type: 'timeout_error',
          message: 'Request timeout'
        }
      });
    } else {
      res.status(500).json({
        error: {
          type: 'internal_error',
          message: 'Internal server error'
        }
      });
    }
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    endpoints: apiEndpoints.map((endpoint, index) => ({
      index: index + 1,
      baseURL: endpoint.baseURL,
      hasToken: !!endpoint.authToken
    })),
    currentEndpoint: currentEndpointIndex + 1
  });
});

app.listen(PORT, () => {
  console.log(`Claude API proxy server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoint: http://localhost:${PORT}/v1/messages`);
});