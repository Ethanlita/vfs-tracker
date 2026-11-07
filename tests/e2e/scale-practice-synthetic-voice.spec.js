/**
 * @file 音阶练习：合成歌手端到端测试。
 * @description 用 Web Audio 振荡器替代麦克风，按页面显示的拍号「跟唱」并整体延迟 220 ms，
 * 在真实浏览器里验证：固定间隔检测、整轮采集 + 尾段、延迟估计与换音点对齐、BPM 设置、
 * 判定方式自动切换、音高轨迹画到一轮结束（不在中途冻结），以及结果页「再来一次」直接回到设置页。
 * 合成正弦波只证明算法与时序链路，不代表真实人声与真实麦克风的声学准确性。
 */
import { test, expect } from '@playwright/test';

/** 合成歌手相对拍点开始的延迟（模拟设备延迟 + 听到再跟唱的反应时间）。 */
const SINGER_LAG_MS = 220;

/**
 * 注入合成歌手：getUserMedia 返回振荡器音频流；监听页面上的「第N/M拍 …」标签，
 * 练习拍在延迟后唱对应音高，示范 / 空拍在延迟后静音；校准阶段唱 220 Hz。
 * @param {import('@playwright/test').Page} page 页面
 */
async function installSyntheticSinger(page) {
  await page.addInitScript(({ lagMs }) => {
    // 离线：跳过钢琴音色下载，示范音改用本地振荡器
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false });
    const SEMITONES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    const noteToFreq = (name) => {
      const match = /^([A-G]#?)(-?\d+)$/.exec(name);
      const midi = (Number(match[2]) + 1) * 12 + SEMITONES[match[1]];
      return 440 * Math.pow(2, (midi - 69) / 12);
    };
    let voice = null;
    const sing = (freq) => {
      if (!voice) return;
      const t = voice.ctx.currentTime;
      if (freq) voice.osc.frequency.setValueAtTime(freq, t);
      voice.gain.gain.setValueAtTime(freq ? 0.3 : 0, t);
    };
    // 记录麦克风申请次数，供「再来一次」测试确认重新打开了麦克风
    window.__gumCalls = 0;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          window.__gumCalls += 1;
          const ctx = new AudioContext();
          await ctx.resume();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0;
          const dest = ctx.createMediaStreamDestination();
          osc.connect(gain).connect(dest);
          osc.start();
          voice = { ctx, osc, gain };
          return dest.stream;
        }
      }
    });

    let lastKey = '';
    let pending = [];
    const schedule = (fn, delay) => pending.push(setTimeout(fn, delay));
    const follow = () => {
      const calibrating = [...document.querySelectorAll('p')].some(p => p.textContent === '正在录音...');
      const beatText = [...document.querySelectorAll('p')]
        .map(p => p.textContent)
        .find(text => /^第\d+\/\d+拍/.test(text));
      const key = calibrating ? 'calibrating' : beatText ?? 'idle';
      if (key === lastKey) return;
      lastKey = key;
      pending.forEach(clearTimeout);
      pending = [];
      if (calibrating) {
        sing(220);
        return;
      }
      const label = /^第\d+\/\d+拍 (\S+)(?: (\S+))?/.exec(beatText ?? '');
      if (label && label[1] === '练习') {
        schedule(() => sing(noteToFreq(label[2])), lagMs);
        // 标签 650 ms 内没有再变化（最后一个音）就收声，模拟自然结束
        schedule(() => sing(0), lagMs + 650);
      } else {
        schedule(() => sing(0), label ? lagMs : 0);
      }
    };
    new MutationObserver(follow).observe(document, { subtree: true, childList: true, characterData: true });
  }, { lagMs: SINGER_LAG_MS });
}

/**
 * 走完权限 → 耳机检测 → 校准，停在设置页，并展开诊断面板。
 * @param {import('@playwright/test').Page} page 页面
 */
async function reachSetup(page) {
  await page.goto('/scale-practice');
  await page.getByRole('button', { name: '显示诊断日志（用于排查检测问题）' }).click();
  await page.getByRole('button', { name: '我已知晓，开始' }).click();
  await page.getByRole('button', { name: '进入耳机检测' }).click();
  await page.getByRole('button', { name: '开始录音' }).click({ timeout: 15000 });
  await expect(page.getByRole('button', { name: '开始练习' })).toBeVisible({ timeout: 15000 });
}

