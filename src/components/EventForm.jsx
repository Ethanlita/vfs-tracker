import React, { useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { addEvent, uploadFile } from '../api';

/**
 * @en A form for creating new voice events. It handles data input, file uploads, and submission to the backend.
 * @zh 一个用于创建新的嗓音事件的表单。它处理数据输入、文件上传和向后端提交。
 * @param {object} props - The component props.
 * @param {function(object): void} props.onEventAdded - Callback function to notify the parent component when a new event is successfully added.
 * @returns {JSX.Element} The rendered form component.
 */
const EventForm = ({ onEventAdded }) => {
  // 检查是否为生产环境
  const isProductionReady = import.meta.env.VITE_COGNITO_USER_POOL_ID &&
                           import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID &&
                           import.meta.env.VITE_AWS_REGION;

  // --- STATE MANAGEMENT ---
  const authenticatorContext = isProductionReady ? useAuthenticator((context) => [context.user]) : null;
  const user = authenticatorContext?.user || {
    attributes: {
      email: 'demo@example.com',
      sub: 'demo-user-123'
    }
  };

  const [eventType, setEventType] = useState('self_test');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- HANDLERS ---
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert('您必须登录才能添加事件。');
      return;
    }
    if (eventType === 'hospital_test' && !file) {
      alert('医院检测需要上传报告文件。');
      return;
    }
    setIsSubmitting(true);

    if (!isProductionReady) {
      setTimeout(() => {
        const mockEvent = {
          eventId: `mock-${Date.now()}`,
          type: eventType,
          notes,
          attachment: file ? `mock-attachment-${file.name}` : null,
          status: eventType === 'hospital_test' ? 'pending_approval' : 'approved',
          createdAt: new Date().toISOString(),
          userId: user.attributes.sub
        };
        alert('事件添加成功！（演示模式）');
        onEventAdded(mockEvent);
        setNotes('');
        setEventType('self_test');
        setFile(null);
        if (document.getElementById('file-input')) {
          document.getElementById('file-input').value = null;
        }
        setIsSubmitting(false);
      }, 1000);
      return;
    }

    let attachmentKey = null;
    if (file) {
      try {
        attachmentKey = await uploadFile(file, user.attributes.sub);
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        alert('文件上传失败。请重试。');
        setIsSubmitting(false);
        return;
      }
    }

    const eventData = {
      type: eventType,
      notes,
      attachment: attachmentKey,
      status: eventType === 'hospital_test' ? 'pending_approval' : 'approved',
    };

    try {
      const newEvent = await addEvent(eventData, user.attributes.sub);
      alert('事件添加成功！');
      onEventAdded(newEvent.item);
      setNotes('');
      setEventType('self_test');
      setFile(null);
      if (document.getElementById('file-input')) {
        document.getElementById('file-input').value = null;
      }
    } catch (error) {
      alert('添加事件失败。请查看控制台获取详细信息。');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER ---
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="event-type" className="block text-sm font-semibold text-gray-800 mb-1">事件类型</label>
        <select
          id="event-type"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="mt-1 block w-full rounded-lg border-gray-300 bg-gray-50 py-3 px-4 text-base text-gray-800 shadow-sm transition-all duration-300 focus:border-pink-500 focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50 focus:outline-none"
        >
          <option value="hospital_test">医院检测</option>
          <option value="self_test">自我测试</option>
          <option value="training">训练</option>
          <option value="surgery">手术</option>
        </select>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-semibold text-gray-800 mb-1">备注</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="mt-1 block w-full rounded-lg border-gray-300 bg-gray-50 py-3 px-4 text-base text-gray-800 shadow-sm transition-all duration-300 focus:border-pink-500 focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50 focus:outline-none"
          placeholder="例如：今天进行了30分钟的发声练习..."
        />
      </div>
      <div>
        <label htmlFor="file-input" className="block text-sm font-semibold text-gray-800 mb-1">附件 (可选)</label>
        <input
          id="file-input"
          type="file"
          onChange={handleFileChange}
          className="mt-1 block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-pink-100 file:text-pink-700 hover:file:bg-pink-200 transition-colors cursor-pointer"
        />
        <p className="mt-2 text-xs text-gray-500">在“医院检测”类型中，此项为必填。</p>
      </div>
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full inline-flex justify-center py-3 px-4 border border-transparent shadow-lg text-base font-medium rounded-lg text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 transition-all duration-300 ease-in-out transform hover:scale-105 disabled:scale-100"
        >
          {isSubmitting ? '添加中...' : '添加事件'}
        </button>
      </div>
    </form>
  );
};

export default EventForm;
