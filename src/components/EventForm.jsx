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
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 动态表单数据状态
  const [formData, setFormData] = useState({});

  // --- FORM FIELD DEFINITIONS ---
  const eventTypeOptions = [
    { value: 'self_test', label: '🔍 自我测试', emoji: '🔍' },
    { value: 'hospital_test', label: '🏥 医院检测', emoji: '🏥' },
    { value: 'voice_training', label: '💪 嗓音训练', emoji: '💪' },
    { value: 'self_practice', label: '🎯 自我练习', emoji: '🎯' },
    { value: 'surgery', label: '⚕️ 嗓音手术', emoji: '⚕️' },
    { value: 'feeling_log', label: '💭 感受记录', emoji: '💭' }
  ];

  const soundOptions = ['好', '喉咙中有痰', '其他'];
  const voicingOptions = ['夹了', '没夹', '其他'];
  const doctorOptions = ['李革临', '金亨泰', '何双八', 'Kamol', '田边正博', '自定义'];
  const locationOptions = ['友谊医院', '南京同仁医院', 'Yeson', 'Kamol', '京都耳鼻咽喉科医院', '自定义'];

  // --- HANDLERS ---
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleFormDataChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEventTypeChange = (newType) => {
    setEventType(newType);
    setFormData({}); // 清空表单数据
  };

  // --- FORM FIELD RENDERERS ---
  const renderTextInput = (field, label, required = false, placeholder = '') => (
    <div key={field} className="form-field">
      <label className="text-lg font-semibold text-gray-800">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        value={formData[field] || ''}
        onChange={(e) => handleFormDataChange(field, e.target.value)}
        placeholder={placeholder}
        className="form-input-base"
        required={required}
      />
    </div>
  );

  const renderTextArea = (field, label, required = false, placeholder = '') => (
    <div key={field} className="form-field">
      <label className="text-lg font-semibold text-gray-800">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        value={formData[field] || ''}
        onChange={(e) => handleFormDataChange(field, e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="form-input-base resize-none"
        required={required}
      />
    </div>
  );

  const renderSelect = (field, label, options, required = false) => (
    <div key={field} className="form-field">
      <label className="text-lg font-semibold text-gray-800">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={formData[field] || ''}
        onChange={(e) => handleFormDataChange(field, e.target.value)}
        className="form-input-base"
        required={required}
      >
        <option value="">请选择...</option>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );

  const renderMultiSelect = (field, label, options, required = false) => (
    <div key={field} className="form-field">
      <label className="text-lg font-semibold text-gray-800">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="space-y-2">
        {options.map(option => (
          <label key={option} className="flex items-center">
            <input
              type="checkbox"
              checked={(formData[field] || []).includes(option)}
              onChange={(e) => {
                const currentValues = formData[field] || [];
                const newValues = e.target.checked
                  ? [...currentValues, option]
                  : currentValues.filter(v => v !== option);
                handleFormDataChange(field, newValues);
              }}
              className="mr-2"
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );

  const renderNumberInput = (field, label, unit = '', required = false) => (
    <div key={field} className="form-field">
      <label className="text-lg font-semibold text-gray-800">
        {label} {unit && <span className="text-sm text-gray-500">({unit})</span>}
        {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="number"
        step="0.01"
        value={formData[field] || ''}
        onChange={(e) => handleFormDataChange(field, parseFloat(e.target.value) || '')}
        className="form-input-base"
        required={required}
      />
    </div>
  );

  const renderBooleanSelect = (field, label, required = false) => (
    <div key={field} className="form-field">
      <label className="text-lg font-semibold text-gray-800">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={formData[field] === undefined ? '' : formData[field].toString()}
        onChange={(e) => handleFormDataChange(field, e.target.value === 'true')}
        className="form-input-base"
        required={required}
      >
        <option value="">请选择...</option>
        <option value="true">是</option>
        <option value="false">否</option>
      </select>
    </div>
  );

  // --- DYNAMIC FORM FIELD GENERATOR ---
  const renderEventSpecificFields = () => {
    const fields = [];

    switch (eventType) {
      case 'self_test':
        fields.push(renderTextInput('appUsed', '使用的App', false, '例如：Voice Tools, Praat'));
        fields.push(renderMultiSelect('sound', '声音状态', soundOptions, true));
        if ((formData.sound || []).includes('其他')) {
          fields.push(renderTextInput('customSoundDetail', '其他声音状态详情', false));
        }
        fields.push(renderMultiSelect('voicing', '发声方式', voicingOptions, true));
        if ((formData.voicing || []).includes('其他')) {
          fields.push(renderTextInput('customVoicingDetail', '其他发声方式详情', false));
        }
        fields.push(renderNumberInput('fundamentalFrequency', '基频', 'Hz'));
        fields.push(renderNumberInput('jitter', 'Jitter', '%'));
        fields.push(renderNumberInput('shimmer', 'Shimmer', '%'));
        fields.push(renderNumberInput('hnr', '谐噪比', 'dB'));

        // Formants object
        fields.push(<div key="formants-header" className="form-field"><h3 className="text-lg font-semibold text-gray-800">共振峰数据</h3></div>);
        fields.push(renderNumberInput('f1', 'F1', 'Hz'));
        fields.push(renderNumberInput('f2', 'F2', 'Hz'));
        fields.push(renderNumberInput('f3', 'F3', 'Hz'));

        // Pitch range object
        fields.push(<div key="pitch-header" className="form-field"><h3 className="text-lg font-semibold text-gray-800">音域范围</h3></div>);
        fields.push(renderNumberInput('pitchMax', '最高音', 'Hz'));
        fields.push(renderNumberInput('pitchMin', '最低音', 'Hz'));

        fields.push(renderTextArea('notes', '备注'));
        break;

      case 'hospital_test':
        fields.push(renderTextInput('location', '医院/诊所名称', true));
        fields.push(renderTextInput('equipmentUsed', '使用的设备', false));
        fields.push(renderMultiSelect('sound', '声音状态', soundOptions, true));
        if ((formData.sound || []).includes('其他')) {
          fields.push(renderTextInput('customSoundDetail', '其他声音状态详情', false));
        }
        fields.push(renderMultiSelect('voicing', '发声方式', voicingOptions, true));
        if ((formData.voicing || []).includes('其他')) {
          fields.push(renderTextInput('customVoicingDetail', '其他发声方式详情', false));
        }
        fields.push(renderNumberInput('fundamentalFrequency', '基频', 'Hz'));
        fields.push(renderNumberInput('jitter', 'Jitter', '%'));
        fields.push(renderNumberInput('shimmer', 'Shimmer', '%'));
        fields.push(renderNumberInput('hnr', '谐噪比', 'dB'));

        // Formants object
        fields.push(<div key="formants-header" className="form-field"><h3 className="text-lg font-semibold text-gray-800">共振峰数据</h3></div>);
        fields.push(renderNumberInput('f1', 'F1', 'Hz'));
        fields.push(renderNumberInput('f2', 'F2', 'Hz'));
        fields.push(renderNumberInput('f3', 'F3', 'Hz'));

        // Pitch range object
        fields.push(<div key="pitch-header" className="form-field"><h3 className="text-lg font-semibold text-gray-800">音域范围</h3></div>);
        fields.push(renderNumberInput('pitchMax', '最高音', 'Hz'));
        fields.push(renderNumberInput('pitchMin', '最低音', 'Hz'));

        fields.push(renderTextArea('notes', '备注'));
        break;

      case 'voice_training':
        fields.push(renderTextArea('trainingContent', '训练内容', true, '描述本次训练的具体练习...'));
        fields.push(renderTextArea('selfPracticeContent', '自我练习内容', false, '分配的自我练习作业...'));
        fields.push(renderTextInput('voiceStatus', '嗓音状态评估', true));
        fields.push(renderTextInput('references', '参考资料', false, '参考资料链接或描述...'));
        fields.push(renderTextInput('voicing', '发声方式', true));
        fields.push(renderTextArea('feelings', '感受和反思', false));
        fields.push(renderTextInput('instructor', '指导者姓名', false));
        break;

      case 'self_practice':
        fields.push(renderTextArea('practiceContent', '练习内容', true, '描述本次练习的具体内容...'));
        fields.push(renderBooleanSelect('hasInstructor', '是否有指导', true));
        if (formData.hasInstructor) {
          fields.push(renderTextInput('instructor', '指导者姓名', false));
        }
        fields.push(renderTextInput('references', '参考资料', false));
        fields.push(renderTextInput('voiceStatus', '嗓音状态评估', true));
        fields.push(renderTextInput('voicing', '发声方式', true));
        fields.push(renderTextArea('feelings', '感受和反思', false));
        break;

      case 'surgery':
        fields.push(renderSelect('doctor', '手术医生', doctorOptions, true));
        if (formData.doctor === '自定义') {
          fields.push(renderTextInput('customDoctor', '医生姓名', true));
        }
        fields.push(renderSelect('location', '手术地点', locationOptions, true));
        if (formData.location === '自定义') {
          fields.push(renderTextInput('customLocation', '地点名称', true));
        }
        fields.push(renderTextArea('notes', '手术备注', false));
        break;

      case 'feeling_log':
        fields.push(renderTextArea('content', '感受记录', true, '记录您今天的感受...'));
        break;

      default:
        fields.push(<div key="unknown" className="text-red-500">未知的事件类型</div>);
    }

    return fields;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert('您必须登录才能添加事件。');
      return;
    }

    setIsSubmitting(true);

    try {
      // 构建符合数据结构的详细信息对象
      let details = { ...formData };

      // 处理特殊字段
      if (eventType === 'self_test' || eventType === 'hospital_test') {
        // 构建 formants 对象
        if (formData.f1 || formData.f2 || formData.f3) {
          details.formants = {};
          if (formData.f1) details.formants.f1 = formData.f1;
          if (formData.f2) details.formants.f2 = formData.f2;
          if (formData.f3) details.formants.f3 = formData.f3;
        }

        // 构建 pitch 对象
        if (formData.pitchMax || formData.pitchMin) {
          details.pitch = {};
          if (formData.pitchMax) details.pitch.max = formData.pitchMax;
          if (formData.pitchMin) details.pitch.min = formData.pitchMin;
        }

        // 清理临时字段
        delete details.f1;
        delete details.f2;
        delete details.f3;
        delete details.pitchMax;
        delete details.pitchMin;
      }

      // 处理文件上传
      let attachmentUrl = null;
      if (file) {
        try {
          attachmentUrl = await uploadFile(file, user.attributes.sub);
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          alert('文件上传失败。请重试。');
          setIsSubmitting(false);
          return;
        }
      }

      if (attachmentUrl) {
        details.attachmentUrl = attachmentUrl;
      }

      // 构建事件数据
      const eventData = {
        type: eventType,
        date: new Date(date).toISOString(),
        details
      };

      if (!isProductionReady) {
        // 开发模式
        setTimeout(() => {
          const mockEvent = {
            eventId: `mock-${Date.now()}`,
            userId: user.attributes.sub,
            ...eventData,
            createdAt: new Date().toISOString(),
          };
          alert('事件添加成功！（演示模式）');
          onEventAdded(mockEvent);
          resetForm();
        }, 1000);
        return;
      }

      // 生产模式
      const newEvent = await addEvent(eventData, user.attributes.sub);
      alert('事件添加成功！');
      onEventAdded(newEvent.item);
      resetForm();

    } catch (error) {
      alert('添加事件失败。请查看控制台获取详细信息。');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({});
    setEventType('self_test');
    setDate(new Date().toISOString().split('T')[0]);
    setFile(null);
    if (document.getElementById('file-input')) {
      document.getElementById('file-input').value = null;
    }
  };

  // --- RENDER ---
  return (
    <form onSubmit={handleSubmit} className="form-container">
      {/* 事件类型选择 */}
      <div className="form-field">
        <label htmlFor="event-type" className="text-lg font-semibold text-gray-800">
          事件类型 <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            id="event-type"
            value={eventType}
            onChange={(e) => handleEventTypeChange(e.target.value)}
            className="form-input-base appearance-none cursor-pointer"
            required
          >
            {eventTypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* 事件日期 */}
      <div className="form-field">
        <label htmlFor="event-date" className="text-lg font-semibold text-gray-800">
          事件日期 <span className="text-red-500">*</span>
        </label>
        <input
          id="event-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="form-input-base"
          required
        />
      </div>

      {/* 动态表单字段 */}
      {renderEventSpecificFields()}

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
