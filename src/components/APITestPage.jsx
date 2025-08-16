import React, { useState } from 'react';
import {
  getUserProfile,
  getUserPublicProfile,
  updateUserProfile,
  setupUserProfile
} from '../api';

const APITestPage = () => {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [testUserId] = useState('demo-user-123'); // 开发模式测试用户ID

  const [profileData, setProfileData] = useState({
    name: '测试用户',
    isNamePublic: true,
    socials: [
      { platform: 'Twitter', handle: '@testuser' }
    ],
    areSocialsPublic: false
  });

  const runTest = async (testName, testFunction) => {
    setLoading(prev => ({ ...prev, [testName]: true }));
    try {
      const result = await testFunction();
      setResults(prev => ({
        ...prev,
        [testName]: {
          success: true,
          data: result,
          timestamp: new Date().toLocaleTimeString()
        }
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [testName]: {
          success: false,
          error: error.message,
          timestamp: new Date().toLocaleTimeString()
        }
      }));
    } finally {
      setLoading(prev => ({ ...prev, [testName]: false }));
    }
  };

  const tests = [
    {
      name: 'getUserProfile',
      label: '1. 查询用户信息API（私有）',
      description: '获取当前用户的完整资料信息',
      action: () => runTest('getUserProfile', () => getUserProfile(testUserId))
    },
    {
      name: 'getUserPublicProfile',
      label: '2. 查询用户信息API（公用）',
      description: '获取用户的公开资料信息',
      action: () => runTest('getUserPublicProfile', () => getUserPublicProfile(testUserId))
    },
    {
      name: 'setupUserProfile',
      label: '3. 新用户资料完善API（私有）',
      description: '为新用户创建或完善资料信息',
      action: () => runTest('setupUserProfile', () => setupUserProfile({ profile: profileData }))
    },
    {
      name: 'updateUserProfile',
      label: '4. 编辑用户信息API（私有）',
      description: '更新用户资料信息',
      action: () => runTest('updateUserProfile', () => updateUserProfile(testUserId, { profile: profileData }))
    }
  ];

  const ResultDisplay = ({ testName }) => {
    const result = results[testName];
    if (!result) return null;

    return (
      <div className={`mt-2 p-3 rounded-lg border ${
        result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium ${
            result.success ? 'text-green-800' : 'text-red-800'
          }`}>
            {result.success ? '✅ 成功' : '❌ 失败'} - {result.timestamp}
          </span>
        </div>
        <pre className="text-xs overflow-auto max-h-40 bg-gray-100 p-2 rounded">
          {result.success
            ? JSON.stringify(result.data, null, 2)
            : result.error
          }
        </pre>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          用户API测试页面
        </h1>
        <p className="text-gray-600">
          测试4个新增的用户管理API。当前运行在开发模式，使用模拟数据。
        </p>
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>测试用户ID:</strong> {testUserId}<br/>
            <strong>环境:</strong> 开发模式（使用模拟数据）
          </p>
        </div>
      </div>

      {/* 测试数据配置 */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">测试数据配置</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户姓名
            </label>
            <input
              type="text"
              value={profileData.name}
              onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={profileData.isNamePublic}
                onChange={(e) => setProfileData(prev => ({ ...prev, isNamePublic: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm">姓名公开</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={profileData.areSocialsPublic}
                onChange={(e) => setProfileData(prev => ({ ...prev, areSocialsPublic: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm">社交账户公开</span>
            </label>
          </div>
        </div>
      </div>

      {/* API测试按钮 */}
      <div className="space-y-6">
        {tests.map((test) => (
          <div key={test.name} className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {test.label}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {test.description}
                </p>
              </div>
              <button
                onClick={test.action}
                disabled={loading[test.name]}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading[test.name] ? '测试中...' : '运行测试'}
              </button>
            </div>
            <ResultDisplay testName={test.name} />
          </div>
        ))}
      </div>

      {/* 批量测试 */}
      <div className="mt-8 text-center">
        <button
          onClick={() => {
            tests.forEach((test, index) => {
              setTimeout(() => test.action(), index * 1000); // 每个测试间隔1秒
            });
          }}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-medium"
        >
          🚀 运行所有测试
        </button>
      </div>
    </div>
  );
};

export default APITestPage;
