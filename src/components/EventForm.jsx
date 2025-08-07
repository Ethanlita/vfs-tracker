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
    <form onSubmit={handleSubmit} className="form-container">
      {/* 事件类型选择 */}
      <div className="form-field">
        <label htmlFor="event-type" className="text-lg font-semibold text-gray-800">
          事件类型
        </label>
        <div className="relative">
          <select
            id="event-type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="form-input-base appearance-none cursor-pointer"
          >
            <option value="hospital_test">🏥 医院检测</option>
            <option value="self_test">🔍 自我测试</option>
            <option value="training">💪 训练</option>
            <option value="surgery">⚕️ 手术</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* 备注输入 */}
      <div className="form-field">
        <label htmlFor="notes" className="text-lg font-semibold text-gray-800">
          备注
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="form-input-base resize-none"
          placeholder="💭 例如：今天进行了30分钟的发声练习，感觉声音比昨天更稳定..."
        />
      </div>

      {/* 文件上传 */}
      <div className="form-field">
        <label htmlFor="file-input" className="text-lg font-semibold text-gray-800">
          附件 <span className="text-sm text-gray-500 font-normal">(可选)</span>
        </label>
        <input
          id="file-input"
          type="file"
          onChange={handleFileChange}
          className="form-input-base text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-base file:font-semibold file:bg-gradient-to-r file:from-pink-100 file:to-purple-100 file:text-pink-700 hover:file:from-pink-200 hover:file:to-purple-200 file:transition-all file:duration-300 file:cursor-pointer cursor-pointer"
        />
        <p className="text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          ⚠️ 在"医院检测"类型中，此项为必填。
        </p>
      </div>

      {/* 提交按钮 */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full group relative inline-flex justify-center py-3 px-6 border-0 shadow-lg text-lg font-bold rounded-xl text-white bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-700 hover:via-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl disabled:scale-100"
        >
          <span className="absolute left-0 inset-y-0 flex items-center pl-4">
            {isSubmitting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <svg className="h-5 w-5 text-white group-hover:text-pink-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
            )}
          </span>
          {isSubmitting ? '正在添加事件...' : '✨ 添加新事件'}
        </button>
      </div>
    </form>
  );
};

export default EventForm;
