import React, { useState } from 'react';
import { getUploadUrl, getFileUrl, getAvatarUrl } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { generateAvatar } from '../utils/avatar';
import { ApiError, UploadError, ValidationError } from '../utils/apiError.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';

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
  const [errorState, setErrorState] = useState(null);

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

    setErrorState(null);

    try {
      const isAllowedType = allowedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -1));
        }
        return file.type === type;
      });

      if (!isAllowedType) {
        throw new ValidationError(`请选择允许的文件类型: ${allowedTypes.join(', ')}`, {
          fieldErrors: [{ field: 'file', message: '文件类型不被允许' }]
        });
      }

      if (file.size > maxSize) {
        throw new ValidationError(`文件大小不能超过 ${Math.round(maxSize / 1024 / 1024)}MB`, {
          fieldErrors: [{ field: 'file', message: '文件过大' }]
        });
      }

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target.result);
        reader.readAsDataURL(file);
      }

      setUploading(true);
      const storagePath = getStoragePath(fileType);
      const timestamp = Date.now();
      const fileKey = `${storagePath}/${user.userId}/${timestamp}_${file.name}`;

      const uploadUrl = await getUploadUrl(fileKey, file.type);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      if (!uploadResponse.ok) {
        throw await UploadError.fromResponse(uploadResponse, {
          requestMethod: 'PUT',
          requestPath: uploadUrl,
          details: { fileKey, fileType }
        });
      }

      let fileUrl;
      if (fileType === 'avatar') {
        fileUrl = await getAvatarUrl(user.userId);
      } else {
        fileUrl = await getFileUrl(fileKey);
      }

      if (fileType === 'avatar') {
        const img = new Image();
        img.onload = () => onFileUpdate(fileUrl, fileKey);
        img.onerror = () => onFileUpdate(fileUrl, fileKey);
        img.src = fileUrl;
      } else {
        onFileUpdate(fileUrl, fileKey, { fileType: file.type, fileName: file.name });
      }
    } catch (error) {
      console.error(`${fileType}上传失败:`, error);
      const context = {
        message: '文件上传失败，请稍后重试。',
        details: { fileKey: file?.name, fileType: file?.type }
      };
      // 统一包装为 UploadError 或 ValidationError
      const specificError = error instanceof ValidationError ? error : UploadError.from(error, context);
      setErrorState(specificError);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const getDisplayComponent = () => {
    if (fileType === 'avatar') {
      return (
        <div className={`space-y-3 ${className}`}>
          {errorState && <ApiErrorNotice error={errorState} compact />}
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
        </div>
      );
    }

    return (
      <div className={`border-2 border-dashed border-gray-300 rounded-lg p-4 text-center ${className}`}>
        {errorState && (
          <div className="mb-3">
            <ApiErrorNotice error={errorState} compact onRetry={handleFileChange} />
          </div>
        )}
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