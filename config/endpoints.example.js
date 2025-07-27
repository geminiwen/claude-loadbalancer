/**
 * Claude Load Balancer 端点配置示例
 * 
 * 使用说明：
 * 1. 复制此文件为 endpoints.js: cp endpoints.example.js endpoints.js
 * 2. 替换下面的示例配置为你的实际 Claude API 端点
 * 3. 每个端点需要包含 baseURL 和 authToken 两个字段
 * 4. 负载均衡器会自动在这些端点之间分配请求
 * 
 * 配置格式：
 * - baseURL: Claude API 的基础 URL，必须以 /api/ 结尾
 * - authToken: 对应端点的认证令牌
 */

module.exports = [
  {
    // 第一个 Claude API 端点
    baseURL: 'https://your-claude-endpoint-1.com/api/',
    authToken: 'your_auth_token_here_1'
  },
  {
    // 第二个 Claude API 端点  
    baseURL: 'https://your-claude-endpoint-2.com/api/',
    authToken: 'your_auth_token_here_2'
  },
  // 可以添加更多端点...
  // {
  //   baseURL: 'https://your-claude-endpoint-3.com/api/',
  //   authToken: 'cr_your_auth_token_here_3'
  // }
];