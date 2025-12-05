/**
 * @typedef {Object} BeatStructure
 * @property {number} exampleBeats 示范拍数量
 * @property {number} initialRests 示范后的预备空拍数量
 * @property {number} finalRests 收尾空拍数量
 */

/**
 * @typedef {Object} PrologueStep
 * @property {'example'|'rest'} type 拍类型
 * @property {number} [count=1] 拍数
 * @property {number} [offset=0] 当 type 为 example 时可指定示范音偏移（相对基准）
 */

/**
 * @typedef {Object} ScaleMode
 * @property {string} id 模式唯一标识
 * @property {string} name 模式名称
 * @property {string} description 模式简介
 * @property {number[]} patternOffsets 音阶半音序列（相对本轮基准音）
 * @property {BeatStructure} [beatStructure] 节拍结构配置（无 prologue 时使用）
 * @property {number} [transposeStep=1] 每轮移调的半音步长
 * @property {number} [targetNoteIndex] 目标音在序列中的索引（可选）
 * @property {PrologueStep[]} [prologue] 可选：显式定义示范/空拍顺序，优先级高于 beatStructure
 */

/**
 * @typedef {Object} BeatStep
 * @property {number} index 拍序（从 0 开始）
 * @property {'example'|'rest'|'note'} type 拍类型
 * @property {number} [offset] type 为 note 或 example 时对应的半音偏移
 */

const DEFAULT_BEAT_STRUCTURE = { exampleBeats: 1, initialRests: 1, finalRests: 1 };

/**
 * @zh 归一化节拍配置，确保每个字段都有非负值。
 * @param {BeatStructure} [beatStructure] 节拍结构
 * @returns {BeatStructure} 归一化后的节拍结构
 */
const normalizeBeatStructure = (beatStructure = DEFAULT_BEAT_STRUCTURE) => ({
  exampleBeats: Math.max(0, beatStructure.exampleBeats ?? DEFAULT_BEAT_STRUCTURE.exampleBeats),
  initialRests: Math.max(0, beatStructure.initialRests ?? DEFAULT_BEAT_STRUCTURE.initialRests),
  finalRests: Math.max(0, beatStructure.finalRests ?? DEFAULT_BEAT_STRUCTURE.finalRests)
});

/**
 * @zh 根据模式配置生成拍点时间线，依次包含示范拍、空拍与音符拍。
 * @param {ScaleMode} mode 模式配置
 * @returns {BeatStep[]} 拍点描述列表
 */
export const buildBeatTimeline = (mode) => {
  if (!mode || !Array.isArray(mode.patternOffsets) || mode.patternOffsets.length === 0) {
    throw new Error('当前模式缺少音阶序列（patternOffsets），无法生成节拍。');
  }

  const timeline = [];

  const pushBlocks = (type, count = 1, offset = 0) => {
    for (let i = 0; i < count; i++) {
      timeline.push({ index: timeline.length, type, offset });
    }
  };

  if (Array.isArray(mode.prologue) && mode.prologue.length > 0) {
    mode.prologue.forEach(step => {
      pushBlocks(step.type, Math.max(1, step.count ?? 1), step.offset ?? 0);
    });
  } else {
    const beatStructure = normalizeBeatStructure(mode.beatStructure);
    pushBlocks('example', beatStructure.exampleBeats, 0);
    pushBlocks('rest', beatStructure.initialRests, 0);
  }

  mode.patternOffsets.forEach(offset => {
    pushBlocks('note', 1, offset);
  });

  const beatStructure = normalizeBeatStructure(mode.beatStructure);
  pushBlocks('rest', beatStructure.finalRests, 0);

  return timeline;
};

/**
 * @zh 计算指示器范围、参考音与目标音频率，便于复用。
 * @param {ScaleMode} mode 模式配置
 * @param {number} baseFreq 本轮基准频率
 * @param {number} semitoneRatio 半音比值
 * @param {'ascending'|'descending'} direction 练习方向
 * @param {number} [paddingCents=120] 指示器上下预留的间隔（cents）
 * @returns {{indicatorRange: {min: number, max: number}, ladderNotes: number[], targetFreq: number, minOffset: number, maxOffset: number, targetOffset: number}}
 */
export const deriveModePitchMeta = (
  mode,
  baseFreq,
  semitoneRatio,
  direction = 'ascending',
  paddingCents = 120
) => {
  if (!mode || !Array.isArray(mode.patternOffsets) || mode.patternOffsets.length === 0) {
    throw new Error('当前模式缺少音阶序列（patternOffsets），无法计算指示范围。');
  }

  const offsets = mode.patternOffsets;
  const minOffset = Math.min(...offsets, 0);
  const maxOffset = Math.max(...offsets, 0);

  const padRatio = Math.pow(2, paddingCents / 1200);
  const indicatorRange = {
    min: baseFreq * Math.pow(semitoneRatio, minOffset) / padRatio,
    max: baseFreq * Math.pow(semitoneRatio, maxOffset) * padRatio
  };

  const uniqueOffsets = Array.from(new Set([0, ...offsets])).sort((a, b) => a - b);
  const ladderNotes = uniqueOffsets.map(offset => baseFreq * Math.pow(semitoneRatio, offset));

  const hasTargetIndex = typeof mode.targetNoteIndex === 'number' && offsets[mode.targetNoteIndex] !== undefined;
  const targetOffset = hasTargetIndex
    ? offsets[mode.targetNoteIndex]
    : direction === 'ascending'
      ? maxOffset
      : minOffset;

  const targetFreq = baseFreq * Math.pow(semitoneRatio, targetOffset);

  return {
    indicatorRange,
    ladderNotes,
    targetFreq,
    minOffset,
    maxOffset,
    targetOffset
  };
};
