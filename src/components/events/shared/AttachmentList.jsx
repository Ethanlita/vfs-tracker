/**
 * 附件列表组件
 * 用于展示事件附件并提供下载功能
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { getFileUrl } from '../../../api';

/**
 * 附件项组件
 */
const AttachmentItem = ({ attachment, onDownload, isLoading }) => {
  const { fileName, fileType, fileUrl } = attachment;

  // 根据文件类型确定图标
  const getFileIcon = (type) => {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📕';
    if (type.includes('audio')) return '🎵';
    if (type.includes('video')) return '🎬';
    return '📄';
  };

  // 格式化文件类型显示
  const formatFileType = (type) => {
    if (!type) return '文件';
    if (type.startsWith('image/')) return '图片';
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('audio')) return '音频';
    if (type.includes('video')) return '视频';
    return type.split('/')[1]?.toUpperCase() || '文件';
  };

  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg flex-shrink-0">{getFileIcon(fileType)}</span>
        <div className="min-w-0">
          <p className="text-sm text-gray-700 dark:text-gray-300 truncate" title={fileName}>
            {fileName || '未命名文件'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatFileType(fileType)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDownload(fileUrl, fileName)}
        disabled={isLoading}
        className="
          flex-shrink-0 ml-2 px-3 py-1.5
          text-xs font-medium text-purple-600 dark:text-purple-400
          bg-purple-50 dark:bg-purple-900/30
          hover:bg-purple-100 dark:hover:bg-purple-900/50
          rounded-md transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        {isLoading ? '加载中...' : '下载'}
      </button>
    </div>
  );
};

AttachmentItem.propTypes = {
  attachment: PropTypes.shape({
    fileName: PropTypes.string,
    fileType: PropTypes.string,
    fileUrl: PropTypes.string,
  }).isRequired,
  onDownload: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

/**
 * 附件列表组件
 * @param {Object} props - 组件属性
 * @param {Array} props.attachments - 附件数组
 * @param {string} props.className - 额外的 CSS 类名
 */
const AttachmentList = ({ attachments, className = '' }) => {
  const [loadingUrl, setLoadingUrl] = useState(null);

  // 如果没有附件，不渲染
  if (!attachments || attachments.length === 0) {
    return null;
  }

  /**
   * 处理下载附件
   * @param {string} fileUrl - S3 对象键
   */
  const handleDownload = async (fileUrl) => {
    if (!fileUrl) return;

    setLoadingUrl(fileUrl);
    try {
      // 调用 API 获取预签名 URL
      const presignedUrl = await getFileUrl(fileUrl);

      // 在新标签页中打开（或触发下载）
      window.open(presignedUrl, '_blank');
    } catch {

      alert('获取文件链接失败，请稍后重试');
    } finally {
      setLoadingUrl(null);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">📎</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          附件 ({attachments.length})
        </span>
      </div>

      <div className="space-y-2">
        {attachments.map((attachment, index) => (
          <AttachmentItem
            key={attachment.fileUrl || `attachment-${index}`}
            attachment={attachment}
            onDownload={handleDownload}
            isLoading={loadingUrl === attachment.fileUrl}
          />
        ))}
      </div>
    </div>
  );
};

AttachmentList.propTypes = {
  attachments: PropTypes.arrayOf(
    PropTypes.shape({
      fileName: PropTypes.string,
      fileType: PropTypes.string,
      fileUrl: PropTypes.string,
    })
  ),
  className: PropTypes.string,
};

export default AttachmentList;
