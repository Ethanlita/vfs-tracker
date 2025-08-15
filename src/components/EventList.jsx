import React, { useState } from 'react';
// 移除 aws-amplify/storage 的直接导入，使用统一封装
// import { getUrl } from 'aws-amplify/storage';
import { resolveAttachmentUrl } from '../utils/attachments.js';

/**
 * @en Renders a list of events in a vertical timeline format.
 * @zh 以垂直时间线格式呈现事件列表。
 * @param {object} props - The component props.
 * @param {Array<object>} props.events - An array of event objects to display.
 * @returns {JSX.Element} The rendered list of events.
 */
const EventList = ({ events }) => {
  const [downloadingKey, setDownloadingKey] = useState(null);

  // @en If there are no events, display a message.
  // @zh 如果没有事件，则显示一条消息。
  if (!events || events.length === 0) {
    return <p className="text-gray-500">未找到事件。请使用上面的表单添加一个！</p>;
  }

  /**
   * @en Handles downloading an S3 attachment. It gets a temporary, pre-signed URL from S3 and opens it in a new tab.
   * @zh 处理下载 S3 附件。它从 S3 获取一个临时的、预签名的 URL，并在新标签页中打开它。
   * @param {string} attachmentKey - The S3 key for the file to download.
   */
  const handleDownload = async (attachmentKey) => {
    try {
      setDownloadingKey(attachmentKey);
      const url = await resolveAttachmentUrl(attachmentKey, { download: true });
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error getting download URL from S3:', error);
      alert('无法获取文件的下载链接。');
    } finally {
      setDownloadingKey(k => (k === attachmentKey ? null : k));
    }
  };

  return (
      <div className="flow-root">
        <ul role="list" className="-mb-8">
          {events.map((event, eventIdx) => (
              <li key={event.eventId}>
                <div className="relative pb-8">
                  {/* @en Render a vertical line connecting timeline points, except for the last one. */}
                  {/* @zh 渲染连接时间线点的垂直线，除了最后一个。 */}
                  {eventIdx !== events.length - 1 ? (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                  ) : null}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className="h-8 w-8 rounded-full bg-pink-500 flex items-center justify-center ring-8 ring-white">
                        {/* @en TODO: This icon could be changed based on event.type */}
                        {/* @zh TODO: 这个图标可以根据 event.type 更改 */}
                        <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.59L7.3 9.24a.75.75 0 00-1.1 1.02l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                      <div>
                        <p className="text-sm text-gray-500">
                          {/* @en Display the event type in a readable format. */}
                          {/* @zh 以可读格式显示事件类型。 */}
                          {(() => {
                            const typeMap = {
                              'hospital_test': '医院检测',
                              'self_test': '自我测试',
                              'voice_training': '嗓音训练',
                              'self_practice': '自我练习',
                              'surgery': '手术',
                              'feeling_log': '感受记录'
                            };
                            return typeMap[event.type] || event.type.replace('_', ' ').toUpperCase();
                          })()}
                        </p>
                        <p className="text-sm text-gray-800 mt-1">{event.notes || '未提供备注。'}</p>
                        {/* @en If there is an attachment, show a download button. */}
                        {/* @zh 如果有附件，则显示下载按钮。 */}
                        { (event.attachment || event.details?.attachmentUrl) && (
                            <button
                                onClick={() => handleDownload(event.attachment || event.details.attachmentUrl)}
                                className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                                disabled={downloadingKey === (event.attachment || event.details.attachmentUrl)}
                            >
                              {downloadingKey === (event.attachment || event.details.attachmentUrl) ? '获取链接中...' : '下载附件'}
                            </button>
                        )}
                      </div>
                      <div className="text-right text-sm whitespace-nowrap text-gray-500">
                        {/* @en Display the creation date of the event. */}
                        {/* @zh 显示事件的创建日期。 */}
                        <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleDateString()}</time>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
          ))}
        </ul>
      </div>
  );
};

export default EventList;
