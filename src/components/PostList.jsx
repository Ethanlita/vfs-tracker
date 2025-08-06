import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const PostList = () => {
  const [posts, setPosts] = useState([]);
  const [searchParams] = useSearchParams();
  const folderFilter = searchParams.get('folder');

  useEffect(() => {
    fetch('/posts.json')
      .then((response) => response.json())
      .then((data) => setPosts(data));
  }, []);

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

  const renderList = (items) => {
    return (
      <ul className="list-disc list-inside">
        {items.map(item => {
          if (item.type === 'folder') {
            return (
              <li key={item.name}>
                <Link
                  to={`/posts?folder=${folderFilter ? `${folderFilter}/${item.name}` : item.name}`}
                  className="font-bold text-pink-600 hover:text-pink-800"
                >
                  📁 {item.name}
                </Link>
                <div className="ml-4">
                  {item.children && renderList(item.children)}
                </div>
              </li>
            );
          } else {
            return (
              <li key={item.name}>
                <Link to={`/docs?doc=${item.path}`} className="text-blue-500 hover:underline">
                  📄 {item.name.replace('.md', '')}
                </Link>
              </li>
            );
          }
        })}
      </ul>
    );
  };

  const filteredContent = getFilteredContent();
  const pageTitle = folderFilter ? `文件夹: ${folderFilter}` : '所有文档';

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        {folderFilter && (
          <Link to="/posts" className="text-gray-500 hover:text-gray-700 mb-2 inline-block">
            ← 返回所有文档
          </Link>
        )}
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
      </div>

      {filteredContent.length === 0 ? (
        <p className="text-gray-500">此文件夹中没有内容。</p>
      ) : (
        renderList(filteredContent)
      )}
    </div>
  );
};

export default PostList;
