async page => {
  const report = { cases: [], mode: page.url().includes(':4174') ? 'production' : 'development', fakeMicrophoneHz: 200 };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const frequency = () => page.evaluate(() => {
    const q = window.__audioQa;
    const analyser = q.analysers.at(-1);
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    const crossings = [];
    let energy = 0;
    for (let i = 1; i < samples.length; i++) {
      energy += samples[i] ** 2;
      if (samples[i - 1] <= 0 && samples[i] > 0) crossings.push(i - 1 - samples[i - 1] / (samples[i] - samples[i - 1]));
    }
    return { hz: q.contexts.at(-1).sampleRate * (crossings.length - 1) / (crossings.at(-1) - crossings[0]),
      rms: Math.sqrt(energy / samples.length), stats: q.stats ? {
        phase: q.stats.phase, queueMs: q.stats.queueMs, underruns: q.stats.underruns,
        overruns: q.stats.overruns, overloads: q.stats.overloads,
        pendingInputFrames: q.stats.pendingInputFrames, inputLimitFrames: q.stats.inputLimitFrames,
      } : null, errors: q.errors };
  });
  const checkTone = async (expected, label) => {
    await page.waitForFunction(() => window.__audioQa.stats?.phase === 'playing', null, { timeout: 15000 });
    await page.waitForTimeout(1300);
    const measured = await frequency();
    assert(Math.abs(measured.hz - expected) < 3, `${label}: expected ${expected} Hz, got ${measured.hz}`);
    assert(measured.rms > 0.01, `${label}: output is silent`);
    assert(measured.stats.queueMs <= 400 && measured.stats.pendingInputFrames <= measured.stats.inputLimitFrames, 'unbounded audio queue');
    report.cases.push({ label, expected, ...measured });
  };
  // 原生 summary 由真实浏览器点击，验证三个说明分别展开且可再次收起。
  for (const [index, title] of ['提示', '原理说明', '免责声明'].entries()) {
    const summary = page.locator('details summary').nth(index);
    await summary.click();
    assert(await page.locator('details').nth(index).evaluate(item => item.open), `disclosure ${title} did not open`);
    await summary.click();
    assert(!(await page.locator('details').nth(index).evaluate(item => item.open)), `disclosure ${title} did not close`);
  }
  report.cases.push({ label: 'three independent collapsed disclosures', passed: true });
  await page.getByRole('tab', { name: '实时试听', exact: true }).click();
  await page.getByRole('combobox', { name: '参考基频来源', exact: true }).selectOption('auto');
  await page.getByRole('slider', { name: /^音高变化量/ }).fill('50');
  await page.getByRole('button', { name: '开启实时试听', exact: true }).click();
  await checkTone(250, 'SoundTouch automatic calibration +50 Hz');
  assert((await page.locator('section[aria-label="实时试听"]').innerText()).includes('参考 200 Hz'), 'calibration reference is not 200 Hz');
  await page.getByRole('slider', { name: /^音高变化量/ }).fill('70');
  await checkTone(270, 'SoundTouch dynamic +70 Hz');
  await page.getByRole('slider', { name: /^音高变化量/ }).fill('0');
  await checkTone(200, 'SoundTouch zero shift');
  await page.getByRole('button', { name: '停止试听', exact: true }).click();
  await page.waitForTimeout(80);
  assert(await page.evaluate(() => window.__audioQa.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended'))), 'SoundTouch microphone still active');
  await page.getByRole('combobox', { name: '实时算法', exact: true }).selectOption('rubberband');
  await page.getByRole('combobox', { name: '参考基频来源', exact: true }).selectOption('manual');
  await page.getByRole('spinbutton', { name: '参考基频（Hz）', exact: true }).fill('200');
  await page.getByRole('slider', { name: /^音高变化量/ }).fill('50');
  await page.evaluate(() => { window.__audioQa.stats = null; });
  await page.getByRole('button', { name: '开启实时试听', exact: true }).click();
  await checkTone(250, 'RubberBand real-time +50 Hz');
  await page.getByRole('slider', { name: /^音高变化量/ }).fill('100');
  await checkTone(300, 'RubberBand dynamic +100 Hz');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'output/playwright/vfs-live-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'output/playwright/vfs-live-mobile.png', fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile horizontal overflow');
  await page.getByRole('tab', { name: '录音对比', exact: true }).click();
  await page.waitForTimeout(80);
  assert(await page.evaluate(() => window.__audioQa.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')) && window.__audioQa.contexts.every(context => context.state === 'closed')), 'mode switch leaked live resources');
  report.cases.push({ label: 'stop, mode switch, desktop and mobile rendering', passed: true });
  await page.setViewportSize({ width: 1280, height: 960 });
  return report;
}
