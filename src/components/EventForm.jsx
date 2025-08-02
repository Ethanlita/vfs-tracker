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
      alert('You must be logged in to add an event.');
      return;
    }
    if (eventType === 'hospital_test' && !file) {
      alert('Hospital tests require a report file to be uploaded.');
      return;
    }
    setIsSubmitting(true);

    let attachmentKey = null;
    // @en If a file is selected, upload it to S3.
    // @zh 如果选择了文件，则将其上传到 S3。
    if (file) {
      try {
        attachmentKey = await uploadFile(file, user.attributes.sub);
      } catch (error) {
        alert('File upload failed. Please try again.');
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
      alert('Event added successfully!');
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
      alert('Failed to add event. See console for details.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER ---
  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-900">Add New Event</h3>
        <div>
          <label htmlFor="event-type" className="block text-sm font-medium text-gray-700">Event Type</label>
          <select
            id="event-type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="hospital_test">Hospital Test</option>
            <option value="self_test">Self Test</option>
            <option value="training">Training</option>
            <option value="surgery">Surgery</option>
          </select>
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label htmlFor="file-input" className="block text-sm font-medium text-gray-700">Attachment</label>
          <input
            id="file-input"
            type="file"
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
          />
          <p className="mt-1 text-xs text-gray-500">Required for Hospital Tests.</p>
        </div>
        <div className="text-right">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Event'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EventForm;
