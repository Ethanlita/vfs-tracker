import React, { useState } from 'react';
import { getUploadUrl, getFileUrl, getAvatarUrl } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { generateAvatar } from '../utils/avatar';

const SecureFileUpload = ({
  fileType = 'avatar', // 'avatar', 'attachment', 'upload'
  currentFileUrl,
  onFileUpdate,
  allowedTypes = ['image/*'],
  maxSize = 5 * 1024 * 1024, // 5MB
  className = ''
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  // 根据文件类型确定存储路径
  const getStoragePath = (type) => {
    const paths = {
      avatar: 'avatars',
      attachment: 'attachments',
      upload: 'uploads'
    };
    return paths[type] || 'uploads';
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 验证文件类型
    const isAllowedType = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isAllowedType) {
      alert(`请选择允许的文件类型: ${allowedTypes.join(', ')}`);
      return;
    }

    // 验证文件大小
    if (file.size > maxSize) {
      alert(`文件大小不能超过${Math.round(maxSize / 1024 / 1024)}MB`);
      return;
    }

    // 为图片创建预览
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(file);
    }

    setUploading(true);
    try {
      const storagePath = getStoragePath(fileType);
      const timestamp = Date.now();
      const fileKey = `${storagePath}/${user.userId}/${timestamp}_${file.name}`;

      // 获取预签名上传URL
      const uploadUrl = await getUploadUrl(fileKey, file.type);

      if (!uploadUrl) {
        throw new Error('无法获取上传URL');
      }

      // 直接上传到S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error(`上传失败: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      console.log(`${fileType}上传成功:`, fileKey);

      // 获取文件的访问URL
      let fileUrl;

      if (fileType === 'avatar') {
        // 头像可以通过公共API获取
        fileUrl = await getAvatarUrl(user.userId);
      } else {
        // 其他文件通过预签名URL访问
        fileUrl = await getFileUrl(fileKey);
      }

      // 验证文件可访问性（仅对头像）
      if (fileType === 'avatar') {
        const img = new Image();
        img.onload = () => {
          console.log('头像URL验证成功:', fileUrl);
          onFileUpdate(fileUrl, fileKey);
        };
        img.onerror = () => {
          console.log('头像URL暂时无法访问，但文件已上传成功');
          onFileUpdate(fileUrl, fileKey);
        };
        img.src = fileUrl;
      } else {
        // 其他文件类型直接返回
        onFileUpdate(fileUrl, fileKey, { fileType: file.type, fileName: file.name });
      }

    } catch (error) {
      console.error(`${fileType}上传失败:`, error);

      if (error.message?.includes('403') || error.message?.includes('Access Denied')) {
        alert('权限不足，请联系管理员配置权限');
      } else if (error.message?.includes('Network')) {
        alert('网络错误，请检查网络连接后重试');
      } else {
        alert(`文件上传失败：${error.message}`);
      }

      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const getDisplayComponent = () => {
    if (fileType === 'avatar') {
      return (
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
              <img
                src={previewUrl || currentFileUrl || generateAvatar(user?.username || user?.email || 'User', 64)}
                alt="头像"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = generateAvatar(user?.username || user?.email || 'User', 64);
                }}
              />
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">头像</p>
            <div className="flex items-center space-x-2 mt-1">
              <label className="cursor-pointer bg-blue-600 text-white text-xs px-3 py-1 rounded-md hover:bg-blue-700 transition-colors">
                {uploading ? '上传中...' : '更换头像'}
                <input
                  type="file"
                  accept={allowedTypes.join(',')}
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-gray-500">最大{Math.round(maxSize / 1024 / 1024)}MB</span>
            </div>
          </div>
        </div>
      );
    }

    // 其他文件类型的通用显示
    return (
      <div className={`border-2 border-dashed border-gray-300 rounded-lg p-4 text-center ${className}`}>
        {currentFileUrl && (
          <div className="mb-3 p-2 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">当前文件已上传</p>
          </div>
        )}
        <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors inline-block">
          {uploading ? '上传中...' : '选择文件'}
          <input
            type="file"
            accept={allowedTypes.join(',')}
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
        <p className="text-xs text-gray-500 mt-2">
          支持: {allowedTypes.join(', ')} | 最大{Math.round(maxSize / 1024 / 1024)}MB
        </p>
        {uploading && (
          <div className="mt-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        )}
      </div>
    );
  };

  return getDisplayComponent();
};

export default SecureFileUpload;
