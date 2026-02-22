/**
 * 手动超时测试脚本
 * 用于验证 timeout.js 和 api.js 的超时功能
 * 
 * 使用方法:
 * 1. 在浏览器控制台运行此脚本
 * 2. 或者在开发模式下导入此文件
 */

// 测试配置
const TEST_USER_ID = 'test-user-123';
const SLOW_API_DELAY = 10000; // 10秒延迟,应该触发超时

// 模拟慢速 API 响应
async function simulateSlowApi() {
  console.log('🧪 [超时测试] 模拟慢速 API 响应...');
  let startTime = Date.now();
  
  // 这个请求应该在 8 秒后超时
  try {
    console.log('📤 [超时测试] 发起 getUserProfile 请求 (预期8秒超时)...');
    startTime = Date.now();
    
    // 假设使用真实 API (需要在实际环境中测试)
    // const result = await getUserProfile(TEST_USER_ID);
    
    // 在测试环境中,我们可以检查超时配置
    const { getTimeout } = await import('../../src/utils/timeout.js');
    const timeout = getTimeout(`/user/${TEST_USER_ID}`);
    console.log(`⏱️  [超时测试] 配置的超时时间: ${timeout}ms (${timeout/1000}秒)`);
    
    // 模拟等待超过超时时间
    await new Promise(resolve => setTimeout(resolve, timeout + 1000));
    
    console.log('❌ [超时测试] 失败: 请求没有超时!');
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error.code === 'TIMEOUT') {
      console.log('✅ [超时测试] 成功: 请求正确超时');
      console.log(`⏱️  [超时测试] 耗时: ${duration}ms`);
      console.log('📋 [超时测试] 错误详情:', {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        timeout: error.timeout,
        details: error.details
      });
    } else {
      console.log('❌ [超时测试] 失败: 未知错误类型');
      console.error(error);
    }
  }
}

// 测试不同端点的超时配置
async function testTimeoutConfiguration() {
  console.log('\n🧪 [配置测试] 测试不同端点的超时配置...\n');
  
  const { getTimeout } = await import('../../src/utils/timeout.js');
  
  const testCases = [
    { path: '/user/123', expectedTimeout: 8000, description: '用户档案' },
    { path: '/user/public/123', expectedTimeout: 8000, description: '公开档案' },
    { path: '/events/user123', expectedTimeout: 8000, description: '用户事件' },
    { path: '/all-events', expectedTimeout: 34000, description: '所有公开事件' },
    { path: '/song-recommendations', expectedTimeout: 34000, description: '歌曲推荐' },
    { path: '/upload-url', expectedTimeout: 305000, description: '文件上传' },
    { path: '/unknown-endpoint', expectedTimeout: 8000, description: '未知端点(默认)' }
  ];
  
  console.table(testCases.map(test => ({
    '端点': test.path,
    '描述': test.description,
    '预期超时': `${test.expectedTimeout}ms`,
    '实际超时': `${getTimeout(test.path)}ms`,
    '匹配': getTimeout(test.path) === test.expectedTimeout ? '✅' : '❌'
  })));
}

// 测试超时错误检测
async function testTimeoutErrorDetection() {
  console.log('\n🧪 [错误检测测试] 测试超时错误检测...\n');
  
  const { isTimeoutError } = await import('../../src/utils/timeout.js');
  const { ApiError } = await import('../../src/utils/apiError.js');
  
  // 创建各种错误类型
  const timeoutError = new ApiError('请求超时', {
    code: 'TIMEOUT',
    statusCode: 408,
    timeout: 8000
  });
  
  const networkError = new ApiError('网络错误', {
    code: 'NETWORK_ERROR',
    statusCode: 0
  });
  
  const serverError = new ApiError('服务器错误', {
    code: 'INTERNAL_ERROR',
    statusCode: 500
  });
  
  console.log('超时错误检测:', isTimeoutError(timeoutError) ? '✅ 正确' : '❌ 错误');
  console.log('网络错误检测:', !isTimeoutError(networkError) ? '✅ 正确' : '❌ 错误');
  console.log('服务器错误检测:', !isTimeoutError(serverError) ? '✅ 正确' : '❌ 错误');
}

// 运行所有测试
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('           VFS Tracker 超时功能测试套件');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    await testTimeoutConfiguration();
    await testTimeoutErrorDetection();
    // await simulateSlowApi(); // 需要真实环境
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('                    测试完成');
    console.log('═══════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ 测试套件执行失败:', error);
  }
}

// 导出测试函数
export {
  simulateSlowApi,
  testTimeoutConfiguration,
  testTimeoutErrorDetection,
  runAllTests
};

// 如果直接运行,执行所有测试
if (typeof window !== 'undefined' && !window.__TIMEOUT_TESTS_LOADED__) {
  window.__TIMEOUT_TESTS_LOADED__ = true;
  window.timeoutTests = {
    simulateSlowApi,
    testTimeoutConfiguration,
    testTimeoutErrorDetection,
    runAllTests
  };
  console.log('💡 提示: 在控制台运行 window.timeoutTests.runAllTests() 来执行测试');
}
