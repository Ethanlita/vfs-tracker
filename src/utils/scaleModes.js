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
 * @property {number} defaultBpm 默认速度（♩ = BPM，四分音符每分钟拍数），用户可在设置页调整
 * @property {'quarter'|'eighth'|'sixteenth'} noteValue 时间线上「一拍」的时值
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

/**
 * @zh 每种音符时值相对四分音符的倍数。BPM 一律按四分音符计（♩ = BPM），
 * 模式的 noteValue 决定时间线上「一拍」是几分音符。
 */
export const NOTE_VALUE_FACTORS = {
  quarter: 1, // 四分音符
  eighth: 0.5, // 八分音符
  sixteenth: 0.25 // 十六分音符
};

/** @zh 各时值的中文名，用于界面展示。 */
export const NOTE_VALUE_LABELS = {
  quarter: '四分音符',
  eighth: '八分音符',
  sixteenth: '十六分音符'
};

/** @zh 用户可设置的速度范围（♩ = BPM）。 */
export const BPM_RANGE = { min: 40, max: 160 };

/**
 * @zh 把任意输入规整为合法 BPM（四舍五入到整数并夹在 BPM_RANGE 内）。
 * @param {number} bpm 原始 BPM
 * @returns {number} 合法 BPM
 */
export const clampBpm = (bpm) => Math.min(BPM_RANGE.max, Math.max(BPM_RANGE.min, Math.round(bpm)));

/**
 * @zh 校验模式的速度配置：每个模式都必须声明 defaultBpm 与 noteValue。
 * @param {ScaleMode} mode 模式配置
 * @throws {Error} 缺少或非法时抛出，提示补全配置
 */
const assertTempoConfig = (mode) => {
  if (!Object.prototype.hasOwnProperty.call(NOTE_VALUE_FACTORS, mode?.noteValue)) {
    throw new Error(`模式「${mode?.name ?? mode?.id ?? '未命名'}」缺少合法的 noteValue（quarter / eighth / sixteenth）。`);
  }
  const bpm = mode.defaultBpm;
  if (!Number.isFinite(bpm) || bpm < BPM_RANGE.min || bpm > BPM_RANGE.max) {
    throw new Error(`模式「${mode.name ?? mode.id}」的 defaultBpm 必须在 ${BPM_RANGE.min}–${BPM_RANGE.max} 之间。`);
  }
};

/**
 * @zh 计算给定速度与时值下「一拍」的毫秒数：60000 / BPM × 时值倍数。
 * @param {number} bpm 速度（♩ = BPM）
 * @param {'quarter'|'eighth'|'sixteenth'} noteValue 一拍的时值
 * @returns {number} 每拍毫秒数
 */
export const computeBeatMs = (bpm, noteValue) => {
  const factor = NOTE_VALUE_FACTORS[noteValue];
  if (!factor) throw new Error(`未知的音符时值：${noteValue}`);
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Error(`BPM 必须为正数，收到：${bpm}`);
  return (60000 / bpm) * factor;
};

/**
 * @zh 规划一轮练习的节拍：时间线补齐到 4 拍的整数倍（补空拍），每拍时长由用户速度与模式时值决定。
 * 不再为了「塞进两个全音符」自动缩短时值——速度完全由 BPM 控制，拍数多的模式一轮就更长。
 * @param {ScaleMode} mode 模式配置（必须包含 defaultBpm 与 noteValue）
 * @param {number} bpm 本次使用的速度（♩ = BPM），通常来自用户设置或 mode.defaultBpm
 * @returns {{ timeline: BeatStep[], beatMs: number, beatUnit: 'quarter'|'eighth'|'sixteenth', beatsPerMeasure: number }}
 */
export const planBeatSchedule = (mode, bpm) => {
  const timeline = buildBeatTimeline(mode);
  assertTempoConfig(mode);
  const beatsPerMeasure = 4;
  const paddedBeats = Math.ceil(timeline.length / beatsPerMeasure) * beatsPerMeasure;
  const beatMs = computeBeatMs(bpm, mode.noteValue);

  const paddedTimeline = [...timeline];
  while (paddedTimeline.length < paddedBeats) {
    paddedTimeline.push({ index: paddedTimeline.length, type: 'rest', offset: 0 });
  }

  return {
    timeline: paddedTimeline,
    beatMs,
    beatUnit: mode.noteValue,
    beatsPerMeasure
  };
};

/**
 * @zh 取得浏览器 localStorage。部分沙箱 iframe / 隐私模式下访问属性本身就会抛错，此时返回 undefined。
 * @returns {Storage|undefined} 可用的存储对象
 */
export const getBrowserStorage = () => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

/** @zh 本地存储键：记住用户为每个模式设置的速度。 */
export const BPM_STORAGE_KEY = 'vfs-tracker:scale-practice:bpm-by-mode';

/**
 * @zh 读取用户为各模式保存的速度。存储不可用或内容损坏时返回空对象（只影响「记住上次速度」这一便利功能）。
 * @param {Storage|undefined} storage 一般传 window.localStorage
 * @returns {Record<string, number>} 模式 id → BPM
 */
export const loadSavedBpmMap = (storage) => {
  try {
    const parsed = JSON.parse(storage?.getItem(BPM_STORAGE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => Number.isFinite(value))
        .map(([id, value]) => [id, clampBpm(value)])
    );
  } catch {
    return {};
  }
};

/**
 * @zh 保存各模式的速度。写入失败（隐私模式、配额满）时静默忽略。
 * @param {Storage|undefined} storage 一般传 window.localStorage
 * @param {Record<string, number>} bpmMap 模式 id → BPM
 */
export const saveBpmMap = (storage, bpmMap) => {
  try {
    storage?.setItem(BPM_STORAGE_KEY, JSON.stringify(bpmMap));
  } catch {
    // 存储不可用只会让下次进入时回到模式默认速度
  }
};
