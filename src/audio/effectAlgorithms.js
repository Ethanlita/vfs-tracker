/** @file 效果预览算法目录；选择器、缓存和结果卡片共用这份定义。 */
export const EFFECT_ALGORITHMS = Object.freeze([
  { id: 'soundtouch', name: 'SoundTouch', description: 'WSOLA 与重采样，支持实时试听；音色会随变调变化', live: true },
  { id: 'rubberband', name: 'RubberBand', description: 'WASM 音高变换，支持录音对比和实时试听', live: true },
  { id: 'td-psola', name: 'TD-PSOLA', description: '基于音高周期的时域重叠合成', live: false },
  { id: 'world', name: 'WORLD Vocoder', description: '分析基频、频谱包络和非周期成分后重新合成', live: false },
]);

/** 创建互不共享的空结果缓存。 */
export const emptyEffectResults = () => Object.fromEntries(EFFECT_ALGORITHMS.map(({ id }) => [id, null]));

/** 获取已登记算法，未知值必须显式报错。 */
export function getEffectAlgorithm(id) {
  const algorithm = EFFECT_ALGORITHMS.find(item => item.id === id);
  if (!algorithm) throw new Error(`未知的音频算法：${id}`);
  return algorithm;
}
