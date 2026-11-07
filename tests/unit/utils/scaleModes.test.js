/**
 * 单元测试：src/utils/scaleModes.js
 * 
 * 覆盖节拍生成与模式元信息推导逻辑，确保多模式配置可用。
 */
import { describe, it, expect } from 'vitest';
import {
  BPM_RANGE,
  BPM_STORAGE_KEY,
  buildBeatTimeline,
  clampBpm,
  computeBeatMs,
  deriveModePitchMeta,
  loadSavedBpmMap,
  planBeatSchedule,
  saveBpmMap
} from '../../../src/utils/scaleModes.js';
import modesConfig from '../../../src/config/scaleModes.json';

describe('scaleModes.js 单元测试', () => {
  it('按节拍配置生成完整的拍点时间线', () => {
    const mode = {
      patternOffsets: [0, 2],
      beatStructure: { exampleBeats: 1, initialRests: 1, finalRests: 1 }
    };
    const timeline = buildBeatTimeline(mode);
    expect(timeline).toHaveLength(1 + 1 + 2 + 1);
    expect(timeline.map(t => t.type)).toEqual(['example', 'rest', 'note', 'note', 'rest']);
    expect(timeline[2].offset).toBe(0);
    expect(timeline[3].offset).toBe(2);
  });

  it('缺少音阶序列时应抛出错误', () => {
    expect(() => buildBeatTimeline({})).toThrow(/音阶序列/);
    expect(() => buildBeatTimeline({ patternOffsets: [] })).toThrow(/音阶序列/);
  });

  it('推导指示范围、梯形音与目标音（默认最大/最小偏移）', () => {
    const mode = {
      patternOffsets: [0, 4, 7, 4, 0],
      beatStructure: { exampleBeats: 1, initialRests: 2, finalRests: 1 }
    };
    const baseFreq = 440;
    const semitoneRatio = Math.pow(2, 1 / 12);
    const meta = deriveModePitchMeta(mode, baseFreq, semitoneRatio, 'ascending');

    expect(meta.indicatorRange.min).toBeLessThan(baseFreq); // padding 生效
    expect(meta.indicatorRange.max).toBeGreaterThan(baseFreq * Math.pow(semitoneRatio, 7));
    expect(meta.ladderNotes[0]).toBeCloseTo(baseFreq, 5);
    expect(meta.ladderNotes[1]).toBeCloseTo(baseFreq * Math.pow(semitoneRatio, 4), 5);
    expect(meta.ladderNotes[2]).toBeCloseTo(baseFreq * Math.pow(semitoneRatio, 7), 5);
    expect(meta.targetFreq).toBeCloseTo(baseFreq * Math.pow(semitoneRatio, 7), 5);
  });

  it('targetNoteIndex 优先于默认规则', () => {
    const mode = {
      patternOffsets: [0, 2, 4],
      beatStructure: { exampleBeats: 1, initialRests: 1, finalRests: 1 },
      targetNoteIndex: 1
    };
    const baseFreq = 440;
    const semitoneRatio = Math.pow(2, 1 / 12);
    const meta = deriveModePitchMeta(mode, baseFreq, semitoneRatio, 'descending');

    expect(meta.targetFreq).toBeCloseTo(baseFreq * Math.pow(semitoneRatio, 2), 5);
    expect(meta.minOffset).toBe(0);
    expect(meta.maxOffset).toBe(4);
  });

  it('prologue 可调整拍序并允许示范音偏移', () => {
    const mode = {
      patternOffsets: [7, 5, 4],
      prologue: [
        { type: 'rest', count: 1 },
        { type: 'example', count: 1, offset: 7 },
        { type: 'rest', count: 1 }
      ],
      beatStructure: { finalRests: 0 }
    };
    const timeline = buildBeatTimeline(mode);
    expect(timeline.map(t => t.type)).toEqual(['rest', 'example', 'rest', 'note', 'note', 'note']);
    expect(timeline[1].offset).toBe(7);
    expect(timeline[3].offset).toBe(7);
  });

  it('指示范围会包含 padding，保证上下有安全距离', () => {
    const mode = {
      patternOffsets: [0, 4],
      beatStructure: { exampleBeats: 1, initialRests: 1, finalRests: 0 }
    };
    const baseFreq = 440;
    const semitoneRatio = Math.pow(2, 1 / 12);
    const padding = 200; // cents
    const meta = deriveModePitchMeta(mode, baseFreq, semitoneRatio, 'ascending', padding);
    const rawMin = baseFreq;
    const rawMax = baseFreq * Math.pow(semitoneRatio, 4);
    expect(meta.indicatorRange.min).toBeLessThan(rawMin);
    expect(meta.indicatorRange.max).toBeGreaterThan(rawMax);
  });

  it('planBeatSchedule 按 BPM 与时值计算每拍时长，并补齐到 4 拍的整数倍', () => {
    const mode = {
      patternOffsets: [0, 2, 4, 2, 0, 2, 0],
      beatStructure: { exampleBeats: 1, initialRests: 1, finalRests: 0 },
      defaultBpm: 100,
      noteValue: 'quarter'
    };
    const { timeline, beatMs, beatUnit } = planBeatSchedule(mode, 100);
    expect(timeline).toHaveLength(12); // 9 拍补齐到 12
    expect(timeline.slice(9).every(t => t.type === 'rest')).toBe(true);
    expect(beatUnit).toBe('quarter');
    expect(beatMs).toBeCloseTo(600, 5);
  });

  it('planBeatSchedule 不再为了总时长压缩时值：拍数多的模式一轮更长', () => {
    const mode = {
      patternOffsets: [0, 2, 4, 5, 7, 5, 4, 2, 0],
      prologue: [{ type: 'example', count: 1, offset: 0 }, { type: 'rest', count: 1 }],
      beatStructure: { finalRests: 5 },
      defaultBpm: 100,
      noteValue: 'quarter'
    };
    const { timeline, beatMs } = planBeatSchedule(mode, 100);
    expect(timeline).toHaveLength(16);
    expect(beatMs).toBeCloseTo(600, 5);
  });

  it('planBeatSchedule 使用传入的用户速度，而不是 defaultBpm', () => {
    const mode = { patternOffsets: [0, 2], defaultBpm: 100, noteValue: 'eighth' };
    expect(planBeatSchedule(mode, 60).beatMs).toBeCloseTo(500, 5); // 60 BPM 八分音符 = 500 ms
    expect(planBeatSchedule(mode, 120).beatMs).toBeCloseTo(250, 5);
  });

  it('planBeatSchedule 对缺少速度配置的模式抛出错误', () => {
    expect(() => planBeatSchedule({ patternOffsets: [0], defaultBpm: 100 }, 100)).toThrow(/noteValue/);
    expect(() => planBeatSchedule({ patternOffsets: [0], noteValue: 'quarter' }, 100)).toThrow(/defaultBpm/);
    expect(() => planBeatSchedule({ patternOffsets: [0], noteValue: 'quarter', defaultBpm: 500 }, 100)).toThrow(/defaultBpm/);
  });

  it('computeBeatMs 遵循 60000 / BPM × 时值倍数', () => {
    expect(computeBeatMs(100, 'quarter')).toBeCloseTo(600, 5);
    expect(computeBeatMs(100, 'eighth')).toBeCloseTo(300, 5);
    expect(computeBeatMs(80, 'sixteenth')).toBeCloseTo(187.5, 5);
    expect(() => computeBeatMs(100, 'half')).toThrow(/未知的音符时值/);
    expect(() => computeBeatMs(0, 'quarter')).toThrow(/BPM/);
  });

  it('clampBpm 取整并限制在允许范围内', () => {
    expect(clampBpm(99.6)).toBe(100);
    expect(clampBpm(1)).toBe(BPM_RANGE.min);
    expect(clampBpm(999)).toBe(BPM_RANGE.max);
  });

  it('配置文件中的每个模式都声明了合法的速度与时值', () => {
    for (const mode of modesConfig.modes) {
      expect(() => planBeatSchedule(mode, mode.defaultBpm), mode.id).not.toThrow();
    }
  });

  it('默认速度下：普通模式每音 600 ms，16 分音符版每音 187.5 ms', () => {
    const byId = Object.fromEntries(modesConfig.modes.map(m => [m.id, m]));
    expect(planBeatSchedule(byId.turnback_123454321, byId.turnback_123454321.defaultBpm).beatMs).toBeCloseTo(600, 5);
    expect(planBeatSchedule(byId.octave_interval, byId.octave_interval.defaultBpm).beatMs).toBeCloseTo(600, 5);
    const fast = byId.turnback_123454321_16th;
    expect(planBeatSchedule(fast, fast.defaultBpm).beatMs).toBeCloseTo(187.5, 5);
  });
});

