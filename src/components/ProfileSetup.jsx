import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ProfileSetup = ({ onComplete, onSkip }) => {
  const { completeProfileSetup, user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    isNamePublic: false,
    socials: [],
    areSocialsPublic: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSocial, setCurrentSocial] = useState({ platform: '', handle: '' });

  // 社交平台选项
  const socialPlatforms = [
    'Twitter', 'Discord', 'Instagram', 'TikTok', 'YouTube',
    'Bilibili', 'QQ', 'WeChat', '其他'
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addSocialAccount = () => {
    if (currentSocial.platform && currentSocial.handle) {
      setFormData(prev => ({
        ...prev,
        socials: [...prev.socials, { ...currentSocial }]
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await completeProfileSetup({ profile: formData });
      onComplete?.();
    } catch (err) {
      setError('资料设置失败，请重试');
      console.error('Profile setup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // 设置最基本的资料（空姓名 + 隐私设置）
    const basicProfile = {
      name: '',
      isNamePublic: false,
      socials: [],
      areSocialsPublic: false
    };

    setLoading(true);
    completeProfileSetup({ profile: basicProfile })
      .then(() => {
        onSkip?.();
      })
      .catch((err) => {
        setError('跳过设置失败，请重试');
        console.error('Skip setup error:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl">✨</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            欢迎加入 VFS Tracker！
          </h1>
          <p className="text-gray-600">
            让我们先完善一下您的个人资料，这将帮助您更好地使用我们的服务
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本信息 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              显示姓名（可选）
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="输入您希望显示的姓名"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              如果不填写，系统将显示为"匿名用户"
            </p>
          </div>

          {/* 隐私设置 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-800 mb-3">隐私设置</h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isNamePublic}
                  onChange={(e) => handleInputChange('isNamePublic', e.target.checked)}
                  className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  在公开仪表板上显示我的姓名
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.areSocialsPublic}
                  onChange={(e) => handleInputChange('areSocialsPublic', e.target.checked)}
                  className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  在公开仪表板上显示我的社交账户
                </span>
              </label>
            </div>
          </div>

          {/* 社交账户 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              社交账户（可选）
            </label>

            {/* 已添加的社交账户 */}
            {formData.socials.length > 0 && (
              <div className="mb-3 space-y-2">
                {formData.socials.map((social, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <span className="text-sm">
                      <strong>{social.platform}:</strong> {social.handle}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSocialAccount(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 添加新的社交账户 */}
            <div className="flex gap-2">
              <select
                value={currentSocial.platform}
                onChange={(e) => setCurrentSocial(prev => ({ ...prev, platform: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                placeholder="用户名/账号"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={addSocialAccount}
                disabled={!currentSocial.platform || !currentSocial.handle}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                添加
              </button>
            </div>
          </div>

          {/* 按钮组 */}
          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={handleSkip}
              disabled={loading}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              暂时跳过
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 font-medium"
            >
              {loading ? '保存中...' : '完成设置'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          您可以随时在个人页面中修改这些设置
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
