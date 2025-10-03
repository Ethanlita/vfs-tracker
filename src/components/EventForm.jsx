import React, { useState } from 'react';
import { addEvent } from '../api';
import { isProductionReady as globalIsProductionReady } from '../env.js';
import { useAsync } from '../utils/useAsync.js';
import SecureFileUpload from './SecureFileUpload';
import { useAuth } from '../contexts/AuthContext.jsx';
import { resolveAttachmentLinks } from '../utils/attachments.js';
import { AuthenticationError, ensureAppError } from '../utils/apiError.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';

/**
 * @en A form for creating new voice events. It handles data input, file uploads, and submission to the backend.
 * @zh 一个用于创建新的嗓音事件的表单。它处理数据输入、文件上传和向后端提交。
 * @param {object} props - The component props.
 * @param {function(object): void} props.onEventAdded - Callback function to notify the parent component when a new event is successfully added.
 * @returns {JSX.Element} The rendered form component.
 */
const EventForm = ({ onEventAdded }) => {
  // 检查是否为生产环境
  const isProductionReady = globalIsProductionReady;

  // --- STATE MANAGEMENT ---
  // @en Use AuthContext exclusively - it already uses Amplify v6 standard APIs
  // @zh 专门使用 AuthContext - 它已经使用了 Amplify v6 标准 API
  const { user: authContextUser } = useAuth();

  console.log('📍 [验证点20] EventForm组件用户信息来源验证:', {
    source: 'AuthContext (使用Amplify v6标准API)',
    authContextUser: !!authContextUser,
    userIdFromContext: authContextUser?.userId,
    emailFromContext: authContextUser?.attributes?.email,
    混合来源检查: '无 - 仅使用AuthContext'
  });

  const user = authContextUser || {
    attributes: {
      email: 'demo@example.com',
      sub: 'demo-user-123'
    }
  };

  const [eventType, setEventType] = useState('self_test');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attachments, setAttachments] = useState([]); // 多附件集合
  const [resolvedAttachments, setResolvedAttachments] = useState([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorState, setErrorState] = useState(null);

  // 动态表单数据状态
  const [formData, setFormData] = useState({});

  // 处理文件上传完成
  const handleFileUploaded = (fileUrl, fileKey, meta = {}) => {
    // fileUrl 是临时访问URL，fileKey 为内部存储key；我们仅存储 fileKey (作为 Attachment.fileUrl)
    setAttachments(prev => [...prev, { fileUrl: fileKey, fileType: meta.fileType, fileName: meta.fileName }]);
  };

  const handleRemoveAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (attachments.length === 0) {
        setResolvedAttachments([]);
        return;
      }
      const list = await resolveAttachmentLinks(attachments);
      if (!cancelled) {
        setResolvedAttachments(list);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  // --- FORM FIELD DEFINITIONS ---
  const eventTypeOptions = [
    { value: 'self_test', label: '🔍 自我测试', emoji: '🔍' },
    { value: 'hospital_test', label: '🏥 医院检测', emoji: '🏥' },
    { value: 'voice_training', label: '💪 嗓音训练', emoji: '💪' },
    { value: 'self_practice', label: '🎯 自我练习', emoji: '🎯' },
    { value: 'surgery', label: '⚕️ 嗓音手术', emoji: '⚕️' },
    { value: 'feeling_log', label: '💬 感受记录', emoji: '💬' }
  ];

  const soundOptions = ['好', '喉咙中有痰', '其他'];
  const voicingOptions = ['夹了', '没夹', '其他'];
  const doctorOptions = ['李革临', '金亨泰', '何双八', 'Kamol', '田边正博', '自定义'];
  const locationOptions = ['友谊医院', '南京同仁医院', 'Yeson', 'Kamol', '京都耳鼻咽喉科医院', '自定义'];

  // --- HANDLERS ---
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
  const renderInput = (field, label, required = false, placeholder = '') => (
      <div key={field} className="form-field">
        <label className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type="text"
            value={formData[field] || ''}
            onChange={(e) => handleFormDataChange(field, e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors duration-200"
            required={required}
        />
      </div>
  );

  const renderTextArea = (field, label, required = false, placeholder = '') => (
      <div key={field} className="form-field md:col-span-2">
        <label className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <textarea
            value={formData[field] || ''}
            onChange={(e) => handleFormDataChange(field, e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors duration-200"
            required={required}
        />
      </div>
  );

  const renderSelect = (field, label, options, required = false) => (
      <div key={field} className="form-field">
        <label className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <select
              value={formData[field] || ''}
              onChange={(e) => handleFormDataChange(field, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm appearance-none cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors duration-200"
              required={required}
          >
            <option value="">请选择...</option>
            {options.map(option => (
                <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>
      </div>
  );

  const renderMultiSelect = (field, label, options, required = false) => (
      <div key={field} className="form-field md:col-span-2">
        <label className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="space-y-2">
          {options.map(option => (
              <label key={option} className="flex items-center gap-2 text-gray-700">
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
                    className="h-4 w-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                />
                <span className="text-sm">{option}</span>
              </label>
          ))}
        </div>
      </div>
  );

  const renderNumberInput = (field, label, unit = '', required = false) => (
      <div key={field} className="form-field">
        <label className="text-sm font-medium text-gray-700">
          {label} {unit && <span className="text-xs text-gray-500">({unit})</span>}
          {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type="number"
            step="0.01"
            value={formData[field] || ''}
            onChange={(e) => handleFormDataChange(field, parseFloat(e.target.value) || '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors duration-200"
            required={required}
        />
      </div>
  );

  const renderBooleanSelect = (field, label, required = false) => (
      <div key={field} className="form-field">
        <label className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <select
              value={formData[field] === undefined ? '' : formData[field].toString()}
              onChange={(e) => handleFormDataChange(field, e.target.value === 'true')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm appearance-none cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors duration-200"
              required={required}
          >
            <option value="">请选择...</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>
      </div>
  );

  // --- DYNAMIC FORM FIELD GENERATOR ---
  const renderEventSpecificFields = () => {
    const fields = [];

    switch (eventType) {
      case 'self_test':
        fields.push(<div key="self-header" className="form-field col-span-full"><h3 className="text-base font-semibold text-gray-900">自我测试</h3></div>);
        fields.push(renderInput('appUsed', '使用的App', false, '例如：Voice Tools, Praat'));
        fields.push(renderMultiSelect('sound', '声音状态', soundOptions, true));
        if ((formData.sound || []).includes('其他')) {
          fields.push(renderInput('customSoundDetail', '其他声音状态详情', false));
        }
        fields.push(renderMultiSelect('voicing', '发声方式', voicingOptions, true));
        if ((formData.voicing || []).includes('其他')) {
          fields.push(renderInput('customVoicingDetail', '其他发声方式详情', false));
        }
        fields.push(renderNumberInput('fundamentalFrequency', '基频', 'Hz'));
        fields.push(renderNumberInput('jitter', 'Jitter', '%'));
        fields.push(renderNumberInput('shimmer', 'Shimmer', '%'));
        fields.push(renderNumberInput('hnr', '谐噪比', 'dB'));

        // Formants object
        fields.push(<div key="formants-header" className="form-field col-span-full"><h3 className="text-base font-semibold text-gray-900">共振峰数据</h3></div>);
        fields.push(renderNumberInput('f1', 'F1', 'Hz'));
        fields.push(renderNumberInput('f2', 'F2', 'Hz'));
        fields.push(renderNumberInput('f3', 'F3', 'Hz'));

        // Pitch range object
        fields.push(<div key="pitch-header" className="form-field col-span-full"><h3 className="text-base font-semibold text-gray-900">音域范围</h3></div>);
        fields.push(renderNumberInput('pitchMax', '最高音', 'Hz'));
        fields.push(renderNumberInput('pitchMin', '最低音', 'Hz'));

        fields.push(renderTextArea('notes', '备注'));
        break;

      case 'hospital_test':
        fields.push(<div key="hospital-header" className="form-field col-span-full"><h3 className="text-base font-semibold text-gray-900">医院检测</h3></div>);
        fields.push(
          <div key="gemini-tip" className="md:col-span-2 bg-indigo-50 border-l-4 border-indigo-400 p-4 rounded-r-lg my-2">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="font-semibold text-indigo-800">请上传您的医院报告（附件）</p>
                  <p className="text-sm text-indigo-700 mt-1">
                      为确保数据准确性，<span className="font-bold">Gemini AI</span> 将会自动审核您上传的报告内容。请确保报告清晰可读，包含所有相关页面（如正反面）。全过程没有人工干预，不会有人看到您的报告。
                      <br />
                      <span className="font-semibold">提示：</span>出于隐私保护的考虑，您可以选择遮挡住您的个人识别信息，这不会影响判断。
                  </p>
              </div>
            </div>
          </div>
        );
        fields.push(renderInput('location', '医院/诊所名称', true));
        fields.push(renderInput('equipmentUsed', '使用的设备', false));
        fields.push(renderMultiSelect('sound', '声音状态', soundOptions, true));
        if ((formData.sound || []).includes('其他')) {
          fields.push(renderInput('customSoundDetail', '其他声音状态详情', false));
        }
        fields.push(renderMultiSelect('voicing', '发声方式', voicingOptions, true));
        if ((formData.voicing || []).includes('其他')) {
          fields.push(renderInput('customVoicingDetail', '其他发声方式详情', false));
        }
        fields.push(renderNumberInput('fundamentalFrequency', '基频', 'Hz'));
        fields.push(renderNumberInput('jitter', 'Jitter', '%'));
        fields.push(renderNumberInput('shimmer', 'Shimmer', '%'));
        fields.push(renderNumberInput('hnr', '谐噪比', 'dB'));

        fields.push(<div key="formants-header" className="form-field col-span-full"><h3 className="text-base font-semibold text-gray-900">共振峰数据</h3></div>);
        fields.push(renderNumberInput('f1', 'F1', 'Hz'));
        fields.push(renderNumberInput('f2', 'F2', 'Hz'));
        fields.push(renderNumberInput('f3', 'F3', 'Hz'));

        fields.push(<div key="pitch-header" className="form-field col-span-full"><h3 className="text-base font-semibold text-gray-900">音域范围</h3></div>);
        fields.push(renderNumberInput('pitchMax', '最高音', 'Hz'));
        fields.push(renderNumberInput('pitchMin', '最低音', 'Hz'));

        fields.push(renderTextArea('notes', '备注'));
        break;

      case 'voice_training':
        fields.push(<div key="training-header" className="form-field col-span-full"><h3 className="text-base font-semibold text-gray-900">嗓音训练</h3></div>);
        fields.push(renderTextArea('trainingContent', '训练内容', true, '描述本次训练的具体练习...'));
        fields.push(renderTextArea('selfPracticeContent', '自我练习内容', false, '分配的自我练习作业...'));
        fields.push(renderInput('voiceStatus', '嗓音状态评估', true));
        fields.push(renderInput('references', '参考资料', false, '参考资料链接或描述...'));
        fields.push(renderInput('voicing', '发声方式', true));
        fields.push(renderTextArea('feelings', '感受和反思', false));
        fields.push(renderInput('instructor', '指导者姓名', false));
        break;

      case 'self_practice':
        fields.push(<div key="practice-header" className="form-field col-span-full"><h3 className="text-base font-semibold text-gray-900">自我练习</h3></div>);
        fields.push(renderTextArea('practiceContent', '练习内容', true, '描述本次练习的具体内容...'));
        fields.push(renderBooleanSelect('hasInstructor', '是否有指导', true));
        if (formData.hasInstructor) {
          fields.push(renderInput('instructor', '指导者姓名', false));
        }
        fields.push(renderInput('references', '参考资料', false));
        fields.push(renderInput('voiceStatus', '嗓音状态评估', true));
        fields.push(renderInput('voicing', '发声方式', true));
        fields.push(renderTextArea('feelings', '感受和反思', false));
        break;

      case 'surgery':
        fields.push(<div key="surgery-header" className="form-field col-span-full"><h3 className="text-base font-semibold text-gray-900">嗓音手术</h3></div>);
        fields.push(renderSelect('doctor', '手术医生', doctorOptions, true));
        if (formData.doctor === '自定义') {
          fields.push(renderInput('customDoctor', '医生姓名', true));
        }
        fields.push(renderSelect('location', '手术地点', locationOptions, true));
        if (formData.location === '自定义') {
          fields.push(renderInput('customLocation', '地点名称', true));
        }
        fields.push(renderTextArea('notes', '手术备注', false));
        break;

      case 'feeling_log':
        fields.push(<div key="feeling-header" className="form-field col-span-full"><h3 className="text-base font-semibold text-gray-900">感受记录</h3></div>);
        fields.push(renderTextArea('content', '感受记录', true, '记录您今天的感受...'));
        break;

      default:
        fields.push(<div key="unknown" className="text-red-500">未知的事件类型</div>);
    }

    return fields;
  };

  // 简化的提交逻辑，移除复杂的useAsync文件上传
  const submitAsync = useAsync(async () => {
    setErrorState(null);
    setSubmitSuccess(false);
    if (!user) {
      throw new AuthenticationError('未登录用户', { requestMethod: 'POST', requestPath: '/events' });
    }

    // 构建符合数据结构的详细信息对象
    let details = { ...formData };

    if (eventType === 'self_test' || eventType === 'hospital_test') {
      if (formData.f1 || formData.f2 || formData.f3) {
        details.formants = {};
        if (formData.f1) details.formants.f1 = formData.f1;
        if (formData.f2) details.formants.f2 = formData.f2;
        if (formData.f3) details.formants.f3 = formData.f3;
      }
      if (formData.pitchMax || formData.pitchMin) {
        details.pitch = {};
        if (formData.pitchMax) details.pitch.max = formData.pitchMax;
        if (formData.pitchMin) details.pitch.min = formData.pitchMin;
      }
      delete details.f1; delete details.f2; delete details.f3; delete details.pitchMax; delete details.pitchMin;
    }

    // 移除旧单附件逻辑
    // if (attachmentUrl) { details.attachmentUrl = attachmentUrl; details.attachmentKey = attachmentKey }

    const eventData = {
      type: eventType,
      date: new Date(date).toISOString(),
      details,
    };
    if (attachments.length) eventData.attachments = attachments;

    if (!isProductionReady) {
      // 模拟延迟
      await new Promise(r => setTimeout(r, 400));
      return {
        eventId: `mock-${Date.now()}`,
        userId: user.attributes.sub,
        ...eventData,
        createdAt: new Date().toISOString()
      };
    }

    const apiResp = await addEvent(eventData);
    return apiResp.item || apiResp;
  }, [user, isProductionReady], { immediate: false }); // 禁用自动执行

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitAsync.loading) return; // 防抖
    submitAsync.execute()
      .then(newEvent => {
        if (newEvent) {
          setErrorState(null);
          setSubmitSuccess(true);
          onEventAdded(newEvent);
          resetForm();
          setTimeout(() => setSubmitSuccess(false), 2500);
        }
      })
      .catch(err => setErrorState(ensureAppError(err, { requestMethod: 'POST', requestPath: '/events' })));
  };

  const resetForm = () => {
    setFormData({});
    setEventType('self_test');
    setDate(new Date().toISOString().split('T')[0]);
    setAttachments([]);
  };

  // --- RENDER ---
  return (
      <div className="max-w-3xl mx-auto p-4">
        <form
            onSubmit={handleSubmit}
            className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm ring-1 ring-gray-200 p-6 md:p-8 space-y-8"
        >
          {/* 基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 事件类型选择 */}
            <div className="form-field">
              <label htmlFor="event-type" className="text-sm font-medium text-gray-700">
                事件类型 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                    id="event-type"
                    value={eventType}
                    onChange={(e) => handleEventTypeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm appearance-none cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors duration-200"
                    required
                >
                  {eventTypeOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </div>
            </div>

            {/* 事件日期 */}
            <div className="form-field">
              <label htmlFor="event-date" className="text-sm font-medium text-gray-700">
                事件日期 <span className="text-red-500">*</span>
              </label>
              <input
                  id="event-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors duration-200"
                  required
              />
            </div>
          </div>

          {/* 详细信息 */}
          <div className="border-t border-gray-100 pt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">详细信息</h3>
              <p className="text-sm text-gray-500">不同事件类型会显示不同的字段。</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderEventSpecificFields()}
            </div>
          </div>

          {/* 附件与提交 */}
          <div className="border-t border-gray-100 pt-6 space-y-6">
            <div className="form-field">
              <label className="text-sm font-medium text-gray-700">
                附件 <span className="text-xs text-gray-500 font-normal">（可选，多文件：报告正反面、图片或PDF等）</span>
              </label>
              <div className="space-y-3">
                <SecureFileUpload
                  fileType="attachment"
                  currentFileUrl=""
                  onFileUpdate={handleFileUploaded}
                  allowedTypes={['image/*','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                  maxSize={15 * 1024 * 1024}
                  className="w-full"
                />
                {attachments.length > 0 && (
                  <div className="bg-gray-50 rounded-md p-3 space-y-2">
                    <p className="text-xs font-medium text-gray-600">已添加附件 ({attachments.length}):</p>
                    <ul className="space-y-1 text-xs">
                      {resolvedAttachments.map((att, idx) => (
                        <li key={idx} className="flex items-center justify-between gap-2">
                          <a
                            href={att.downloadUrl || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate flex-1 text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            📎 {att.fileName || att.fileUrl}
                          </a>
                          <button type="button" onClick={() => handleRemoveAttachment(idx)} className="text-red-500 hover:text-red-600">移除</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="pt-2">
              <button
                  type="submit"
                  disabled={submitAsync.loading}
                  className="w-full group relative inline-flex justify-center py-3 px-6 border-0 shadow-lg text-base font-bold rounded-xl text-white bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 active:scale-[0.99] transition disabled:opacity-60"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-4">
                  {submitAsync.loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                      <svg className="h-5 w-5 text-white/90 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                      </svg>
                  )}
                </span>
                {submitAsync.loading ? '处理中...' : '✨ 添加新事件'}
              </button>
            </div>
          </div>

          {/* 提示信息 */}
          <div className="mt-4 space-y-3">
            {errorState && (
              <ApiErrorNotice error={errorState} onRetry={() => submitAsync.execute()} />
            )}
            {submitSuccess && !errorState && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">事件添加成功！</div>
            )}
          </div>
        </form>
      </div>
  );
};

export default EventForm;
