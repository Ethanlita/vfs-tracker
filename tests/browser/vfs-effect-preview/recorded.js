async page => {
  const report = { mode: page.url().includes(':4174') ? 'production' : 'development', cases: [] };
  await page.evaluate(() => {
    const qa = window.__audioQa;
    qa.blobs = [];
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { qa.blobs.push(blob); return create(blob); };
  });
  await page.getByRole('button', { name: '开始录音', exact: true }).click();
  await page.getByRole('button', { name: '停止录音且继续', exact: true }).waitFor();
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: '停止录音且继续', exact: true }).click();
  await page.getByRole('button', { name: /处理音频/ }).waitFor();
  await page.waitForFunction(() => !document.querySelector('#recorded-pitch-shift')?.disabled);
  await page.getByRole('spinbutton', { name: '录音参考基频（Hz）', exact: true }).fill('200');
  await page.getByRole('slider', { name: /^音高变化量/ }).fill('50');
  for (const algorithm of ['SoundTouch', 'RubberBand', 'TD-PSOLA', 'WORLD Vocoder']) {
    const selection = page.getByRole('button', { name: new RegExp(`^${algorithm}`) });
    await selection.click();
    await page.getByRole('button', { name: /处理音频/ }).click();
    const play = page.getByRole('button', { name: `播放 ${algorithm}`, exact: true });
    await play.waitFor({ timeout: 30000 });
    await play.click();
    const measured = await page.evaluate(async () => {
      const blob = window.__audioQa.blobs.at(-1);
      const context = new AudioContext();
      try {
        const audio = await context.decodeAudioData(await blob.arrayBuffer());
        const data = audio.getChannelData(0);
        const crossings = [];
        for (let i = Math.floor(data.length * 0.2) + 1; i < data.length * 0.8; i++) {
          if (data[i - 1] <= 0 && data[i] > 0) crossings.push(i - 1 - data[i - 1] / (data[i] - data[i - 1]));
        }
        return { hz: audio.sampleRate * (crossings.length - 1) / (crossings.at(-1) - crossings[0]),
          duration: audio.duration, sampleRate: audio.sampleRate, bytes: blob.size };
      } finally { await context.close(); }
    });
    if (measured.bytes < 1000 || !Number.isFinite(measured.hz)) throw new Error(`${algorithm}: invalid output WAV`);
    if (['SoundTouch', 'RubberBand', 'WORLD Vocoder'].includes(algorithm) && Math.abs(measured.hz - 250) > 4) throw new Error(`${algorithm}: expected 250 Hz, got ${measured.hz}`);
    report.cases.push({ algorithm, ...measured });
    const stop = page.getByRole('button', { name: '停止播放', exact: true });
    if (await stop.isVisible()) await stop.click();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'output/playwright/vfs-recorded-desktop.png', fullPage: true });
  await page.getByRole('slider', { name: /^音高变化量/ }).fill('60');
  if (await page.getByRole('button', { name: '播放 SoundTouch', exact: true }).count()) throw new Error('stale SoundTouch result was retained');
  if (await page.getByRole('button', { name: '播放 RubberBand', exact: true }).count()) throw new Error('stale RubberBand result was retained');
  report.cases.push({ label: 'parameter change invalidates all previous outputs', passed: true });
  return report;
}
