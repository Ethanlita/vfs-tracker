import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateUserProfile } from '../api';
import { getUserAvatarUrl } from '../utils/avatar';
import { ensureAppError } from '../utils/apiError.js';
import AvatarUpload from './AvatarUpload';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';

const UserProfileManager = () => {
  const {
    user,
    userProfile,
    refreshUserProfile,
    cognitoUserInfo,
    cognitoLoading,
    updateCognitoUserInfo,
    refreshCognitoUserInfo,
    resendEmailVerification // 新增
  } = useAuth();

  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiError, setApiError] = useState(null);
  const [success, setSuccess] = useState('');
  const [editingCognito, setEditingCognito] = useState(false);

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

  const socialPlatforms = [
    'Twitter', 'Discord', 'Instagram', 'TikTok', 'YouTube',
    'Bilibili', 'QQ', 'WeChat', 'Xiaohongshu', 'LinkedIn', '其他'
  ];

  // 同步用户资料数据
  useEffect(() => {
    if (userProfile) {
      console.log('🔍 同步用户资料数据:', userProfile);

      // 修复：正确从 userProfile.profile 中读取数据
      const profile = userProfile.profile || {};
      setFormData({
        name: profile.name || '',
        isNamePublic: profile.isNamePublic || false,
        socials: profile.socials || [],
        areSocialsPublic: profile.areSocialsPublic || false
      });

      console.log('📝 设置表单数据:', {
        name: profile.name || '',
        isNamePublic: profile.isNamePublic || false,
        socials: profile.socials || [],
        areSocialsPublic: profile.areSocialsPublic || false
      });
    }
  }, [userProfile]);

  // 同步Cognito用户数据
  useEffect(() => {
    if (cognitoUserInfo) {
      setCognitoFormData({
        nickname: cognitoUserInfo.nickname || '',
        email: cognitoUserInfo.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
  }, [cognitoUserInfo]);

  useEffect(() => {
    const loadAvatar = async () => {
      const sourceUser = cognitoUserInfo || user;
      if (sourceUser) {
        const url = await getUserAvatarUrl(sourceUser, 64);
        setAvatarUrl(url);
      }
    };
    loadAvatar();
  }, [cognitoUserInfo, user]);

  // 更新Cognito用户信息 - 增强邮箱验证处理
  const handleUpdateCognitoInfo = async () => {
    setError('');
    setSuccess('');
    setApiError(null);

    try {
      const updates = {};

      // 只更新有变化的属性
      if (cognitoFormData.nickname !== cognitoUserInfo?.nickname) {
        updates.nickname = cognitoFormData.nickname;
      }

      if (cognitoFormData.email !== cognitoUserInfo?.email) {
        updates.email = cognitoFormData.email;
      }

      // 处理密码更新
      if (cognitoFormData.newPassword && cognitoFormData.currentPassword) {
        if (cognitoFormData.newPassword !== cognitoFormData.confirmPassword) {
          throw new Error('新密码和确认密码不匹配');
        }

        updates.password = cognitoFormData.newPassword;
        updates.currentPassword = cognitoFormData.currentPassword;
      }

      // 调用AuthContext的更新方法
      const result = await updateCognitoUserInfo(updates);

      if (result.success) {
        setSuccess(result.message);
        setEditingCognito(false);

        // 清空密码字段
        setCognitoFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));

        // 如果邮箱需要验证，显示额外的提示
        if (result.needsEmailVerification) {
          setSuccess(prev => prev + ' 如果没有收到验证邮件，可以点击"重新发送验证邮件"按钮。');
        }
      }
    } catch (error) {
      console.error('更新Cognito用户信息失败:', error);
      setError('');
      setApiError(ensureAppError(error, {
        message: error.message || '更新失败，请重试',
        requestMethod: 'POST',
        requestPath: '/cognito/profile'
      }));
    }
  };

  // 重新发送邮箱验证
  const handleResendEmailVerification = async () => {
    try {
      const result = await resendEmailVerification();
      if (result.success) {
        setSuccess(result.message);
      }
    } catch (error) {
      setError('');
      setApiError(ensureAppError(error, {
        message: error.message || '重新发送验证邮件失败',
        requestMethod: 'POST',
        requestPath: '/cognito/resend-verification'
      }));
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
    setSuccess('');
    setApiError(null);
  };

  const handleCognitoInputChange = (field, value) => {
    setCognitoFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
    setSuccess('');
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

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('昵称不能为空');
      setApiError(null);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setApiError(null);

    try {
      // 修复：正确传递 userId 和 profileData 参数
      await updateUserProfile(user.userId, {
        profile: {
          name: formData.name.trim(),
          isNamePublic: formData.isNamePublic,
          socials: formData.socials,
          areSocialsPublic: formData.areSocialsPublic
        }
      });

      await refreshUserProfile();
      setEditing(false);
      setSuccess('个人资料更新成功！');
    } catch (error) {
      console.error('更新个人资料失败:', error);
      setError('');
      setApiError(ensureAppError(error, {
        message: error.message || '更新失败，请重试',
        requestMethod: 'POST',
        requestPath: '/user/profile'
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (userProfile) {
      // 修复：正确从 userProfile.profile 中读取数据
      const profile = userProfile.profile || {};
      setFormData({
        name: profile.name || '',
        isNamePublic: profile.isNamePublic || false,
        socials: profile.socials || [],
        areSocialsPublic: profile.areSocialsPublic || false
      });
    }
    setEditing(false);
    setError('');
    setSuccess('');
    setApiError(null);
  };

  // 处理头像更新
  const handleAvatarUpdate = async (avatarKey) => {
    try {
      const result = await updateCognitoUserInfo({ avatarKey });
      if (result.success) {
        setSuccess('头像更新成功！');
        await refreshCognitoUserInfo();
      }
    } catch (error) {
      setError('');
      setApiError(ensureAppError(error, {
        message: '头像更新失败：' + (error.message || ''),
        requestMethod: 'POST',
        requestPath: '/cognito/avatar'
      }));
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
      {/* 返回按钮 */}
      <button
        onClick={handleBack}
        className="ml-4 mt-4 mb-6 flex items-center text-purple-600 hover:text-purple-700 transition-colors duration-200"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回仪表板
      </button>

      {/* 页面标题 */}
      <div className="bg-white rounded-lg p-6 shadow-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">个人资料管理</h2>
        <p className="text-gray-600">管理您的个人信息和隐私设置</p>
      </div>

      {/* 错误和成功消息 */}
      {apiError && (
        <div className="mb-4">
          <ApiErrorNotice error={apiError} />
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Cognito账户信息 */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">账户信息</h3>
            <p className="text-sm text-gray-600">由Cognito认证系统管理</p>
          </div>
          {!editingCognito ? (
            <button
              onClick={() => setEditingCognito(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              编辑账户
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setEditingCognito(false);
                  if (cognitoUserInfo) {
                    setCognitoFormData({
                      nickname: cognitoUserInfo.nickname,
                      email: cognitoUserInfo.email,
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }
                  setError('');
                  setSuccess('');
                }}
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
          {/* 头像部分 - 使用AvatarUpload组件 */}
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
              <label className="block text-sm text-gray-500 mb-1">昵称</label>
              {editingCognito ? (
                <input
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
              <label className="block text-sm text-gray-500 mb-1">邮箱地址</label>
              {editingCognito ? (
                <input
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
                  {cognitoUserInfo?.email_verified ? (
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
                {/* 重新发送验证邮件按钮 */}
                {!cognitoUserInfo?.email_verified && (
                  <button
                    onClick={handleResendEmailVerification}
                    disabled={cognitoLoading}
                    className="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors disabled:opacity-50"
                  >
                    重新发送验证邮件
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500">用户ID</p>
              <p className="text-gray-900 font-mono text-xs">{cognitoUserInfo?.userId || '加载中...'}</p>
            </div>
          </div>

          {/* 密码修改部分 */}
          {editingCognito && (
            <div className="border-t pt-4 mt-6">
              <h4 className="text-md font-semibold text-gray-900 mb-4">修改密码</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">当前密码</label>
                  <input
                    type="password"
                    value={cognitoFormData.currentPassword}
                    onChange={(e) => handleCognitoInputChange('currentPassword', e.target.value)}
                    placeholder="请输入当前密码"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div></div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">新密码</label>
                  <input
                    type="password"
                    value={cognitoFormData.newPassword}
                    onChange={(e) => handleCognitoInputChange('newPassword', e.target.value)}
                    placeholder="请输入新密码"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">确认新密码</label>
                  <input
                    type="password"
                    value={cognitoFormData.confirmPassword}
                    onChange={(e) => handleCognitoInputChange('confirmPassword', e.target.value)}
                    placeholder="请再次输入新密码"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                如果不需要修改密码，请保持密码字段为空
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 个人资料（Lambda管理的部分） */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">个人资料</h3>
            <p className="text-sm text-gray-600">由Lambda函数管理，您可以控制这些信息的公开程度</p>
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
          {/* 显示名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              显示名称 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              这个名称会在公共页面显示，与Cognito昵称独立管理
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
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div>
                      <span className="font-medium text-sm text-gray-700">{social.platform}:</span>
                      <span className="ml-2 text-gray-900">{social.handle}</span>
                    </div>
                    {editing && (
                      <button
                        onClick={() => removeSocialAccount(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
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
                <div className="flex space-x-2">
                  <select
                    value={currentSocial.platform}
                    onChange={(e) => setCurrentSocial(prev => ({ ...prev, platform: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-pink-500 focus:border-pink-500"
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
                    placeholder="账号名/ID"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-pink-500 focus:border-pink-500"
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
      </div>

      {/* 隐私说明 */}
      <div className="bg-blue-50 rounded-lg p-4 shadow-md">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">隐私说明</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>账户信息</strong>：邮箱、昵称、密码由Cognito管理，用于登录和验证</li>
          <li>• <strong>个人资料</strong>：显示名称、社交账号由Lambda管理，用于公共展示</li>
          <li>• 您的邮箱地址和用户ID始终保持私密，不会在公共页面显示</li>
          <li>• 只有勾选"公开显示"的信息才会在公共仪表板上展示</li>
          <li>• 您可以随时修改这些隐私设置</li>
        </ul>
      </div>
    </div>
  );
};

export default UserProfileManager;
