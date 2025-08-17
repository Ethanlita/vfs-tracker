// 在浏览器控制台运行这个脚本来测试API
// 复制粘贴到开发者工具的Console标签中执行

console.log('🧪 开始测试 /events 端点的CORS配置...');

// 测试1: OPTIONS预检请求
fetch('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/events', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'http://localhost:4173',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Content-Type,Authorization'
  }
})
.then(response => {
  console.log('✅ OPTIONS请求成功');
  console.log('📋 响应状态:', response.status);
  console.log('📋 CORS头部:');
  console.log('  - Access-Control-Allow-Origin:', response.headers.get('Access-Control-Allow-Origin'));
  console.log('  - Access-Control-Allow-Methods:', response.headers.get('Access-Control-Allow-Methods'));
  console.log('  - Access-Control-Allow-Headers:', response.headers.get('Access-Control-Allow-Headers'));

  // 测试2: 实际POST请求（无认证，预期401错误但CORS应该正常）
  return fetch('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/events', {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:4173',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'self_test',
      date: '2025-08-17',
      details: { notes: '浏览器控制台测试' }
    })
  });
})
.then(response => {
  console.log('✅ POST请求成功发送');
  console.log('📋 响应状态:', response.status, response.statusText);
  console.log('📋 CORS头部:');
  console.log('  - Access-Control-Allow-Origin:', response.headers.get('Access-Control-Allow-Origin'));
  console.log('  - Access-Control-Allow-Methods:', response.headers.get('Access-Control-Allow-Methods'));
  console.log('  - Access-Control-Allow-Headers:', response.headers.get('Access-Control-Allow-Headers'));

  if (response.status === 401) {
    console.log('✅ 收到401错误是正常的（因为没有认证）');
    console.log('🎉 CORS配置完全正确！');
  } else {
    console.log('⚠️ 意外的响应状态，但CORS头部存在说明配置正确');
  }

  return response.text();
})
.then(responseText => {
  console.log('📄 响应内容:', responseText);
})
.catch(error => {
  if (error.message.includes('CORS')) {
    console.error('❌ 仍然有CORS错误:', error.message);
    console.log('💡 建议: 清除浏览器缓存或使用无痕模式');
  } else {
    console.error('❌ 其他网络错误:', error.message);
  }
});

console.log('🕐 测试进行中，请等待结果...');
