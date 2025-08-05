import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

const PostViewer = () => {
  const [content, setContent] = useState('');
  const { '*' : slug } = useParams();

  useEffect(() => {
    if (slug) {
      fetch(`/posts/${slug}.md`)
        .then((response) => response.text())
        .then((text) => setContent(text));
    }
  }, [slug]);

  return (
    <div className="prose lg:prose-xl mx-auto p-4">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

export default PostViewer;
