import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAsync } from '../utils/useAsync.js';
import { ApiError, ClientError } from '../utils/apiError.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';

const PostViewer = () => {
  const [searchParams] = useSearchParams();
  const docPath = searchParams.get('doc');
  const docTitle = docPath ? docPath.split('/').pop().replace(/\.md$/, '') : '';

  // 安全检查函数 - 只允许.md文件
  const isValidMarkdownFile = (filePath) => {
    if (!filePath) return false;
    if (!filePath.endsWith('.md')) return false;
    if (filePath.includes('..') || filePath.includes('\\') || filePath.startsWith('/')) return false;
    const validPathPattern = /^[a-zA-Z0-9\-_/\s\u4e00-\u9fa5\u3000-\u303F]+\.md$/;
    return validPathPattern.test(filePath);
  };

  // 使用 useAsync 统一加载文档
  const docAsync = useAsync(async () => {
    if (!docPath) return '';
    if (!isValidMarkdownFile(docPath)) {
      throw new ClientError('无效的文档路径。只允许访问 .md 文件。', { requestPath: docPath });
    }
    const fullPath = `/posts/${docPath}`;
    const res = await fetch(fullPath);
    if (!res.ok) {
      throw await ApiError.fromResponse(res, { requestMethod: 'GET', requestPath: fullPath });
    }
    return await res.text();
  }, [docPath], { preserveValue: false });

  const loading = docAsync.loading;
  const error = docAsync.error;
  const content = docAsync.value || '';

  if (!docPath) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-gray-200 shadow-sm p-6 md:p-8 text-center text-gray-500">
          <p>请选择一个文档查看</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-gray-200 shadow-sm p-6 md:p-8">
          <div className="h-6 w-40 bg-gray-200 rounded mb-4 animate-pulse" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-10/12 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-8/12 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-gray-200 shadow-sm p-6 md:p-8 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">无法加载文档</h3>
          <ApiErrorNotice error={error} onRetry={docAsync.execute} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <article className="rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-gray-200 shadow-sm p-6 md:p-8">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-xs text-pink-700">
            <span className="inline-flex items-center rounded-full bg-pink-50 px-2 py-1 font-medium">Markdown 文档</span>
          </div>
          {docTitle && (
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">{docTitle}</h1>
          )}
        </header>
        <div className="prose prose-slate max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
};

export default PostViewer;
