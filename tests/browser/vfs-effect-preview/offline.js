async page => {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const report = { mode: 'production-offline', cases: [] };
  const context = page.context();
  try {
    await context.setOffline(true);
    await page.reload();
    await page.getByRole('heading', { name: 'VFS效果预览', exact: true }).waitFor();
    await page.getByRole('tab', { name: '实时试听', exact: true }).click();
    await page.getByRole('combobox', { name: '参考基频来源', exact: true }).selectOption('manual');
    await page.getByRole('spinbutton', { name: '参考基频（Hz）', exact: true }).fill('200');
    for (const algorithm of ['soundtouch', 'rubberband']) {
      await page.getByRole('combobox', { name: '实时算法', exact: true }).selectOption(algorithm);
      await page.evaluate(() => { window.__audioQa.stats = null; });
      await page.getByRole('button', { name: '开启实时试听', exact: true }).click();
      await page.waitForFunction(() => window.__audioQa.stats?.phase === 'playing', null, { timeout: 15000 });
      await page.waitForTimeout(1000);
      const result = await page.evaluate(() => {
        const qa = window.__audioQa;
        const analyser = qa.analysers.at(-1);
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        const crossings = [];
        for (let i = 1; i < samples.length; i++) if (samples[i - 1] <= 0 && samples[i] > 0) crossings.push(i - 1 - samples[i - 1] / (samples[i] - samples[i - 1]));
        return { hz: qa.contexts.at(-1).sampleRate * (crossings.length - 1) / (crossings.at(-1) - crossings[0]),
          queueMs: qa.stats.queueMs, underruns: qa.stats.underruns };
      });
      if (Math.abs(result.hz - 250) > 3) throw new Error(`${algorithm} offline output is wrong: ${result.hz}`);
      report.cases.push({ algorithm, ...result });
      await page.getByRole('button', { name: '停止试听', exact: true }).click();
      await page.waitForTimeout(80);
    }
    const released = await page.evaluate(() => window.__audioQa.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
    if (!released) throw new Error('offline audio capture leaked');
  } finally { await context.setOffline(false); }
  return report;
}
