import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

const PostViewer = () => {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();

  // 安全检查函数 - 只允许.md文件
  const isValidMarkdownFile = (filePath) => {
    if (!filePath) return false;

    // 检查文件扩展名
    if (!filePath.endsWith('.md')) {
      return false;
    }

    // 防止路径遍历攻击
    if (filePath.includes('..') || filePath.includes('\\') || filePath.startsWith('/')) {
      return false;
    }

    // 只允许字母、数字、连字符、下划线、斜杠、空格、中文字符和中文标点
    const validPathPattern = /^[a-zA-Z0-9\-_\/\s\u4e00-\u9fa5\u3000-\u303F]+\.md$/;
    return validPathPattern.test(filePath);
  };

  const docPath = searchParams.get('doc');
  const docTitle = docPath ? docPath.split('/').pop().replace(/\.md$/, '') : '';

  useEffect(() => {
    // 从URL参数获取文档路径
    const currentDocPath = searchParams.get('doc');

    if (!currentDocPath) {
      setContent('');
      setError('');
      return;
    }

    // 安全检查
    if (!isValidMarkdownFile(currentDocPath)) {
      setError('无效的文档路径。只允许访问.md文件。');
      setContent('');
      return;
    }

    setLoading(true);
    setError('');

    // 构建完整的文件路径
    const fullPath = `/posts/${currentDocPath}`;

    fetch(fullPath)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`文档未找到: ${response.status}`);
          }
          return response.text();
        })
        .then((text) => {
          setContent(text);
          setError('');
        })
        .catch((err) => {
          setError(`加载文档失败: ${err.message}`);
          setContent('');
        })
        .finally(() => {
          setLoading(false);
        });
  }, [searchParams]); // 现在正确监听searchParams的变化

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
          <div className="rounded-2xl bg-red-50 ring-1 ring-red-200 text-red-800 shadow-sm p-6 md:p-8">
            <h3 className="text-lg font-semibold mb-2">错误</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
    );
  }

  if (!content) {
    return (
        <div className="max-w-3xl mx-auto p-4">
          <div className="rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-gray-200 shadow-sm p-6 md:p-8 text-center text-gray-500">
            <p>请选择一个文档查看</p>
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
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </article>
      </div>
  );
};

export default PostViewer;