import React, { useEffect, useState } from 'react';
import { getEventsByUserId } from '../api';
import { isProductionReady } from '../env.js';
import mockData from '../mock_data.json';

const DevModeTest = () => {
  const [testResults, setTestResults] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const runTests = async () => {
      console.log('🧪 开始开发模式测试');

      const results = {
        envCheck: null,
        mockDataCheck: null,
        apiCallTest: null,
        error: null
      };

      try {
        // 1. 检查环境配置
        const isProdReady = isProductionReady();
        results.envCheck = {
          isProdReady,
          shouldUseMockData: !isProdReady
        };

        // 2. 检查mock数据
        const mockUser1Events = mockData.events.filter(event => event.userId === 'mock-user-1');
        results.mockDataCheck = {
          totalMockEvents: mockData.events.length,
          mockUser1Events: mockUser1Events.length,
          mockUser1EventTypes: mockUser1Events.map(e => e.type),
          hasFrequencyData: mockUser1Events.some(e => e.details?.fundamentalFrequency)
        };

        // 3. 测试API调用
        console.log('🔍 测试API调用 getEventsByUserId("mock-user-1")');
        const apiEvents = await getEventsByUserId('mock-user-1');
        results.apiCallTest = {
          success: true,
          eventCount: apiEvents?.length || 0,
          events: apiEvents,
          hasFrequencyData: apiEvents?.some(e => e.details?.fundamentalFrequency) || false,
          hasAttachmentsArray: apiEvents?.some(e => Array.isArray(e.attachments)) || false,
          firstEventAttachmentsCount: apiEvents?.[0]?.attachments?.length || 0
        };

      } catch (error) {
        console.error('❌ 测试失败:', error);
        results.error = error.message;
        results.apiCallTest = { success: false, error: error.message };
      }

      setTestResults(results);
      setIsLoading(false);

      console.log('🧪 测试结果:', results);
    };

    runTests();
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h2 className="text-xl font-bold text-blue-800 mb-4">🧪 开发模式测试</h2>
        <p>正在测试...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
      <h2 className="text-xl font-bold text-blue-800 mb-4">🧪 开发模式测试结果</h2>

      {/* 环境检查 */}
      <div className="bg-white p-4 rounded border">
        <h3 className="font-semibold text-gray-800 mb-2">1. 环境检查</h3>
        <div className="text-sm space-y-1">
          <p>生产就绪: <span className={testResults.envCheck?.isProdReady ? 'text-red-600' : 'text-green-600'}>
            {testResults.envCheck?.isProdReady ? '是' : '否'}
          </span></p>
          <p>应使用Mock数据: <span className={testResults.envCheck?.shouldUseMockData ? 'text-green-600' : 'text-red-600'}>
            {testResults.envCheck?.shouldUseMockData ? '是' : '否'}
          </span></p>
        </div>
      </div>

      {/* Mock数据检查 */}
      <div className="bg-white p-4 rounded border">
        <h3 className="font-semibold text-gray-800 mb-2">2. Mock数据检查</h3>
        <div className="text-sm space-y-1">
          <p>总事件数: {testResults.mockDataCheck?.totalMockEvents}</p>
          <p>mock-user-1事件数: {testResults.mockDataCheck?.mockUser1Events}</p>
          <p>事件类型: {testResults.mockDataCheck?.mockUser1EventTypes?.join(', ')}</p>
          <p>包含基频数据: <span className={testResults.mockDataCheck?.hasFrequencyData ? 'text-green-600' : 'text-red-600'}>
            {testResults.mockDataCheck?.hasFrequencyData ? '是' : '否'}
          </span></p>
        </div>
      </div>

      {/* API调用测试 */}
      <div className="bg-white p-4 rounded border">
        <h3 className="font-semibold text-gray-800 mb-2">3. API调用测试</h3>
        {testResults.apiCallTest?.success ? (
          <div className="text-sm space-y-1">
            <p className="text-green-600">✅ API调用成功</p>
            <p>返回事件数: {testResults.apiCallTest.eventCount}</p>
            <p>包含基频数据: <span className={testResults.apiCallTest.hasFrequencyData ? 'text-green-600' : 'text-red-600'}>
              {testResults.apiCallTest.hasFrequencyData ? '是' : '否'}
            </span></p>
            <p>包含附件数组: <span className={testResults.apiCallTest.hasAttachmentsArray ? 'text-green-600' : 'text-gray-600'}>
              {testResults.apiCallTest.hasAttachmentsArray ? '是' : '否'}
            </span></p>
            <p>首事件附件数: {testResults.apiCallTest.firstEventAttachmentsCount}</p>
            {testResults.apiCallTest.events && testResults.apiCallTest.events.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-blue-600">查看返回的事件数据</summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(testResults.apiCallTest.events, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ) : (
          <div className="text-sm">
            <p className="text-red-600">❌ API调用失败</p>
            <p className="text-red-600">{testResults.apiCallTest?.error}</p>
          </div>
        )}
      </div>

      {testResults.error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded">
          <h3 className="font-semibold text-red-800 mb-2">❌ 错误信息</h3>
          <p className="text-red-700 text-sm">{testResults.error}</p>
        </div>
      )}
    </div>
  );
};

export default DevModeTest;
