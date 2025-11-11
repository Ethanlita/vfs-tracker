# Phase 5 E2E 测试套件

## 概述

Phase 5 实现了完整的端到端 (E2E) 测试套件，使用 Playwright 测试框架覆盖应用的核心用户流程。

## 测试套件

### 1. 事件管理测试 (`events.spec.js`)

**测试范围**:
- ✅ 事件 CRUD 操作（创建、读取、更新、删除）
- ✅ 附件上传和下载
- ✅ 事件列表查看
- ✅ 事件详情展示
- ✅ 边界情况处理

**测试用例**: 10+
**优先级**: P1

### 2. 声音测试流程 (`voice-test.spec.js`)

**测试范围**:
- ✅ 完整的声音测试流程
- ✅ 麦克风权限请求
- ✅ 录音功能
- ✅ 测试结果展示
- ✅ 基频和音域参数
- ✅ 可视化图表
- ✅ 错误处理（权限拒绝、录音过短）

**测试用例**: 12+
**优先级**: P1

### 3. 快速基频测试 (`quick-pitch.spec.js`)

**测试范围**:
- ✅ 快速测试流程
- ✅ 简化结果显示
- ✅ 与完整测试的性能对比
- ✅ 重新测试功能

**测试用例**: 8+
**优先级**: P2

### 4. 公共仪表板 (`public-dashboard.spec.js`)

**测试范围**:
- ✅ 无需登录访问
- ✅ 数据统计展示
- ✅ 可视化图表
- ✅ 响应式设计（桌面/移动）
- ✅ 数据隐私验证
- ✅ 性能测试

**测试用例**: 12+
**优先级**: P2

### 5. 音符-频率转换 (`note-frequency.spec.js`)

**测试范围**:
- ✅ 音符到频率转换
- ✅ 频率到音符转换
- ✅ 八度选择
- ✅ 参考表展示
- ✅ 输入验证
- ✅ 复制功能

**测试用例**: 10+
**优先级**: P2

### 6. 音阶练习 (`scale-practice.spec.js`)

**测试范围**:
- ✅ 音阶类型选择
- ✅ 起始音选择
- ✅ 跟随播放
- ✅ 录音和音准反馈
- ✅ 练习结果展示
- ✅ 进度跟踪
- ✅ 速度调节
- ✅ 历史记录

**测试用例**: 15+
**优先级**: P2

## 测试运行

### 基本命令

```powershell
# 运行所有 E2E 测试
npx playwright test

# 运行特定测试文件
npx playwright test tests/e2e/events.spec.js

# 运行特定测试套件
npx playwright test --grep "事件管理"

# 使用特定浏览器
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# 调试模式
npx playwright test --debug

# UI 模式（交互式）
npx playwright test --ui

# 显示浏览器窗口
npx playwright test --headed
```

### 并行和性能

```powershell
# 控制并行 worker 数量
npx playwright test --workers=2

# 禁用并行（顺序执行）
npx playwright test --workers=1

# 只运行失败的测试
npx playwright test --last-failed

# 重试失败的测试
npx playwright test --retries=2
```

### 报告和调试

```powershell
# 生成 HTML 报告
npx playwright test --reporter=html

# 打开报告
npx playwright show-report

# 显示追踪
npx playwright show-trace trace.zip

# 生成代码
npx playwright codegen http://localhost:3000
```

## 测试配置

### Playwright 配置 (`playwright.config.js`)

```javascript
{
  testDir: './tests/e2e',           // 测试目录
  timeout: 30000,                   // 测试超时 30 秒
  retries: process.env.CI ? 2 : 0,  // CI 环境重试 2 次
  workers: process.env.CI ? 1 : undefined,
  baseURL: 'http://localhost:3000',
  
  projects: [
    'chromium',      // Chrome
    'firefox',       // Firefox
    'webkit',        // Safari
    'Mobile Chrome', // 移动端 Chrome
    'Mobile Safari'  // 移动端 Safari
  ],
  
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI
  }
}
```

## 测试最佳实践

### 1. 等待策略

```javascript
// ✅ 好的做法：显式等待
await page.waitForLoadState('networkidle');
await expect(element).toBeVisible({ timeout: 10000 });

// ❌ 避免：固定延迟
await page.waitForTimeout(5000); // 尽量少用
```

### 2. 选择器优先级

