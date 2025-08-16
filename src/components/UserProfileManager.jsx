import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, updateUserProfile } from '../api';
import { generateAvatar } from '../utils/avatar';

const UserProfileManager = () => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  // 加载用户资料
  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        isNamePublic: userProfile.isNamePublic || false,
        socials: userProfile.socials || [],
        areSocialsPublic: userProfile.areSocialsPublic || false
      });
    }
  }, [userProfile]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
    setSuccess('');
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
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await updateUserProfile({
        name: formData.name.trim(),
        isNamePublic: formData.isNamePublic,
        socials: formData.socials,
        areSocialsPublic: formData.areSocialsPublic
      });

      await refreshUserProfile();
      setEditing(false);
      setSuccess('个人资料更新成功！');
    } catch (error) {
      console.error('更新个人资料失败:', error);
      setError(error.message || '更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // 恢复原始数据
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        isNamePublic: userProfile.isNamePublic || false,
        socials: userProfile.socials || [],
        areSocialsPublic: userProfile.areSocialsPublic || false
      });
    }
    setEditing(false);
    setError('');
    setSuccess('');
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">请先登录以查看个人资料</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">个人资料管理</h2>
        <p className="text-gray-600">管理您的个人信息和隐私设置</p>
      </div>

      {/* 错误和成功消息 */}
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

      {/* 账户信息（只读） */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">账户信息</h3>
          <p className="text-sm text-gray-600">由认证系统管理，无法修改</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
              <img
                src={generateAvatar(user.username || user.email, 64)}
                alt={`${user.username || user.email || '用户'}的头像`}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-sm text-gray-500">头像</p>
              <p className="text-gray-900">基于用户名自动生成</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500">用户名</p>
              <p className="text-gray-900">{user.username || '未设置'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">邮箱地址</p>
              <p className="text-gray-900">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">用户ID</p>
              <p className="text-gray-900 font-mono text-xs">{user.sub || user.userId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">邮箱验证状态</p>
              <p className="text-gray-900">
                {user.email_verified ? (
                  <span className="text-green-600">已验证</span>
                ) : (
                  <span className="text-orange-600">未验证</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 个人资料 */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">个人资料</h3>
            <p className="text-sm text-gray-600">您可以控制这些信息的公开程度</p>
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
          {/* 昵称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              昵称 <span className="text-red-500">*</span>
            </label>
            {editing ? (
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="请输入您的昵称"
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
                在公共页面显示我的昵称
              </label>
            </div>
          </div>

          {/* 社交账号 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              社交账号
            </label>

            {/* 现有社交账号列表 */}
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

            {/* 添加新社交账号 */}
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">隐私说明</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 您的邮箱地址和用户ID始终保持私密，不会在公共页面显示</li>
          <li>• 只有勾选"公开显示"的信息才会在公共仪表板上展示</li>
          <li>• 您可以随时修改这些隐私设置</li>
          <li>• 未公开的信息仅用于系统功能，不会与第三方分享</li>
        </ul>
      </div>
    </div>
  );
};

export default UserProfileManager;
