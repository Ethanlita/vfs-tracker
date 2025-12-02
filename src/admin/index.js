/**
 * @file 管理后台模块导出
 * 统一导出管理后台相关组件和工具
 */

// 主应用
export { default as AdminApp } from './AdminApp';

// 上下文
export { AWSClientProvider, useAWSClients } from './contexts/AWSClientContext';

// 工具函数
export * from './utils/credentialStorage';

// 服务
export * from './services/dynamodb';
export * from './services/s3';

// 组件
export { default as AdminLogin } from './components/AdminLogin';
export { default as AdminLayout } from './components/AdminLayout';
export { default as AdminDashboard } from './components/AdminDashboard';
export { default as UserListPage } from './components/UserListPage';
export { default as UserTable } from './components/UserTable';
export { default as UserDetailDrawer } from './components/UserDetailDrawer';
export { default as EventListPage } from './components/EventListPage';
export { default as EventTable } from './components/EventTable';
export { default as EventDetailModal } from './components/EventDetailModal';
export { default as TestListPage } from './components/TestListPage';
export { default as TestTable } from './components/TestTable';
export { default as TestDetailModal } from './components/TestDetailModal';
