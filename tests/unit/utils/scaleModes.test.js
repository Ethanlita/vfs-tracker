/**
 * 单元测试：src/utils/scaleModes.js
 * 
 * 覆盖节拍生成与模式元信息推导逻辑，确保多模式配置可用。
 */
import { describe, it, expect } from 'vitest';
import { buildBeatTimeline, deriveModePitchMeta, planBeatSchedule } from '../../../src/utils/scaleModes.js';

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

  it('planBeatSchedule 会根据时长限制选择合适的拍时并补齐小节', () => {
    const mode = {
      patternOffsets: [0, 2, 4, 2, 0],
      beatStructure: { exampleBeats: 1, initialRests: 1, finalRests: 0 }
    };
    const { timeline, beatMs, beatUnit } = planBeatSchedule(mode, 600);
    expect(timeline.length % 4).toBe(0); // 补齐整小节
    expect(['quarter', 'eighth', 'sixteenth']).toContain(beatUnit);
    // 最大时长不超过两个全音符（8 个四分音符）
    const totalQuarterUnits = timeline.length * (beatUnit === 'quarter' ? 1 : beatUnit === 'eighth' ? 0.5 : 0.25);
    expect(totalQuarterUnits).toBeLessThanOrEqual(8);
    expect(beatMs).toBeGreaterThan(0);
  });

  it('planBeatSchedule 对无法满足时长限制的模式抛出错误', () => {
    const mode = {
      // 极长模式触发失败
      patternOffsets: new Array(40).fill(0),
      beatStructure: { exampleBeats: 1, initialRests: 1, finalRests: 0 }
    };
    expect(() => planBeatSchedule(mode, 600)).toThrow(/无法在两个全音符内完成/);
  });
});
