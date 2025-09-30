import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { setupUserProfile } from '../api';

const ProfileSetupWizard = ({ onComplete, canSkip = false }) => {
  const { user, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    isNamePublic: false,
    socials: [],
    areSocialsPublic: false
  });

  const [currentSocial, setCurrentSocial] = useState({ platform: '', handle: '' });

  // 社交平台选项
  const socialPlatforms = [
    'Twitter', 'Discord', 'Instagram', 'TikTok', 'YouTube',
    'Bilibili', 'QQ', 'WeChat', 'Xiaohongshu', 'LinkedIn', '其他'
  ];

  const totalSteps = 3;

  const pendingProfileKey = 'pendingProfileSetup:v1';

  const finishSetup = () => {
    if (onComplete) {
      onComplete();
    } else {
      navigate('/mypage', { replace: true });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const addSocialAccount = () => {
    if (currentSocial.platform && currentSocial.handle.trim()) {
      console.log('🔍 添加社交账号:', {
        platform: currentSocial.platform,
        handle: currentSocial.handle.trim(),
        currentSocials: formData.socials
      });

      setFormData(prev => {
        const newSocials = [...prev.socials, { ...currentSocial, handle: currentSocial.handle.trim() }];
        console.log('✅ 社交账号已添加，新的socials数组:', newSocials);
        return {
          ...prev,
          socials: newSocials
        };
      });
      setCurrentSocial({ platform: '', handle: '' });
    } else {
      console.log('❌ 无法添加社交账号，缺少必要信息:', {
        platform: currentSocial.platform,
        handle: currentSocial.handle.trim()
      });
    }
  };

  const removeSocialAccount = (index) => {
    setFormData(prev => ({
      ...prev,
      socials: prev.socials.filter((_, i) => i !== index)
    }));
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        setError('请输入您的昵称');
        return;
      }
    }

    // 在第2步，如果用户填写了社交账号信息但没有点击添加，自动添加
    if (currentStep === 2) {
      if (currentSocial.platform && currentSocial.handle.trim()) {
        console.log('🔍 用户没有点击添加按钮，自动添加社交账号:', {
          platform: currentSocial.platform,
          handle: currentSocial.handle.trim()
        });

        // 自动添加当前填写的社交账号
        setFormData(prev => {
          const newSocials = [...prev.socials, { ...currentSocial, handle: currentSocial.handle.trim() }];
          console.log('✅ 自动添加社交账号，新的socials数组:', newSocials);
          return {
            ...prev,
            socials: newSocials
          };
        });
        setCurrentSocial({ platform: '', handle: '' });
      }
    }

    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
      setError('');
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      setError('');
    }
  };

  const handleComplete = async () => {
    if (!formData.name.trim()) {
      setError('昵称不能为空');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      profile: {
        name: formData.name.trim(),
        bio: '',
        isNamePublic: formData.isNamePublic,
        socials: formData.socials,
        areSocialsPublic: formData.areSocialsPublic
      }
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        try {
          localStorage.setItem(pendingProfileKey, JSON.stringify({
            userId: user?.userId || user?.attributes?.sub || null,
            payload,
            savedAt: Date.now()
          }));
          if (typeof window !== 'undefined') {
            window.alert?.('已离线保存，将在联网后尝试同步。');
          }
        } catch (storageError) {
          console.warn('⚠️ 离线暂存用户资料失败', storageError);
        }
        finishSetup();
        return;
      }

      await setupUserProfile(payload);
      await refreshUserProfile();
      finishSetup();
    } catch (error) {
      console.error('设置用户资料失败:', error);
      setError(error.message || '设置失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (!canSkip) return;
    finishSetup();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">设置您的昵称</h2>
              <p className="text-gray-600">这是其他用户看到的名称</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                昵称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="请输入您的昵称"
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-lg"
                autoFocus
              />
              <p className="mt-2 text-sm text-gray-500">
                建议使用真实姓名或常用昵称，这有助于其他用户识别您
              </p>
            </div>

            <div className="flex items-center p-4 bg-blue-50 rounded-lg">
              <input
                type="checkbox"
                id="isNamePublic"
                checked={formData.isNamePublic}
                onChange={(e) => handleInputChange('isNamePublic', e.target.checked)}
                className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
              />
              <label htmlFor="isNamePublic" className="ml-3 block text-sm text-gray-700">
                <span className="font-medium">在公共页面显示我的昵称</span>
                <span className="block text-gray-500 mt-1">
                  勾选后，您的昵称将在公共仪表板上显示给其他用户
                </span>
              </label>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">添加社交账号</h2>
              <p className="text-gray-600">让其他用户能够联系到您（可选）</p>
            </div>

            {/* 现有社交账号列表 */}
            {formData.socials.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">已添加的账号：</h3>
                {formData.socials.map((social, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div>
                      <span className="font-medium text-sm text-gray-700">{social.platform}:</span>
                      <span className="ml-2 text-gray-900">{social.handle}</span>
                    </div>
                    <button
                      onClick={() => removeSocialAccount(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 添加新社交账号 */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">添加新账号：</h3>
              <div className="flex space-x-2">
                <select
                  value={currentSocial.platform}
                  onChange={(e) => {
                    console.log('🔍 选择平台:', e.target.value);
                    setCurrentSocial(prev => ({ ...prev, platform: e.target.value }));
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                >
                  <option value="">选择平台</option>
                  {socialPlatforms.map(platform => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={currentSocial.handle}
                  onChange={(e) => {
                    console.log('🔍 输入账号:', e.target.value);
                    setCurrentSocial(prev => ({ ...prev, handle: e.target.value }));
                  }}
                  placeholder="账号名/ID"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
                <button
                  onClick={() => {
                    console.log('🔍 点击添加按钮，当前状态:', {
                      platform: currentSocial.platform,
                      handle: currentSocial.handle,
                      hasPlatform: !!currentSocial.platform,
                      hasTrimmedHandle: !!currentSocial.handle.trim(),
                      isDisabled: !currentSocial.platform || !currentSocial.handle.trim()
                    });
                    addSocialAccount();
                  }}
                  disabled={!currentSocial.platform || !currentSocial.handle.trim()}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  添加
                </button>
              </div>

              {/* 调试信息显示 */}
              <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
                调试信息 - 当前社交账号输入状态:<br/>
                平台: "{currentSocial.platform}" (是否有效: {currentSocial.platform ? '✅' : '❌'})<br/>
                账号: "{currentSocial.handle}" (trim后: "{currentSocial.handle.trim()}", 是否有效: {currentSocial.handle.trim() ? '✅' : '❌'})<br/>
                按钮状态: {(!currentSocial.platform || !currentSocial.handle.trim()) ? '禁用' : '启用'}
              </div>
            </div>

            <div className="flex items-center p-4 bg-blue-50 rounded-lg">
              <input
                type="checkbox"
                id="areSocialsPublic"
                checked={formData.areSocialsPublic}
                onChange={(e) => handleInputChange('areSocialsPublic', e.target.checked)}
                className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
              />
              <label htmlFor="areSocialsPublic" className="ml-3 block text-sm text-gray-700">
                <span className="font-medium">在公共页面显示我的社交账号</span>
                <span className="block text-gray-500 mt-1">
                  勾选后，您的社交账号将在公共仪表板上显示，方便其他用户联系您
                </span>
              </label>
            </div>
          </div>
        );

      case 3:
        console.log('🔍 确认页面 - 当前formData:', formData);
        console.log('🔍 确认页面 - socials数组长度:', formData.socials.length);
        console.log('🔍 确认页面 - socials内容:', formData.socials);

        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">确认您的信息</h2>
              <p className="text-gray-600">请检查以下信息是否正确</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">昵称</h3>
                <p className="text-lg text-gray-900">{formData.name}</p>
                <p className="text-sm text-gray-600">
                  {formData.isNamePublic ? '✅ 将在公共页面显示' : '❌ 不在公共页面显示'}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">社交账号 (调试: 数组长度={formData.socials.length})</h3>
                {formData.socials.length > 0 ? (
                  <div className="space-y-1">
                    {formData.socials.map((social, index) => (
                      <p key={index} className="text-gray-900">
                        {social.platform}: {social.handle}
                      </p>
                    ))}
                    <p className="text-sm text-gray-600">
                      {formData.areSocialsPublic ? '✅ 将在公共页面显示' : '❌ 不在公共页面显示'}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-900">未添加社交账号 (调试: socials = {JSON.stringify(formData.socials)})</p>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">隐私提醒</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 您的邮箱地址和用户ID始终保持私密</li>
                <li>• 只有勾选"公开显示"的信息才会展示给其他用户</li>
                <li>• 您可以随时在个人设置中修改这些信息</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* 顶部进度条 */}
          <div className="bg-pink-600 h-2">
            <div
              className="bg-white h-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>

          {/* 内容区域 */}
          <div className="p-8">
            {/* 步骤指示器 */}
            <div className="flex justify-center mb-8">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= currentStep 
                      ? 'bg-pink-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-12 h-1 mx-2 ${
                      step < currentStep ? 'bg-pink-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>

            {/* 错误消息 */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* 步骤内容 */}
            {renderStepContent()}

            {/* 底部按钮 */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              <div className="flex space-x-3">
                {currentStep > 1 && (
                  <button
                    onClick={handlePrevious}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    上一步
                  </button>
                )}
                {canSkip && (
                  <button
                    onClick={handleSkip}
                    className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    跳过设置
                  </button>
                )}
              </div>

              <div>
                {currentStep < totalSteps ? (
                  <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
                  >
                    下一步
                  </button>
                ) : (
                  <button
                    onClick={handleComplete}
                    disabled={loading}
                    className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 flex items-center"
                  >
                    {loading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    完成设置
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 底部说明 */}
        <div className="text-center mt-6 text-sm text-gray-500">
          欢迎加入 VFS Tracker 社区！完善您的资料有助于更好地使用平台功能。
        </div>
      </div>
    </div>
  );
};

export default ProfileSetupWizard;
