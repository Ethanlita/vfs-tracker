import React, { useState, useEffect, useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserAvatarUrl } from '../utils/avatar';
import { ensureAppError, ValidationError } from '../utils/apiError.js';
import AvatarUpload from './AvatarUpload';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import { usePwaUpdateBlocker } from '../hooks/usePwaUpdateBlocker.js';

/** 按登录用户隔离编辑会话，切换账户时清除前一用户的草稿。 */
const UserProfileManager = () => {
  const auth = useAuth();
  return <ProfileEditor key={auth.user?.userId || 'guest'} auth={auth} />;
};

/**
 * 将 Cognito 属性验证异常转换为可操作的中文提示。
 * @param {Error & {name?:string}} error - Amplify 返回的验证异常。
 * @param {string} fallback - 未识别异常的默认提示。
 * @returns {string} 面向用户的错误信息。
 */
const emailVerificationErrorMessage = (error, fallback) => {
  if (error?.name === 'CodeMismatchException') return '验证码不正确，请检查后重新输入。';
  if (error?.name === 'ExpiredCodeException') return '验证码已过期，请重新发送后输入新验证码。';
  if (['LimitExceededException', 'TooManyRequestsException'].includes(error?.name)) {
    return '请求过于频繁，请稍后再试。';
  }
  return error?.message || fallback;
};