describe('BPM 本地存储', () => {
  /** 构造一个内存版 Storage。 */
  const makeStorage = (initial = {}) => {
    const data = { ...initial };
    return {
      getItem: key => (key in data ? data[key] : null),
      setItem: (key, value) => { data[key] = String(value); },
      data
    };
  };

  it('保存后可以读回，并规整非法值', () => {
    const storage = makeStorage();
    saveBpmMap(storage, { a: 90, b: 300 });
    expect(loadSavedBpmMap(storage)).toEqual({ a: 90, b: BPM_RANGE.max });
  });

  it('内容损坏或存储不可用时返回空对象', () => {
    expect(loadSavedBpmMap(makeStorage({ [BPM_STORAGE_KEY]: '{oops' }))).toEqual({});
    expect(loadSavedBpmMap(makeStorage({ [BPM_STORAGE_KEY]: '[1,2]' }))).toEqual({});
    expect(loadSavedBpmMap(undefined)).toEqual({});
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadSavedBpmMap(throwing)).toEqual({});
    expect(() => saveBpmMap(throwing, { a: 90 })).not.toThrow();
  });

  it('忽略非数字的条目', () => {
    const storage = makeStorage({ [BPM_STORAGE_KEY]: JSON.stringify({ a: 'fast', b: 72 }) });
    expect(loadSavedBpmMap(storage)).toEqual({ b: 72 });
  });
});
