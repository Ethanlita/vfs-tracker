/**
 * @file MSW Server 配置
 * @description 配置 Mock Service Worker 服务器（用于 Node.js 环境的测试）
 */

import { setupServer } from 'msw/node';
import { handlers } from './msw-handlers.js';

/**
 * 创建 MSW server 实例
 * 在测试中使用此 server 拦截所有网络请求
 */
export const server = setupServer(...handlers);

// 导出便捷方法
export const { use, resetHandlers, restoreHandlers, close, listen } = server;