/** 管理当前用户的独立资料草稿和保存生命周期。 */
const ProfileEditor = ({ auth }) => {
  const {
    user,
    userProfile,
    updateUserProfile,
    cognitoUserInfo,
    cognitoLoading,
    updateCognitoUserInfo,
    pendingEmailVerification,
    resendEmailVerification,
    confirmEmailVerification,
    cancelEmailChange,
  } = auth;

  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const savePending = useRef(false);
  const [apiError, setApiError] = useState(null);
  const [success, setSuccess] = useState('');
  const [partialSuccess, setPartialSuccess] = useState('');
  const [editingCognito, setEditingCognito] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const passwordId = useId();
  const accountId = useId();
  const verificationId = useId();

  const [formData, setFormData] = useState({
    name: '',
    isNamePublic: false,
    socials: [],
    areSocialsPublic: false
  });

  const [cognitoFormData, setCognitoFormData] = useState({
    nickname: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [avatarUrl, setAvatarUrl] = useState('');

  const [currentSocial, setCurrentSocial] = useState({ platform: '', handle: '' });

  // 编辑态包含资料、账户及密码草稿，更新前必须由用户先完成或取消。
  usePwaUpdateBlocker(
    editing || editingCognito || loading || Boolean(pendingEmailVerification),
    '个人资料编辑',
  );

  const socialPlatforms = [
    'Twitter', 'Discord', 'Instagram', 'TikTok', 'YouTube',
    'Bilibili', 'QQ', 'WeChat', 'Xiaohongshu', 'LinkedIn', '其他'
  ];

  useEffect(() => {
    // 编辑中的草稿归本表单所有，头像等独立刷新不能覆盖。
    if (userProfile && !editing) {
      const profile = userProfile.profile || {};
      setFormData({
        name: profile.name || '',
        isNamePublic: profile.isNamePublic || false,
        socials: profile.socials || [],
        areSocialsPublic: profile.areSocialsPublic || false
      });
    }
  }, [userProfile, editing]);

  useEffect(() => {
    if (cognitoUserInfo && !editingCognito) {
      setCognitoFormData({
        nickname: cognitoUserInfo.nickname || '',
        email: cognitoUserInfo.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
  }, [cognitoUserInfo, editingCognito]);

  useEffect(() => {
    const loadAvatar = async () => {
      const sourceUser = cognitoUserInfo || user;
      const avatarKey = userProfile?.profile?.avatarKey;

      if (sourceUser && avatarKey) {
        const url = await getUserAvatarUrl(sourceUser, 64, avatarKey);
        setAvatarUrl(url);
      } else {
        setAvatarUrl('');
      }
    };
    loadAvatar();
  }, [cognitoUserInfo, user, userProfile?.profile?.avatarKey]);

  /** 验证完整的改密意图后再提交账户变更，避免缺少字段时误报成功。 */
  const handleUpdateCognitoInfo = async () => {
    setSuccess('');
    setPartialSuccess('');
    setApiError(null);
    setPasswordErrors({});

    const passwordFields = ['currentPassword', 'newPassword', 'confirmPassword'];
    if (passwordFields.some(field => cognitoFormData[field] !== '')) {
      const errors = {};
      const labels = ['当前密码', '新密码', '确认新密码'];
      passwordFields.forEach((field, index) => {
        if (!cognitoFormData[field]) errors[field] = `请填写${labels[index]}`;
      });
      if (cognitoFormData.confirmPassword && cognitoFormData.newPassword !== cognitoFormData.confirmPassword) {
        errors.confirmPassword = '新密码和确认密码不匹配';
      }
      if (Object.keys(errors).length) {
        setPasswordErrors(errors);
        document.getElementById(`${passwordId}-${Object.keys(errors)[0]}`)?.focus();
        return;
      }
    }

    try {
      const updates = {};

      if (cognitoFormData.nickname !== (cognitoUserInfo?.nickname || '')) {
        updates.nickname = cognitoFormData.nickname;
      }

      if (cognitoFormData.email !== (cognitoUserInfo?.email || '')) {
        updates.email = cognitoFormData.email;
      }

      if (cognitoFormData.newPassword && cognitoFormData.currentPassword) {
        updates.password = cognitoFormData.newPassword;
        updates.currentPassword = cognitoFormData.currentPassword;
      }

      if (!Object.keys(updates).length) {
        setSuccess('没有需要保存的账户修改。');
        return;
      }

      const result = await updateCognitoUserInfo(updates);

      if (result.success) {
        if (result.needsEmailVerification) {
          setPartialSuccess('');
          setSuccess(result.completedMessage || '');
        } else {
          setSuccess(result.message);
        }
        setEditingCognito(false);
        setCognitoFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
      } else if (result.partialSuccess) {
        // 已保存的属性由 AuthContext 重读；密码输入保留，让重试只提交仍失败的改密步骤。
        setPartialSuccess(result.message);
      }
    } catch (error) {
      setApiError(ensureAppError(error, {
        message: '更新失败，请重试',
        requestMethod: 'POST',
        requestPath: '/cognito/profile'
      }));
    }
  };

  const handleResendEmailVerification = async () => {
    setVerificationError('');
    setApiError(null);
    try {
      const result = await resendEmailVerification();
      if (result.success) {
        setSuccess(result.message);
        setVerificationCode('');
      }
    } catch (error) {
      setVerificationError(emailVerificationErrorMessage(error, '重新发送邮箱验证码失败，请重试。'));
    }
  };

  /** 提交待验证邮箱的验证码，失败时保留输入以便更正。 */
  const handleConfirmEmailVerification = async () => {
    const code = verificationCode.trim();
    setVerificationError('');
    setSuccess('');
    if (!code) {
      setVerificationError('请输入邮箱中的验证码。');
      document.getElementById(`${verificationId}-code`)?.focus();
      return;
    }
    try {
      const result = await confirmEmailVerification(code);
      setVerificationCode('');
      setPartialSuccess('');
      setSuccess(result.message);
    } catch (error) {
      setVerificationError(emailVerificationErrorMessage(error, '验证失败，请检查验证码后重试。'));
    }
  };

  /** 向 Cognito 恢复原邮箱，成功后才关闭待验证流程。 */
  const handleCancelEmailChange = async () => {
    setVerificationError('');
    setSuccess('');
    try {
      const result = await cancelEmailChange();
      setVerificationCode('');
      setPartialSuccess('');
      setSuccess(result.message);
    } catch (error) {
      setVerificationError(emailVerificationErrorMessage(error, '取消邮箱更换失败，请重试。'));
    }
  };

  /** 保留当前待验证流程，并打开账户编辑器填写另一个邮箱地址。 */
  const handleChangePendingEmail = () => {
    setCognitoFormData(prev => ({ ...prev, email: pendingEmailVerification.email }));
    setEditingCognito(true);
    setVerificationError('');
    setSuccess('');
    setPartialSuccess('');
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSuccess('');
    setApiError(null);
  };

  const handleCognitoInputChange = (field, value) => {
    setPasswordErrors({});
    setCognitoFormData(prev => ({ ...prev, [field]: value }));
    setSuccess('');
    setPartialSuccess('');
    setApiError(null);
  };

  /** 取消账户编辑，并使用最近一次 Cognito 读回结果恢复已确认字段。 */
  const handleCancelCognito = () => {
    setEditingCognito(false);
    if (cognitoUserInfo) {
      setCognitoFormData({
        nickname: cognitoUserInfo.nickname || '',
        email: cognitoUserInfo.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
    setSuccess('');
    setPartialSuccess('');
    setApiError(null);
  };

  const addSocialAccount = () => {
    if (currentSocial.platform && currentSocial.handle.trim()) {
      setFormData(prev => ({
        ...prev,
        socials: [...prev.socials, { ...currentSocial, handle: currentSocial.handle.trim() }]
      }));
      setCurrentSocial({ platform: '', handle: '' });
    }
  };

  const removeSocialAccount = (index) => {
    setFormData(prev => ({
      ...prev,
      socials: prev.socials.filter((_, i) => i !== index)
    }));
  };

  /** 提交期间锁定整个资料表单，失败保留快照供继续编辑或重试。 */
  const handleSave = async () => {
    if (savePending.current) return;
    savePending.current = true;
    setLoading(true);
    setSuccess('');
    setApiError(null);

    try {
      if (!formData.name.trim()) {
        throw new ValidationError('昵称不能为空。', {
          fieldErrors: [{ field: 'name', message: '昵称是必填项。' }]
        });
      }

      // 只提交本表单负责的字段，服务端逐字段更新，保留并发保存的头像和其他资料。
      await updateUserProfile({
        profile: {
          name: formData.name.trim(),
          isNamePublic: formData.isNamePublic,
          socials: formData.socials,
          areSocialsPublic: formData.areSocialsPublic
        }
      });

      setEditing(false);
      setSuccess('个人资料更新成功！');
    } catch (error) {

      setApiError(ensureAppError(error, {
        message: '更新失败，请重试',
        requestMethod: 'POST',
        requestPath: '/user/profile'
      }));
    } finally {
      savePending.current = false;
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (userProfile) {
      const profile = userProfile.profile || {};
      setFormData({
        name: profile.name || '',
        isNamePublic: profile.isNamePublic || false,
        socials: profile.socials || [],
        areSocialsPublic: profile.areSocialsPublic || false
      });
    }
    setEditing(false);
    setSuccess('');
    setApiError(null);
  };

  const handleAvatarUpdate = async ({ fileUrl, fileKey }) => {
    setApiError(null);
    try {
      if (!userProfile?.profile) {
        throw new ValidationError('请先完成个人资料设置。');
      }
      if (!fileKey) {
        throw new ValidationError('上传结果缺少文件标识，请重试。');
      }

      const updatedProfile = { avatarKey: fileKey }; // 头像更新不携带旧的名称或隐私设置。

      await updateUserProfile({ profile: updatedProfile });

      if (fileUrl) {
        setAvatarUrl(fileUrl);
      }
      setSuccess('头像更新成功！');
    } catch (error) {
      // 上传组件统一展示失败和重试入口，避免同一错误重复出现。
      throw ensureAppError(error, {
        message: '头像更新失败：' + (error.message || ''),
        requestMethod: 'PUT',
        requestPath: '/user/profile'
      });
    }
  };

  const handleBack = () => {
    navigate('/mypage');
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">请先登录以查看个人资料</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pt-6 space-y-6">
      <button
        onClick={handleBack}
        className="ml-4 mt-4 mb-6 flex items-center text-purple-600 hover:text-purple-700 transition-colors duration-200"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回仪表板
      </button>

      <div className="bg-white rounded-lg p-6 shadow-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">个人资料管理</h2>
        <p className="text-gray-600">管理您的个人信息和隐私设置</p>
      </div>

      {apiError && (
        <div className="mb-4">
          <ApiErrorNotice error={apiError} />
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {partialSuccess && (
        <div role="status" className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-lg">
          {partialSuccess}
        </div>
      )}

      <fieldset disabled={cognitoLoading} aria-label="账户信息" className="min-w-0 bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">账户信息</h3>
            <p className="text-sm text-gray-600">用于登录、验证邮箱和修改密码</p>
          </div>
          {!editingCognito ? (
            <button
              onClick={() => { setPasswordErrors({}); setEditingCognito(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              编辑账户
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleCancelCognito}
                disabled={cognitoLoading}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleUpdateCognitoInfo}
                disabled={cognitoLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {cognitoLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                保存
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 space-y-4">
          <AvatarUpload
            currentAvatar={avatarUrl}
            onAvatarUpdate={handleAvatarUpdate}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500">用户名</p>
              <p className="text-gray-900">{cognitoUserInfo?.username || '加载中...'}</p>
            </div>

            <div>
              <label htmlFor={`${accountId}-nickname`} className="block text-sm text-gray-500 mb-1">昵称</label>
              {editingCognito ? (
                <input
                  id={`${accountId}-nickname`}
                  type="text"
                  value={cognitoFormData.nickname}
                  onChange={(e) => handleCognitoInputChange('nickname', e.target.value)}
                  placeholder="请输入昵称"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <p className="text-gray-900">{cognitoUserInfo?.nickname || '未设置'}</p>
              )}
            </div>

            <div>
              <label htmlFor={`${accountId}-email`} className="block text-sm text-gray-500 mb-1">邮箱地址</label>
              {editingCognito ? (
                <input
                  id={`${accountId}-email`}
                  type="email"
                  value={cognitoFormData.email}
                  onChange={(e) => handleCognitoInputChange('email', e.target.value)}
                  placeholder="请输入邮箱地址"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <p className="text-gray-900">{cognitoUserInfo?.email || '加载中...'}</p>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-500">邮箱验证状态</p>
              <div className="flex items-center justify-between">
                <p className="text-gray-900">
                  {pendingEmailVerification ? (
                    <span className="text-amber-700 flex items-center">
                      新邮箱待验证
                    </span>
                  ) : cognitoUserInfo?.email_verified ? (
                    <span className="text-green-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      已验证
                    </span>
                  ) : (
                    <span className="text-orange-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      未验证
                    </span>
                  )}
                </p>
                {!pendingEmailVerification && !cognitoUserInfo?.email_verified && (
                  <button
                    onClick={handleResendEmailVerification}
                    disabled={cognitoLoading}
                    className="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors disabled:opacity-50"
                  >
                    发送邮箱验证码
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500">用户ID</p>
              <p className="text-gray-900 font-mono text-xs">{cognitoUserInfo?.userId || '加载中...'}</p>
            </div>
          </div>

          {pendingEmailVerification && (
            <section
              aria-labelledby={`${verificationId}-title`}
              className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"
            >
              <h4 id={`${verificationId}-title`} className="font-semibold">验证新邮箱</h4>
              <p className="mt-1 text-sm leading-6">
                待验证地址：<strong className="break-all">{pendingEmailVerification.email}</strong>。
                验证码已发送至 {pendingEmailVerification.destination || '该邮箱'}；验证成功前，账户仍使用原邮箱
                {pendingEmailVerification.previousEmail ? ` ${pendingEmailVerification.previousEmail}` : ''}。
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`${verificationId}-code`} className="block text-sm font-medium mb-1">邮箱验证码</label>
                  <input
                    id={`${verificationId}-code`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={verificationCode}
                    onChange={(event) => {
                      setVerificationCode(event.target.value);
                      setVerificationError('');
                    }}
                    aria-invalid={Boolean(verificationError)}
                    aria-describedby={verificationError ? `${verificationId}-error` : `${verificationId}-help`}
                    className="block w-full rounded-md border border-amber-400 bg-white px-3 py-2 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    placeholder="输入验证码"
                  />
                  <p id={`${verificationId}-help`} className="mt-1 text-xs text-amber-800">验证码不会保存在此设备上。</p>
                  {verificationError && (
                    <p id={`${verificationId}-error`} role="alert" className="mt-1 text-sm font-medium text-red-700">{verificationError}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleConfirmEmailVerification}
                  disabled={cognitoLoading}
                  className="rounded-md bg-amber-700 px-4 py-2 text-white hover:bg-amber-800 disabled:opacity-50"
                >
                  确认验证码
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <button type="button" onClick={handleResendEmailVerification} disabled={cognitoLoading} className="font-medium text-amber-800 underline hover:text-amber-950 disabled:opacity-50">
                  重新发送验证码
                </button>
                <button type="button" onClick={handleChangePendingEmail} disabled={cognitoLoading} className="font-medium text-amber-800 underline hover:text-amber-950 disabled:opacity-50">
                  更改邮箱地址
                </button>
                <button type="button" onClick={handleCancelEmailChange} disabled={cognitoLoading} className="font-medium text-red-700 underline hover:text-red-900 disabled:opacity-50">
                  取消更换邮箱
                </button>
              </div>
            </section>
          )}

          {editingCognito && (
            <div className="border-t pt-4 mt-6">
              <h4 className="text-md font-semibold text-gray-900 mb-4">修改密码</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`${passwordId}-currentPassword`} className="block text-sm text-gray-700 mb-1">当前密码</label>
                  <input
                    type="password"
                    id={`${passwordId}-currentPassword`}
                    autoComplete="current-password"
                    aria-invalid={Boolean(passwordErrors.currentPassword)}
                    aria-describedby={passwordErrors.currentPassword ? `${passwordId}-currentPassword-error` : undefined}
                    value={cognitoFormData.currentPassword}
                    onChange={(e) => handleCognitoInputChange('currentPassword', e.target.value)}
                    placeholder="请输入当前密码"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  {passwordErrors.currentPassword && <p id={`${passwordId}-currentPassword-error`} role="alert" className="mt-1 text-sm text-red-700">{passwordErrors.currentPassword}</p>}
                </div>
                <div></div>
                <div>
                  <label htmlFor={`${passwordId}-newPassword`} className="block text-sm text-gray-700 mb-1">新密码</label>
                  <input
                    type="password"
                    id={`${passwordId}-newPassword`}
                    autoComplete="new-password"
                    aria-invalid={Boolean(passwordErrors.newPassword)}
                    aria-describedby={passwordErrors.newPassword ? `${passwordId}-newPassword-error` : undefined}
                    value={cognitoFormData.newPassword}
                    onChange={(e) => handleCognitoInputChange('newPassword', e.target.value)}
                    placeholder="请输入新密码"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  {passwordErrors.newPassword && <p id={`${passwordId}-newPassword-error`} role="alert" className="mt-1 text-sm text-red-700">{passwordErrors.newPassword}</p>}
                </div>
                <div>
                  <label htmlFor={`${passwordId}-confirmPassword`} className="block text-sm text-gray-700 mb-1">确认新密码</label>
                  <input
                    type="password"
                    id={`${passwordId}-confirmPassword`}
                    autoComplete="new-password"
                    aria-invalid={Boolean(passwordErrors.confirmPassword)}
                    aria-describedby={passwordErrors.confirmPassword ? `${passwordId}-confirmPassword-error` : undefined}
                    value={cognitoFormData.confirmPassword}
                    onChange={(e) => handleCognitoInputChange('confirmPassword', e.target.value)}
                    placeholder="请再次输入新密码"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  {passwordErrors.confirmPassword && <p id={`${passwordId}-confirmPassword-error`} role="alert" className="mt-1 text-sm text-red-700">{passwordErrors.confirmPassword}</p>}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                如果不需要修改密码，请保持密码字段为空
              </p>
            </div>
          )}
        </div>
      </fieldset>

      <fieldset disabled={loading} aria-busy={loading} aria-label="个人资料" className="min-w-0 bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">个人资料</h3>
            <p className="text-sm text-gray-600">设置展示名称和社交账号，并选择是否在公共页面显示</p>
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
            >
              编辑资料
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                保存
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              显示名称 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              勾选公开后，此名称会显示在公共页面；它与登录账户昵称分别保存
            </p>
            {editing ? (
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="请输入您的显示名称"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-pink-500 focus:border-pink-500"
              />
            ) : (
              <p className="text-gray-900">{formData.name || '未设置'}</p>
            )}
            <div className="mt-2 flex items-center">
              <input
                type="checkbox"
                id="isNamePublic"
                checked={formData.isNamePublic}
                onChange={(e) => handleInputChange('isNamePublic', e.target.checked)}
                disabled={!editing}
                className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
              />
              <label htmlFor="isNamePublic" className="ml-2 block text-sm text-gray-700">
                在公共页面显示我的名称
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              社交账号
            </label>

            {formData.socials.length > 0 && (
              <div className="space-y-2 mb-4">
                {formData.socials.map((social, index) => (
                  <div key={index} className="flex items-center justify-between gap-3 bg-gray-50 p-3 rounded-lg">
                    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      <span className="font-medium text-sm text-gray-700">{social.platform}:</span>
                      <span className="ml-2 text-gray-900">{social.handle}</span>
                    </div>
                    {editing && (
                      <button
                        onClick={() => removeSocialAccount(index)}
                        className="shrink-0 text-red-600 hover:text-red-800 text-sm"
                      >
                        删除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {editing && (
              <div className="space-y-3">
                {/* 手机分行，桌面并排；允许控件缩小，避免固有宽度撑开页面。 */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    aria-label="社交平台"
                    value={currentSocial.platform}
                    onChange={(e) => setCurrentSocial(prev => ({ ...prev, platform: e.target.value }))}
                    className="min-w-0 w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                  >
                    <option value="">选择平台</option>
                    {socialPlatforms.map(platform => (
                      <option key={platform} value={platform}>{platform}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={currentSocial.handle}
                    onChange={(e) => setCurrentSocial(prev => ({ ...prev, handle: e.target.value }))}
                    aria-label="社交账号"
                    placeholder="账号名/ID"
                    className="min-w-0 w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                  />
                  <button
                    onClick={addSocialAccount}
                    disabled={!currentSocial.platform || !currentSocial.handle.trim()}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    添加
                  </button>
                </div>
              </div>
            )}

            <div className="mt-2 flex items-center">
              <input
                type="checkbox"
                id="areSocialsPublic"
                checked={formData.areSocialsPublic}
                onChange={(e) => handleInputChange('areSocialsPublic', e.target.checked)}
                disabled={!editing}
                className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
              />
              <label htmlFor="areSocialsPublic" className="ml-2 block text-sm text-gray-700">
                在公共页面显示我的社交账号
              </label>
            </div>
          </div>
        </div>
      </fieldset>

      <div className="bg-blue-50 rounded-lg p-4 shadow-md">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">隐私说明</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>账户信息</strong>：邮箱和密码用于登录与验证；账户昵称与下方展示名称分别保存</li>
          <li>• <strong>个人资料</strong>：展示名称和社交账号仅在您勾选公开后显示在公共页面</li>
          <li>• 您的邮箱地址和用户ID始终保持私密，不会在公共页面显示</li>
          <li>• 只有勾选"公开显示"的信息才会在公共仪表板上展示</li>
          <li>• 您可以随时修改这些隐私设置</li>
        </ul>
      </div>
    </div>
  );
};

export default UserProfileManager;