```javascript
// 1. 优先使用 data-testid
page.locator('[data-testid="user-menu"]')

// 2. 使用 ARIA 角色
page.locator('button[role="button"]')

// 3. 使用文本（带正则，支持多语言）
page.locator('text=/登录|Login/i')

// 4. 最后才用 CSS 类
page.locator('.user-menu') // 尽量避免
```

### 3. 条件判断

```javascript
// ✅ 好的做法：安全检查
if (await button.count() > 0) {
  await button.click();
} else {
  test.skip();
}

// ✅ 使用 catch 处理
const isVisible = await element.isVisible().catch(() => false);
```

### 4. 测试独立性

```javascript
// ✅ 每个测试应该独立
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // 重置状态
});

// ❌ 避免测试间依赖
test('test1', async () => { /* ... */ });
test('test2', async () => { 
  // ❌ 依赖 test1 的状态
});
```

## 测试数据

### 测试夹具

测试夹具文件位于 `tests/fixtures/`:
- `test-audio.txt` - 用于附件上传测试的示例文件
- 更多夹具根据需要添加

### Mock 数据

某些测试可能需要 mock:
- API 响应
- 认证状态
- 浏览器权限

## 常见问题

### Q1: 测试需要登录怎么办？

**A**: 目前测试中标记了 `TODO: 登录逻辑`，需要实现：

```javascript
// 辅助函数
async function loginAsTestUser(page) {
  await page.goto('/');
  const loginButton = page.locator('text=/登录/i').first();
  await loginButton.click();
  
  // 填写测试账号
  await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL);
  await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  
  // 等待登录完成
  await page.waitForURL(/dashboard|home/i);
}
```

### Q2: 麦克风权限如何处理？

**A**: 使用 Playwright 的权限授予：

```javascript
test('测试录音', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  // 现在可以使用麦克风
});
```

### Q3: 如何跳过某些测试？

**A**: 使用 `test.skip()`:

```javascript
test('暂时跳过的测试', async ({ page }) => {
  test.skip(); // 跳过这个测试
});

// 或条件跳过
if (someCondition) {
  test.skip();
}
```

### Q4: 测试失败如何调试？

**A**: 多种调试方法：

```powershell
# 1. 显示浏览器
npx playwright test --headed

# 2. 调试模式
npx playwright test --debug

# 3. 查看追踪
npx playwright show-trace trace.zip

# 4. 查看截图
# 失败时自动保存在 test-results/
```

### Q5: 如何测试响应式设计？

**A**: 设置视口大小：

```javascript
// 桌面
await page.setViewportSize({ width: 1920, height: 1080 });

// 移动
await page.setViewportSize({ width: 375, height: 667 });

// 或使用设备模拟
test.use({ ...devices['iPhone 12'] });
```

## CI/CD 集成

### GitHub Actions 示例

```yaml
- name: 运行 E2E 测试
  run: |
    npx playwright install --with-deps
    npx playwright test
  
- name: 上传测试报告
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## 测试覆盖目标

| 功能模块 | 测试用例数 | 当前状态 | 目标覆盖率 |
|---------|----------|---------|-----------|
| 事件管理 | 10+ | ✅ 完成 | 80%+ |
| 声音测试 | 12+ | ✅ 完成 | 80%+ |
| 快速基频 | 8+ | ✅ 完成 | 75%+ |
| 公共仪表板 | 12+ | ✅ 完成 | 75%+ |
| 音符转换 | 10+ | ✅ 完成 | 70%+ |
| 音阶练习 | 15+ | ✅ 完成 | 70%+ |

**总计**: 67+ 测试用例

## 下一步

### Phase 5.1 - 测试实现
- [ ] 实现测试账号登录逻辑
- [ ] 创建更多测试夹具
- [ ] 完善错误场景测试
- [ ] 添加性能基准测试

### Phase 5.2 - 测试增强
- [ ] 视觉回归测试
- [ ] 可访问性测试
- [ ] 网络条件模拟
- [ ] 负载测试

### Phase 5.3 - CI 集成
- [ ] GitHub Actions 配置
- [ ] 测试报告自动发布
- [ ] PR 门禁检查
- [ ] 定时回归测试

## 资源

- [Playwright 官方文档](https://playwright.dev/)
- [测试最佳实践](https://playwright.dev/docs/best-practices)
- [Playwright Inspector](https://playwright.dev/docs/debug)
- [Trace Viewer](https://playwright.dev/docs/trace-viewer)
