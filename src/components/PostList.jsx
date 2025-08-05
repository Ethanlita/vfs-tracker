import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const PostList = () => {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    fetch('/posts.json')
      .then((response) => response.json())
      .then((data) => setPosts(data));
  }, []);

  const renderList = (items) => {
    return (
      <ul className="list-disc list-inside">
        {items.map(item => {
          if (item.type === 'folder') {
            return (
              <li key={item.name}>
                <span className="font-bold">{item.name}</span>
                <div className="ml-4">
                  {renderList(item.children)}
                </div>
              </li>
            );
          } else {
            return (
              <li key={item.name}>
                <Link to={`/posts/${item.path.replace('.md', '')}`} className="text-blue-500 hover:underline">{item.name}</Link>
              </li>
            );
          }
        })}
      </ul>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">All Posts</h1>
      {renderList(posts)}
    </div>
  );
};

export default PostList;
