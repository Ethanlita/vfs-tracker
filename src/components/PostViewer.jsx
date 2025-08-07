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

    // 只允许字母、数字、连字符、下划线、斜杠和中文字符
    const validPathPattern = /^[a-zA-Z0-9\-_\/\u4e00-\u9fa5]+\.md$/;
    return validPathPattern.test(filePath);
  };

  useEffect(() => {
    // 从URL参数获取文档路径
    const docPath = searchParams.get('doc');

    if (!docPath) {
      setContent('');
      setError('');
      return;
    }

    // 安全检查
    if (!isValidMarkdownFile(docPath)) {
      setError('无效的文档路径。只允许访问.md文件。');
      setContent('');
      return;
    }

    setLoading(true);
    setError('');

    // 构建完整的文件路径
    const fullPath = `/posts/${docPath}`;

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
      <div className="prose lg:prose-xl mx-auto p-4">
        <div className="text-center">
          <p>正在加载文档...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="prose lg:prose-xl mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-red-800 font-semibold">错误</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="prose lg:prose-xl mx-auto p-4">
        <div className="text-center text-gray-500">
          <p>请选择一个文档查看</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prose lg:prose-xl mx-auto p-4">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

export default PostViewer;
