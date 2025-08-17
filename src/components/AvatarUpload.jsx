import React from 'react';
import SecureFileUpload from './SecureFileUpload';

const AvatarUpload = ({ currentAvatar, onAvatarUpdate }) => {
  const handleAvatarUpdate = (fileUrl, fileKey) => {
    // 传递文件URL给父组件
    onAvatarUpdate(fileUrl);
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
