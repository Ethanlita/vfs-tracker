import React, { useState, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import EventForm from './EventForm';
import EventList from './EventList';
import { getEventsByUserId, updateUserProfile } from '../api';
import { useAsync } from '../utils/useAsync.js';
import { useAuth } from '../contexts/AuthContext';
import { isProductionReady as globalIsProductionReady } from '../env.js';

/**
 * 用户资料编辑组件
 */
const ProfileEditor = ({ userProfile, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: userProfile?.profile?.name || '',
    isNamePublic: userProfile?.profile?.isNamePublic || false,
    socials: userProfile?.profile?.socials || [],
    areSocialsPublic: userProfile?.profile?.areSocialsPublic || false
  });
  const [currentSocial, setCurrentSocial] = useState({ platform: '', handle: '' });
  const [saving, setSaving] = useState(false);

  const socialPlatforms = [
    'Twitter', 'Discord', 'Instagram', 'TikTok', 'YouTube',
    'Bilibili', 'QQ', 'WeChat', '其他'
  ];

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
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">编辑个人资料</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            显示姓名
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="输入您的姓名"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isNamePublic}
              onChange={(e) => setFormData(prev => ({ ...prev, isNamePublic: e.target.checked }))}
              className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              在公开仪表板显示姓名
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.areSocialsPublic}
              onChange={(e) => setFormData(prev => ({ ...prev, areSocialsPublic: e.target.checked }))}
              className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              在公开仪表板显示社交账户
            </span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            社交账户
          </label>

          {formData.socials.length > 0 && (
            <div className="mb-3 space-y-2">
              {formData.socials.map((social, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
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

          <div className="flex gap-2">
            <select
              value={currentSocial.platform}
              onChange={(e) => setCurrentSocial(prev => ({ ...prev, platform: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded"
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
              placeholder="用户名"
              className="flex-1 px-3 py-2 border border-gray-300 rounded"
            />
            <button
              type="button"
              onClick={addSocialAccount}
              disabled={!currentSocial.platform || !currentSocial.handle}
              className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300"
            >
              添加
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
};

/**
 * The user's profile page.
 * Displays a form to add new events and a timeline of the user's existing events.
 * @returns {JSX.Element} The rendered profile page.
 */
const Profile = () => {
  const productionReady = globalIsProductionReady();
  const { userProfile, loadUserProfile } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);

  // 条件性使用认证
  const authenticatorContext = productionReady ? useAuthenticator((context) => [context.user]) : null;
  const user = authenticatorContext?.user || {
    attributes: {
      email: 'demo@example.com',
      sub: 'demo-user-123'
    }
  };

  const [events, setEvents] = useState([]);
  const eventsAsync = useAsync(async () => {
    if (!user?.attributes?.sub) return [];
    const fetched = await getEventsByUserId(user.attributes.sub);
    return fetched.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  }, [user?.attributes?.sub]);
  useEffect(()=>{ if(eventsAsync.value) setEvents(eventsAsync.value); },[eventsAsync.value]);
  const isLoading = eventsAsync.loading;
  const loadError = eventsAsync.error;

  /**
   * Callback function passed to EventForm.
   * Adds the newly created event to the top of the events list without needing a full refetch.
   * @param {object} newEvent The event object returned from the API.
   */
  const handleEventAdded = (newEvent) => {
    // Add the new event to the top of the list to maintain sort order
    setEvents(prevEvents => [newEvent, ...prevEvents]);
  };

  /**
   * 保存用户资料
   */
  const handleSaveProfile = async (profileData) => {
    try {
      await updateUserProfile(user.attributes.sub, { profile: profileData });
      await loadUserProfile(user.attributes.sub); // 重新加载用户资料
      setEditingProfile(false);
    } catch (error) {
      console.error('保存用户资料失败:', error);
      alert('保存失败，请重试');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">我的资料</h1>
        <p className="mt-1 text-sm text-gray-500">
          欢迎，{userProfile?.profile?.name || user?.username || '用户'}。在这里您可以管理个人资料、添加新事件并查看您的时间线。
        </p>
      </div>

      {/* 用户资料显示/编辑区域 */}
      {editingProfile ? (
        <ProfileEditor
          userProfile={userProfile}
          onSave={handleSaveProfile}
          onCancel={() => setEditingProfile(false)}
        />
      ) : (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold text-gray-900">个人资料</h2>
            <button
              onClick={() => setEditingProfile(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              编辑资料
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-500">邮箱：</span>
              <span className="ml-2">{userProfile?.email || user?.attributes?.email || '未知'}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">显示姓名：</span>
              <span className="ml-2">{userProfile?.profile?.name || '未设置'}</span>
              {userProfile?.profile?.isNamePublic && (
                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">公开</span>
              )}
            </div>
            {userProfile?.profile?.socials && userProfile.profile.socials.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-500">社交账户：</span>
                <div className="mt-1 space-y-1">
                  {userProfile.profile.socials.map((social, index) => (
                    <div key={index} className="text-sm">
                      <strong>{social.platform}:</strong> {social.handle}
                    </div>
                  ))}
                </div>
                {userProfile?.profile?.areSocialsPublic && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">公开显示</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <EventForm onEventAdded={handleEventAdded} />

      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">我的时间线</h2>
        {loadError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <p className="font-semibold mb-2">加载事件失败</p>
            <p className="mb-3">{loadError.message || '未知错误'}</p>
            <button onClick={eventsAsync.execute} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs">重试</button>
          </div>
        )}
        {isLoading ? <p>正在加载事件...</p> : (!events.length ? <p className="text-gray-500">暂无事件</p> : <EventList events={events} />)}
      </div>
    </div>
  );
};

export default Profile;
