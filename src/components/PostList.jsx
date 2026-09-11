import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAsync } from '../utils/useAsync.js';
import { readDocumentation } from '../utils/documentation';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const PostList = () => {
  // 设置页面 meta 标签
  useDocumentMeta({
    title: '文档中心',
    description: '浏览 VFS Tracker 的使用指南、嗓音测试报告解读、基频参数说明等文档。'
  });

  const [posts, setPosts] = useState([]);
  const [searchParams] = useSearchParams();
  const folderFilter = searchParams.get('folder');

  // 使用 useAsync 统一数据获取
  const postsAsync = useAsync(async () => {
    return readDocumentation('/posts.json', 'json');
  }, []);

  useEffect(() => { if (postsAsync.value) setPosts(postsAsync.value); }, [postsAsync.value]);

  // 根据文件夹路径过滤内容
  const getFilteredContent = () => {
    if (!folderFilter) {
      return posts; // 如果没有过滤参数，显示所有内容
    }

    // 根据文件夹路径查找对应的内容
    const findFolderContent = (items, targetPath) => {
      const pathParts = targetPath.split('/');
      let current = items;

      for (const part of pathParts) {
        const folder = current.find(item => item.type === 'folder' && item.name === part);
        if (folder && folder.children) {
          current = folder.children;
        } else {
          return []; // 如果路径不存在，返回空数组
        }
      }
      return current;
    };

    return findFolderContent(posts, folderFilter);
  };

  const filteredContent = getFilteredContent();
  const pageTitle = folderFilter ? `文件夹: ${folderFilter}` : '所有文档';

  const renderCards = (items) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            if (item.type === 'folder') {
              const target = `/posts?folder=${folderFilter ? `${folderFilter}/${item.name}` : item.name}`;
              return (
                  <Link
                      key={`folder-${item.name}`}
                      to={target}
                      className="group block rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-gray-200 shadow-sm p-5 hover:shadow-md hover:ring-gray-300 transition"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-700 ring-1 ring-pink-100">
                        <span className="text-xl">📁</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 truncate group-hover:text-pink-700 transition-colors">
                          {item.name}
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">文件夹</p>
                      </div>
                    </div>
                  </Link>
              );
            }

            // 文件卡片
            const fileDisplayName = item.name.replace('.md', '');
            return (
                <Link
                    key={`file-${item.path || item.name}`}
                    to={`/docs?doc=${item.path}`}
                    className="group block rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-gray-200 shadow-sm p-5 hover:shadow-md hover:ring-gray-300 transition"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                      <span className="text-xl">📄</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                        {fileDisplayName}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">文档</p>
                    </div>
                  </div>
                </Link>
            );
          })}
        </div>
    );
  };

  return (
      <div className="container mx-auto p-4">
        {/* 错误与加载状态 */}
        {postsAsync.error && (
          <div className="mb-4">
            <ApiErrorNotice error={postsAsync.error} onRetry={postsAsync.execute} />
          </div>
        )}
        {postsAsync.loading && (
          <div className="mb-4 p-3 rounded-md bg-gray-50 border border-gray-200 text-gray-600 text-sm">正在加载文档列表...</div>
        )}
        <div className="mb-6">
          {folderFilter && (
              <Link
                  to="/posts"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
              >
                ← 返回所有文档
              </Link>
          )}
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{pageTitle}</h1>
          <p className="mt-1 text-sm text-gray-500">点击卡片以浏览下一级文件夹或打开文档。</p>
        </div>

        {(!postsAsync.loading && !postsAsync.error && filteredContent.length === 0) ? (
            <div className="rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-gray-200 shadow-sm p-6 text-gray-500">
              此文件夹中没有内容。
            </div>
        ) : (!postsAsync.loading && !postsAsync.error) ? (
            renderCards(filteredContent)
        ) : null}
      </div>
  );
};

export default PostList;
