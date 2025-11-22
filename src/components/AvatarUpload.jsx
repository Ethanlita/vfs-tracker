import React from 'react';
import SecureFileUpload from './SecureFileUpload';

const AvatarUpload = ({ currentAvatar, onAvatarUpdate }) => {
  const handleAvatarUpdate = (fileUrl, fileKey) => {
    // 同时传递文件URL和文件Key，方便父组件更新显示
    onAvatarUpdate({ fileUrl, fileKey });
  };

  return (
    <SecureFileUpload
      fileType="avatar"
      currentFileUrl={currentAvatar}
      onFileUpdate={handleAvatarUpdate}
      allowedTypes={['image/*']}
      maxSize={5 * 1024 * 1024} // 5MB
    />
  );
};

export default AvatarUpload;
