const express = require('express');
const axios = require('axios');
const cors = require('cors');
const https = require('https');
const winston = require('winston');

const apiEndpoints = require('./config/endpoints');

// Winston 日志配置
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }
      return log;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

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
  logger.debug(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.post('/v1/messages', async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9);
  const startTime = Date.now();
  let responseHandled = false;
  
  try {
    const endpoint = getNextEndpoint();
    const isStream = req.body.stream === true;
    
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': endpoint.authToken,
      'anthropic-version': req.headers['anthropic-version'] || '2023-06-01'
    };

    logger.info(`[${new Date().toISOString()}] [${requestId}] Starting ${isStream ? 'STREAM' : 'NON-STREAM'} request to ${endpoint.baseURL} (endpoint ${(currentEndpointIndex === 0 ? apiEndpoints.length : currentEndpointIndex)}/${apiEndpoints.length})`);
    
    if (isStream) {
      logger.info(`[${new Date().toISOString()}] [${requestId}] Initiating streaming request`);
      await handleStreamRequest(endpoint, req, res, headers, requestId);
      responseHandled = true;
      const duration = Date.now() - startTime;
      logger.info(`[${new Date().toISOString()}] [${requestId}] Stream request completed in ${duration}ms`);
    } else {
      logger.info(`[${new Date().toISOString()}] [${requestId}] Making non-stream API call`);
      const response = await axios.post(
        `${endpoint.baseURL}v1/messages`,
        req.body,
        { 
          headers,
          timeout: 60000
        }
      );

      const responseSize = JSON.stringify(response.data).length;
      const duration = Date.now() - startTime;
      
      logger.info(`[${new Date().toISOString()}] [${requestId}] Non-stream response received: ${response.status}, size: ${responseSize} bytes, duration: ${duration}ms`);
      
      if (!res.headersSent) {
        res.status(response.status).json(response.data);
        responseHandled = true;
        logger.info(`[${new Date().toISOString()}] [${requestId}] Non-stream request completed successfully`);
      }
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[${new Date().toISOString()}] [${requestId}] Proxy error after ${duration}ms:`, error.message);
    
    if (!responseHandled && !res.headersSent) {
      if (error.response) {
        logger.warn(`[${new Date().toISOString()}] [${requestId}] Forwarding API error: ${error.response.status}`);
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === 'ECONNABORTED') {
        logger.warn(`[${new Date().toISOString()}] [${requestId}] Request timeout after ${duration}ms`);
        res.status(408).json({
          error: {
            type: 'timeout_error',
            message: 'Request timeout'
          }
        });
      } else {
        logger.error(`[${new Date().toISOString()}] [${requestId}] Internal server error: ${error.message}`);
        res.status(500).json({
          error: {
            type: 'internal_error',
            message: 'Internal server error'
          }
        });
      }
      responseHandled = true;
    }
  }
});

// 处理流式请求
async function handleStreamRequest(endpoint, req, res, headers, requestId) {
  try {
    // 设置流式响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, anthropic-version, x-api-key'
    });

    const response = await axios({
      method: 'POST',
      url: `${endpoint.baseURL}v1/messages`,
      headers: headers,
      data: req.body,
      responseType: 'stream',
      timeout: 60000
    });

    logger.info(`[${requestId}] Stream response status: ${response.status}`);

    let bytesReceived = 0;
    let chunksReceived = 0;

    // 处理客户端断开连接
    const cleanup = () => {
      logger.debug(`[${requestId}] Cleaning up stream request`);
      if (response.data && !response.data.destroyed) {
        response.data.destroy();
      }
    };

    req.on('close', () => {
      logger.debug(`[${requestId}] Client disconnected, aborting proxy request`);
      cleanup();
    });

    res.on('close', () => {
      logger.debug(`[${requestId}] Response stream closed, aborting proxy request`);
      cleanup();
    });

    // 转发流式数据
    response.data.on('data', (chunk) => {
      bytesReceived += chunk.length;
      chunksReceived++;
      logger.debug(`[${requestId}] Writing chunk ${chunksReceived}, size: ${chunk.length} bytes`);
      res.write(chunk);
      
      if (chunksReceived % 10 === 0) {
        logger.debug(`[${requestId}] Stream progress: ${chunksReceived} chunks, ${bytesReceived} bytes received`);
      }
    });

    response.data.on('end', () => {
      logger.info(`[${requestId}] Stream completed: ${chunksReceived} total chunks, ${bytesReceived} total bytes`);
      logger.debug(`[${requestId}] Ending response stream`);
      res.end();
    });

    response.data.on('error', (error) => {
      logger.error(`[${requestId}] Proxy response error:`, error);
      if (!res.headersSent) {
        logger.debug(`[${requestId}] Writing error response headers`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
      }
      logger.debug(`[${requestId}] Writing error event to stream`);
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ 
        error: 'Proxy response error',
        message: error.message
      })}\n\n`);
      logger.debug(`[${requestId}] Ending stream after proxy response error`);
      res.end();
    });

  } catch (error) {
    logger.error(`[${requestId}] Proxy request error:`, error);
    
    if (error.response) {
      // Axios 响应错误
      logger.warn(`[${requestId}] Axios response error: ${error.response.status}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/event-stream' });
      }
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ 
        error: 'Claude API error',
        status: error.response.status,
        details: error.response.data
      })}\n\n`);
    } else {
      // 请求错误
      if (!res.headersSent) {
        logger.debug(`[${requestId}] Writing error response headers for request error`);
        res.writeHead(500, { 'Content-Type': 'text/event-stream' });
      }
      logger.debug(`[${requestId}] Writing request error event to stream`);
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ 
        error: 'Proxy request error',
        message: error.message
      })}\n\n`);
    }
    
    logger.debug(`[${requestId}] Ending stream after error`);
    res.end();
  }
}

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
  logger.info(`Claude API proxy server running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`API endpoint: http://localhost:${PORT}/v1/messages`);
});