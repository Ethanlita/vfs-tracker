import { safeReturnUrl } from '../routes/authReturn.js';
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ensureAppError } from '../utils/apiError.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import {
  profileBaseVersion,
  removePendingProfileSetup,
  savePendingProfileSetup,
} from '../utils/pendingProfileSetup.js';
import { usePwaUpdateBlocker } from '../hooks/usePwaUpdateBlocker.js';

/** 分步填写展示名称和社交资料，确认页仅呈现用户内容与公开范围。 */
const ProfileSetupWizard = ({ onComplete, canSkip = true }) => {
  const {
    user,
    userProfile,
    completeProfileSetup,
    pendingProfileSetup,
    pendingProfileSyncing,
    pendingProfileError,
    pendingProfileConflict,
    retryPendingProfileSetup,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnUrl = safeReturnUrl(new URLSearchParams(location.search).get('returnUrl'));
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiError, setApiError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    isNamePublic: false,
    socials: [],
    areSocialsPublic: false
  });

  const [currentSocial, setCurrentSocial] = useState({ platform: '', handle: '' });
  const restoredDraftId = useRef(null);

  // 填写中的首次资料仍只在内存里，离线草稿确认写入前不能被更新清空。
  usePwaUpdateBlocker(
    loading || currentStep > 1 || formData.name !== '' || formData.socials.length > 0 ||
      currentSocial.platform !== '' || currentSocial.handle !== '',
    '首次资料设置'
  );

  // 社交平台选项
  const socialPlatforms = [
    'Twitter', 'Discord', 'Instagram', 'TikTok', 'YouTube',
    'Bilibili', 'QQ', 'WeChat', 'Xiaohongshu', 'LinkedIn', '其他'
  ];

  const totalSteps = 3;

  const ownerUserId = user?.userId || user?.attributes?.sub;

  // 返回向导时恢复当前账号的完成草稿；同一草稿只恢复一次，避免覆盖之后的编辑。
  useEffect(() => {
    if (!pendingProfileSetup || pendingProfileSetup.ownerUserId !== ownerUserId ||
        pendingProfileSetup.kind !== 'complete' || restoredDraftId.current === pendingProfileSetup.draftId) return;
    const profile = pendingProfileSetup.payload.profile;
    setFormData({
      name: profile.name || '',
      isNamePublic: profile.isNamePublic === true,
      socials: Array.isArray(profile.socials) ? profile.socials : [],
      areSocialsPublic: profile.areSocialsPublic === true,
    });
    restoredDraftId.current = pendingProfileSetup.draftId;
  }, [ownerUserId, pendingProfileSetup]);

  const finishSetup = () => {
    if (onComplete) {
      onComplete();
    } else {
      navigate(returnUrl, { replace: true });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
    setApiError(null);
  };

  const addSocialAccount = () => {
    if (currentSocial.platform && currentSocial.handle.trim()) {


      setFormData(prev => {
        const newSocials = [...prev.socials, { ...currentSocial, handle: currentSocial.handle.trim() }];

        return {
          ...prev,
          socials: newSocials
        };
      });
      setCurrentSocial({ platform: '', handle: '' });
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


        // 自动添加当前填写的社交账号
        setFormData(prev => {
          const newSocials = [...prev.socials, { ...currentSocial, handle: currentSocial.handle.trim() }];

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
      setApiError(null);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      setError('');
      setApiError(null);
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
          await savePendingProfileSetup({
            ownerUserId,
            payload,
            baseVersion: profileBaseVersion(userProfile),
            kind: 'complete',
            returnUrl,
          });
          if (typeof window !== 'undefined') {
            window.alert?.('已离线保存，将在联网后尝试同步。');
          }
        } catch (storageError) {
          throw ensureAppError(storageError, { message: '无法保存离线资料，请检查浏览器存储权限后重试。' });
        }
        finishSetup();
        return;
      }

      await completeProfileSetup(payload, profileBaseVersion(userProfile));
      if (pendingProfileSetup?.ownerUserId === ownerUserId) {
        await removePendingProfileSetup(ownerUserId, pendingProfileSetup.draftId);
      }
      // 不再调用 refreshUserProfile()，因为 completeProfileSetup 已经
      // 更新了 userProfile 和 needsProfileSetup 状态，再次请求后端
      // 可能因延迟/失败导致状态被覆盖回 needsProfileSetup=true（竞态条件）
      finishSetup();
    } catch (error) {

      setError('');
      setApiError(ensureAppError(error, {
        message: error.message || '设置失败，请重试',
        requestMethod: 'POST',
        requestPath: '/user/profile-setup'
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    setError('');

    // 跳过设置时，只发送 setupSkipped: true 标记
    // 后端会使用 UpdateCommand 仅更新此标记，不会覆盖用户已有资料
    const payload = {
      profile: {
        setupSkipped: true
      }
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        try {
          await savePendingProfileSetup({
            ownerUserId,
            payload,
            baseVersion: profileBaseVersion(userProfile),
            kind: 'skip',
            returnUrl,
          });
          if (typeof window !== 'undefined') {
            window.alert?.('已离线保存，将在联网后尝试同步。');
          }
        } catch (storageError) {
          throw ensureAppError(storageError, { message: '无法保存离线资料，请检查浏览器存储权限后重试。' });
        }
        finishSetup();
        return;
      }

      await completeProfileSetup(payload, profileBaseVersion(userProfile));
      if (pendingProfileSetup?.ownerUserId === ownerUserId) {
        await removePendingProfileSetup(ownerUserId, pendingProfileSetup.draftId);
      }
      // 不再调用 refreshUserProfile()，避免竞态条件
      // completeProfileSetup 已经正确设置了 needsProfileSetup=false
      finishSetup();
    } catch (error) {

      setError('');
      setApiError(ensureAppError(error, {
        message: error.message || '跳过失败，请稍后重试',
        requestMethod: 'POST',
        requestPath: '/user/profile-setup'
      }));
    } finally {
      setLoading(false);
    }
  };

  /** 手动重试已保存草稿；覆盖操作只由冲突提示中的明确按钮触发。 */
  const handlePendingRetry = async (overwrite = false) => {
    const target = pendingProfileSetup?.returnUrl || returnUrl;
    const synced = await retryPendingProfileSetup?.({ overwrite });
    if (synced) {
      if (onComplete) onComplete();
      else navigate(target, { replace: true });
    }
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
                建议不使用真实姓名。可使用常用昵称，这有助于其他用户识别您。
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
                  <div key={index} className="flex items-center justify-between gap-3 bg-gray-50 p-3 rounded-lg">
                    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      <span className="font-medium text-sm text-gray-700">{social.platform}:</span>
                      <span className="ml-2 text-gray-900">{social.handle}</span>
                    </div>
                    <button
                      onClick={() => removeSocialAccount(index)}
                      className="shrink-0 text-red-600 hover:text-red-800 text-sm"
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <select aria-label="社交平台"
                  value={currentSocial.platform}
                  onChange={(e) => {

                    setCurrentSocial(prev => ({ ...prev, platform: e.target.value }));
                  }}
                  className="min-w-0 w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                >
                  <option value="">选择平台</option>
                  {socialPlatforms.map(platform => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label="社交账号"
                  value={currentSocial.handle}
                  onChange={(e) => {

                    setCurrentSocial(prev => ({ ...prev, handle: e.target.value }));
                  }}
                  placeholder="账号名/ID"
                  className="min-w-0 w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
                <button
                  onClick={() => {

                    addSocialAccount();
                  }}
                  disabled={!currentSocial.platform || !currentSocial.handle.trim()}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  添加
                </button>
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
                <p className="text-lg text-gray-900 [overflow-wrap:anywhere]">{formData.name}</p>
                <p className="text-sm text-gray-600">
                  {formData.isNamePublic ? '✅ 将在公共页面显示' : '❌ 不在公共页面显示'}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">社交账号</h3>
                {formData.socials.length > 0 ? (
                  <div className="space-y-1">
                    {formData.socials.map((social, index) => (
                      <p key={index} className="text-gray-900 [overflow-wrap:anywhere]">
                        {social.platform}: {social.handle}
                      </p>
                    ))}
                    <p className="text-sm text-gray-600">
                      {formData.areSocialsPublic ? '✅ 将在公共页面显示' : '❌ 不在公共页面显示'}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-900">未添加社交账号</p>
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

            {(pendingProfileSetup || pendingProfileError) && (
              <section role="status" aria-label="离线资料同步状态" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <p className="font-semibold">
                  {pendingProfileConflict
                    ? '服务器资料已在草稿保存后发生变化。'
                    : pendingProfileError
                      ? '离线资料尚未同步。'
                      : pendingProfileSyncing
                        ? '正在同步离线资料…'
                        : '资料草稿已按当前账号保存，联网后会自动同步。'}
                </p>
                {pendingProfileError && !pendingProfileConflict && (
                  <p className="mt-1 text-sm">{pendingProfileError.message || '同步失败，请重试。'}</p>
                )}
                {pendingProfileConflict && (
                  <p className="mt-1 text-sm">请继续编辑草稿，或明确使用这份离线草稿覆盖服务器上的资料字段。</p>
                )}
                {pendingProfileSetup && navigator.onLine !== false && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={pendingProfileSyncing} onClick={() => handlePendingRetry(false)} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      {pendingProfileSyncing ? '同步中…' : '重试同步'}
                    </button>
                    {pendingProfileConflict && (
                      <button type="button" disabled={pendingProfileSyncing} onClick={() => handlePendingRetry(true)} className="rounded-lg border border-red-500 bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
                        使用离线草稿覆盖
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* 错误消息 */}
            {apiError && (
              <div className="mb-6">
                <ApiErrorNotice error={apiError} />
              </div>
            )}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* 步骤内容 */}
            {renderStepContent()}

            {/* 底部按钮 */}
            <div className="flex flex-wrap gap-3 justify-between items-center mt-8 pt-6 border-t border-gray-200">
              <div className="flex flex-wrap gap-3">
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
