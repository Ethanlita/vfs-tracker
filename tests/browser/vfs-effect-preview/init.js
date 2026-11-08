async page => {
  await page.addInitScript(() => {
    const qa = window.__audioQa = { contexts: [], analysers: [], streams: [], workers: [], nodes: [], errors: [], stats: null };
    window.addEventListener('error', event => qa.errors.push(event.message));
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor(...args) { super(...args); qa.contexts.push(this); }
      createAnalyser() { const analyser = super.createAnalyser(); qa.analysers.push(analyser); return analyser; }
    };
    const NativeWorklet = window.AudioWorkletNode;
    window.AudioWorkletNode = class extends NativeWorklet {
      constructor(...args) {
        super(...args); qa.nodes.push(this);
        this.port.addEventListener('message', ({ data }) => { if (data.type === 'stats') qa.stats = data; });
        this.port.start();
      }
    };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); qa.workers.push(this); }
    };
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => { const stream = await getUserMedia(constraints); qa.streams.push(stream); return stream; };
  });
  await page.reload();
  await page.getByRole('heading', { name: 'VFS效果预览', exact: true }).waitFor();
  return await page.evaluate(() => ({ title: document.title,
    disclosures: [...document.querySelectorAll('details')].map(item => ({ title: item.querySelector('summary').innerText, open: item.open })),
    tabs: [...document.querySelectorAll('[role=tab]')].map(item => item.innerText) }));
}