/** 读取诊断面板中上一轮判定的摘要行。 */
const lastJudgeLine = page => page.locator('div', { hasText: /^方式=/ }).last();

test.describe('音阶练习合成歌手', () => {
  test.setTimeout(90000);

  test('每音 600 ms 时晚 220 ms 跟唱仍通过稳定判定，轨迹画到一轮末尾', async ({ page }) => {
    await installSyntheticSinger(page);
    await reachSetup(page);
    await expect(page.getByTestId('scale-judge-regime')).toContainText('稳定保持');
    await expect(page.getByText(/一轮约/)).toContainText('每个音 600 ms');

    await page.getByRole('button', { name: '开始练习' }).click();

    // 一轮最后一拍时轨迹应已接近右端：旧实现会在约 320 个点后停止绘制
    await expect(page.getByText(/^第8\/8拍/)).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(350);
    const maxX = await page.locator('polyline').evaluate(line => Math.max(
      ...line.getAttribute('points').trim().split(/\s+/).map(pair => Number(pair.split(',')[0]))
    ));
    expect(maxX).toBeGreaterThan(80);

    await expect(lastJudgeLine(page)).toContainText('通过', { timeout: 15000 });
    await expect(lastJudgeLine(page)).toContainText('方式=稳定保持');
    const lag = Number(/估计总延迟（设备\+跟唱）=(-?\d+)ms/.exec(await lastJudgeLine(page).textContent())[1]);
    expect(lag).toBeGreaterThanOrEqual(150);
    expect(lag).toBeLessThanOrEqual(350);
    await expect(page.getByRole('button', { name: '强制通过', exact: true })).toHaveCount(0);
  });

  test('九度回转调到 160 BPM 后自动改为走势判定，晚 220 ms 跟唱仍通过', async ({ page }, testInfo) => {
    await installSyntheticSinger(page);
    await reachSetup(page);
    await page.getByRole('combobox').first().selectOption('turnback_123454321');
    await page.getByLabel(/速度/).fill('160');
    await expect(page.getByText(/一轮约/)).toContainText('每个音 375 ms');
    await expect(page.getByTestId('scale-judge-regime')).toContainText('只看音高走势');
    // 留存设置页速度区块截图，供人工检查桌面 / 手机布局
    await testInfo.attach('setup-tempo', {
      body: await page.locator('div.bg-white', { has: page.getByLabel(/速度/) }).first().screenshot(),
      contentType: 'image/png'
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: '开始练习' }).click();
    await expect(lastJudgeLine(page)).toContainText('通过', { timeout: 20000 });
    await expect(lastJudgeLine(page)).toContainText('方式=只看走势');
    await expect(page.getByRole('button', { name: '强制通过', exact: true })).toHaveCount(0);
  });

  test('练完后「再来一次」跳过耳机检测与校准，直接回到设置页并再练一轮通过', async ({ page }, testInfo) => {
    await installSyntheticSinger(page);
    await reachSetup(page);
    await page.getByRole('button', { name: '开始练习' }).click();
    await expect(lastJudgeLine(page)).toContainText('通过', { timeout: 15000 });
    await page.getByRole('button', { name: '结束练习并查看结果' }).click();
    await expect(page.getByText(/^最高音：.*Hz/)).toBeVisible();
    // 留存结果页按钮区截图，供人工检查桌面 / 手机布局
    await testInfo.attach('result-actions', {
      body: await page.locator('div.bg-white', { has: page.getByRole('button', { name: '再来一次' }) }).first().screenshot(),
      contentType: 'image/png'
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: '再来一次' }).click();
    // 不经过权限说明、耳机检测与「开始录音」校准，直接到设置页
    await expect(page.getByRole('button', { name: '开始练习' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '进入耳机检测' })).toHaveCount(0);
    expect(await page.evaluate(() => window.__gumCalls)).toBe(2);
    // 上一次的判定记录已清空
    await expect(page.locator('div', { hasText: /^方式=/ })).toHaveCount(0);

    await page.getByRole('button', { name: '开始练习' }).click();
    await expect(lastJudgeLine(page)).toContainText('通过', { timeout: 15000 });
    await expect(lastJudgeLine(page)).toContainText('方式=稳定保持');
    await page.getByRole('button', { name: '结束练习并查看结果' }).click();
    await expect(page.getByText(/^最高音：.*Hz/)).toBeVisible();
  });
});
