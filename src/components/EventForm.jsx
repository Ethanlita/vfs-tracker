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
  // --- STATE MANAGEMENT ---
  const { user } = useAuthenticator((context) => [context.user]);
  const [eventType, setEventType] = useState('self_test');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- HANDLERS ---
  /**
   * @en Updates the state when a file is selected in the input.
   * @zh 在输入中选择文件时更新状态。
   * @param {React.ChangeEvent<HTMLInputElement>} e - The change event from the file input.
   */
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  /**
   * @en Handles the form submission process. It performs validation, uploads a file if present, and then submits the event data to the API.
   * @zh 处理表单提交流程。它执行验证，如果存在文件则上传文件，然后将事件数据提交到 API。
   * @param {React.FormEvent<HTMLFormElement>} e - The form submission event.
   */
  const handleSubmit = async (e) => {
    e.preventDefault(); // @en Prevent default form submission. @zh 阻止默认的表单提交。

    // @en Basic validation. @zh 基本验证。
    if (!user) {
      alert('您必须登录才能添加事件。');
      return;
    }
    if (eventType === 'hospital_test' && !file) {
      alert('医院检测需要上传报告文件。');
      return;
    }
    setIsSubmitting(true);

    let attachmentKey = null;
    // @en If a file is selected, upload it to S3.
    // @zh 如果选择了文件，则将其上传到 S3。
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

    // @en Prepare the event data for the API call.
    // @zh 准备 API 调用的事件数据。
    const eventData = {
      type: eventType,
      notes,
      attachment: attachmentKey,
      status: eventType === 'hospital_test' ? 'pending_approval' : 'approved',
    };

    try {
      // @en Call the API to add the event.
      // @zh 调用 API 添加事件。
      const newEvent = await addEvent(eventData, user.attributes.sub);
      alert('事件添加成功！');
      onEventAdded(newEvent.item); // @en Notify parent component to update the UI. @zh 通知父组件更新 UI。

      // @en Reset form fields to their initial state.
      // @zh 将表单字段重置为其初始状态。
      setNotes('');
      setEventType('self_test');
      setFile(null);
      // @en Also reset the file input visually.
      // @zh 同时在视觉上重置文件输入。
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
    <div className="card form-container mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-responsive-lg font-semibold text-gray-900">添加新事件</h3>
        <div>
          <label htmlFor="event-type" className="block text-responsive-sm font-medium text-gray-700">事件类型</label>
          <select
            id="event-type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="form-select mt-1 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="hospital_test">医院检测</option>
            <option value="self_test">自我测试</option>
            <option value="training">训练</option>
            <option value="surgery">手术</option>
          </select>
        </div>
        <div>
          <label htmlFor="notes" className="block text-responsive-sm font-medium text-gray-700">备注</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="form-textarea mt-1 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="file-input" className="block text-responsive-sm font-medium text-gray-700">附件</label>
          <input
            id="file-input"
            type="file"
            onChange={handleFileChange}
            className="form-input mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
          />
          <p className="mt-1 text-xs text-gray-500">医院检测时必须上传。</p>
        </div>
        <div className="text-right">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary disabled:opacity-50"
          >
            {isSubmitting ? '添加中...' : '添加事件'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EventForm;
