import React, { useState, useRef } from 'react';
import { getUploadUrl, getFileUrl, getAvatarUrl } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { generateAvatar } from '../utils/avatar';
import { ApiError, UploadError, ValidationError } from '../utils/apiError.js';
import { assertAttachmentUrl } from '../utils/attachments.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import { usePwaUpdateBlocker } from '../hooks/usePwaUpdateBlocker.js';

const SecureFileUpload = ({
  fileType = 'avatar', // 'avatar', 'attachment', 'upload'
  currentFileUrl,
  onFileUpdate,
  onStatusChange,
  disabled = false,
  allowedTypes = ['image/*'],
  maxSize = 5 * 1024 * 1024, // 5MB
  className = ''
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const pickerRef = useRef(null);
  const lastFileRef = useRef(null);
  const uploadPending = useRef(false);
  const uploadedFileRef = useRef(null);
  const [errorState, setErrorState] = useState(null);

  // 上传中及保留文件等待重试时，PWA 更新不能中断这份仅在内存中的文件。
  usePwaUpdateBlocker(uploading || errorState !== null, fileType === 'avatar' ? '头像上传' : '文件上传');

  const getStoragePath = (type) => {
    const paths = {
      avatar: 'avatars',
      attachment: 'attachments',
      upload: 'uploads'
    };
    return paths[type] || 'uploads';
  };

  /** 从文件选择器保存 File，再清空原生值以允许重新选择同一个文件。 */
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || uploadPending.current || disabled) return;
    lastFileRef.current = file;
    uploadedFileRef.current = null;
    void uploadFile(file);
  };

  /** 上传明确的 File；重试复用文件，不把按钮事件当成文件选择事件。 */
  const uploadFile = async (file) => {
    if (!file || uploadPending.current || disabled) return;
    uploadPending.current = true;
    // 将地址申请、PUT 和访问地址读取都视为同一次尚未完成的附件操作。
    onStatusChange?.('uploading');
    setUploading(true);

    setErrorState(null);
    let phase = 'upload';

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

      if (fileType === 'avatar') {
        // 先读取并解码图片，不能把MIME正确但内容损坏的文件保存为头像。
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          const fail = () => reject(new ValidationError('无法读取此图片，请选择有效的图片文件。'));
          reader.onerror = fail;
          reader.onload = () => {
            const image = new Image();
            image.onload = resolve;
            image.onerror = fail;
            image.src = reader.result;
          };
          reader.readAsDataURL(file);
        });
      }

      setUploading(true);
      // 已成功PUT的文件保留对象标识，链接失败后的重试不再次上传。
      let fileKey = uploadedFileRef.current?.file === file ? uploadedFileRef.current.fileKey : null;
      if (!fileKey) {
        const storagePath = getStoragePath(fileType);
        const timestamp = Date.now();

        if (fileType === 'avatar') {
          const extension = (() => {
            const dotIndex = file.name.lastIndexOf('.');
            if (dotIndex === -1) return '';
            return file.name.slice(dotIndex).toLowerCase();
          })();
          const baseName = `${timestamp}-${user.userId}`;
          fileKey = `${storagePath}/${user.userId}/${baseName}${extension}`;
        } else {
          fileKey = `${storagePath}/${user.userId}/${timestamp}_${file.name}`;
        }

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

        uploadedFileRef.current = { file, fileKey };
      }
      phase = 'link';

      let fileUrl;
      if (fileType === 'avatar') {
        // 传递 fileKey 以获取新上传文件的 URL，而不是默认路径
        fileUrl = await getAvatarUrl(user.userId, fileKey);
      } else {
        fileUrl = await getFileUrl(fileKey);
      }

      assertAttachmentUrl(fileUrl);
      phase = 'complete';
      // 等待父组件完成资料持久化，失败时继续保留旧头像及可重试的上传结果。
      if (fileType === 'avatar') await onFileUpdate(fileUrl, fileKey);
      else await onFileUpdate(fileUrl, fileKey, { fileType: file.type, fileName: file.name });
      onStatusChange?.('idle');
    } catch (error) {

      const context = {
        message: phase === 'link' ? '文件已上传，但访问地址获取失败。请重试链接，无需重新上传。' : phase === 'complete' ? '文件已上传，但资料保存失败。请重试保存。' : '文件上传失败，请稍后重试。',
        details: { fileKey: file?.name, fileType: file?.type }
      };
      // 统一包装为 UploadError 或 ValidationError
      const specificError = error instanceof ValidationError ? error : UploadError.from(error, context);
      setErrorState(specificError);
      onStatusChange?.('error');
    } finally {
      uploadPending.current = false;
      setUploading(false);
    }
  };

  const getDisplayComponent = () => {
    if (fileType === 'avatar') {
      return (
        <div className={`space-y-3 ${className}`}>
          {errorState && <ApiErrorNotice error={errorState} compact onRetry={() => uploadFile(lastFileRef.current)} />}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                <img
                  src={currentFileUrl || generateAvatar(user?.username || user?.email || 'User', 64)}
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
                <button type="button" ref={pickerRef} aria-disabled={uploading || disabled} onClick={() => { if (!uploadPending.current && !disabled) inputRef.current?.click(); }} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer bg-blue-600 text-white text-xs px-3 py-1 rounded-md hover:bg-blue-700 transition-colors">
                  {uploading ? '上传中...' : '更换头像'}
                </button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={allowedTypes.join(',')}
                    onChange={handleFileChange}
                    disabled={uploading || disabled}
                    className="hidden"
                  />
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
            <ApiErrorNotice error={errorState} compact onRetry={() => uploadFile(lastFileRef.current)} />
            <button type="button" disabled={disabled || uploading} className="mt-2 text-sm text-gray-600 underline disabled:opacity-50"
              onClick={() => { lastFileRef.current = null; uploadedFileRef.current = null; setErrorState(null); onStatusChange?.('idle'); }}>
              放弃此附件
            </button>
          </div>
        )}
        {currentFileUrl && (
          <div className="mb-3 p-2 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">当前文件已上传</p>
          </div>
        )}
        <button type="button" ref={pickerRef} aria-disabled={uploading || disabled} onClick={() => { if (!uploadPending.current && !disabled) inputRef.current?.click(); }} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors inline-block">
          {uploading ? '上传中...' : '选择文件'}
        </button>
          <input
            ref={inputRef}
                    type="file"
            accept={allowedTypes.join(',')}
            onChange={handleFileChange}
            disabled={uploading || disabled}
            className="hidden"
          />
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
