import rehypeSlug from 'rehype-slug';
import React, { useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAsync } from '../utils/useAsync.js';
import { ClientError } from '../utils/apiError.js';
import { readDocumentation } from '../utils/documentation';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

/** 为Markdown标题保留固定导航间距，并支持锚点后的键盘阅读位置。 */
const headings = Object.fromEntries([1, 2, 3, 4, 5, 6].map(level => {
  const Tag = 'h' + level;
  return [Tag, ({ node, ...props }) => {
    void node;
    return <Tag {...props} tabIndex={-1} style={{ scrollMarginTop: '6rem' }} />;
  }];
}));

/** 宽表格在自身区域滚动，键盘用户也能访问被折叠到视口外的列。 */
const MarkdownTable = ({ node, children, ...props }) => {
  void node;
  return (
    <div role="region" aria-label="文档表格" tabIndex={0} className="max-w-full overflow-x-auto">
      <table {...props}>{children}</table>
    </div>
  );
};
const markdownComponents = { ...headings, table: MarkdownTable };

const PostViewer = () => {
  const articleRef = useRef(null);
  const { hash } = useLocation();
  const [searchParams] = useSearchParams();
  const docPath = searchParams.get('doc');
  const docTitle = docPath ? docPath.split('/').pop().replace(/\.md$/, '') : '';

  // 设置页面 meta 标签（根据文档标题动态设置）
  useDocumentMeta({
    title: docTitle || '文档',
    description: docTitle ? `阅读 VFS Tracker 文档：${docTitle}` : '浏览 VFS Tracker 的帮助文档和使用指南。'
  });

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
    return readDocumentation(fullPath);
  }, [docPath], { preserveValue: false });

  const loading = docAsync.loading;
  const error = docAsync.error;
  const content = docAsync.value || '';

  // 异步正文就绪及hash变化时定位；只允许文章内部的标题成为目标。
  useEffect(() => {
    const navigateToHeading = () => {
      if (loading || !content) return;
      let id;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!id) return;
      const target = document.getElementById(id);
      if (target && articleRef.current?.contains(target) && /^H[1-6]$/.test(target.tagName)) {
        target.scrollIntoView();
        target.focus({ preventScroll: true });
      }
    };
    navigateToHeading();
    window.addEventListener('hashchange', navigateToHeading);
    return () => window.removeEventListener('hashchange', navigateToHeading);
  }, [content, loading, hash]);

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
      <article ref={articleRef} className="rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-gray-200 shadow-sm p-6 md:p-8">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-xs text-pink-700">
            <span className="inline-flex items-center rounded-full bg-pink-50 px-2 py-1 font-medium">Markdown 文档</span>
          </div>
          {docTitle && (
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">{docTitle}</h1>
          )}
        </header>
        <div className="prose prose-slate max-w-none [overflow-wrap:anywhere] [&_pre]:[overflow-wrap:normal]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={markdownComponents}>{content}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
};

export default PostViewer;
