/**
 * @file TanStack Query 根提供器。
 * @description 只持久化明确标记的服务器查询，并用固定 TTL 管理离线恢复数据。
 */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PROFILE_CACHE_MAX_AGE_MS } from './profileQuery.js';

export const QUERY_CACHE_STORAGE_KEY = 'vfs-tracker:server-state:v1';

/** 创建独立 QueryClient；每个应用根和测试实例不会共享内存状态。 */
export const createAppQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: PROFILE_CACHE_MAX_AGE_MS,
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

/** 浏览器拒绝存储时仅停用持久化，内存中的 Query 状态仍沿同一路径工作。 */
const browserStorage = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/** 登出时同步删除磁盘缓存，避免节流写入窗口短暂保留上一账号资料。 */
export const removePersistedServerState = () => {
  try {
    browserStorage()?.removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
      // 错误已由页面状态或恢复路径处理，不向控制台输出用户数据。
    // 浏览器拒绝存储访问时没有可清除的持久化资料。
  }
};

/** 为主应用安装查询与持久化生命周期。 */
const AppQueryProvider = ({ children }) => {
  const [{ queryClient, persister }] = useState(() => ({
    queryClient: createAppQueryClient(),
    persister: createAsyncStoragePersister({
      storage: browserStorage(),
      key: QUERY_CACHE_STORAGE_KEY,
      throttleTime: 250,
    }),
  }));

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PROFILE_CACHE_MAX_AGE_MS,
        buster: 'profile-query-v1',
        dehydrateOptions: {
          shouldDehydrateQuery: query => query.meta?.persist === true && query.state.status === 'success',
        },
      }}
      onError={() => persister.removeClient()}
    >
      {children}
    </PersistQueryClientProvider>
  );
};

AppQueryProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AppQueryProvider;
