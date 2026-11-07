/**
 * @file 音阶练习的整句判定。
 *
 * 判定流程（evaluatePhrase）：
 * 1. 取整句的帧（第一个练习音开始前 100 ms 到最后一个练习音结束后 350 ms），只保留通过能量、
 *    清晰度与基频范围门限的「有声帧」用于音高比较；
 * 2. 全局延迟估计：在 -100…+350 ms 内平移整条目标音高阶梯，取与用户音高最吻合的平移量。
 *    这个值包含设备输出/输入延迟和人「听到再跟唱」的反应时间，不需要事先知道；
 * 3. 分段对齐：以全局延迟为中心，允许每个换音点再前后浮动（最多 ±150 ms），
 *    用动态规划找出让「每帧与所属音的偏差」总和最小的换音点。上一个音的残留会自然归给上一个音；
 * 4. 逐段判定：中位数偏差必须在容差内；再按每个音的时长选择判定方式——
 *    - 稳定判定（stable）：0.5 × 每音时长 ≥ 200 ms（即每音 ≥ 400 ms）时，要求容差内连续保持 200 ms；
 *    - 走势判定（contour）：每个音太短时只要求「唱到位」：容差内停留 max(60 ms, 30% 每音时长)。
 */
import { accumulateStableWindow, gateByEnergy, gateByStability } from './pitchEval.js';

/**
 * @zh 整句判定使用的常量。
 * - lagMinMs / lagMaxMs：允许的全局延迟范围。负值容忍轻微抢拍；上限 350 ms 覆盖有线/多数蓝牙设备 + 跟唱反应，
 *   同时防止「晚一整拍再唱」也被判通过。
 * - lagStepMs：延迟搜索步长。
 * - localSlackMs：每个换音点在全局延迟基础上允许的额外浮动上限（实际取 min(本值, 0.45 × 每音时长)，
 *   保证相邻换音点的搜索窗口不重叠）。
 * - centCostCap：单帧偏差代价上限（cents），避免八度误检等离群帧主导对齐。
 * - stableRatio：稳定判定要求时长相对每音时长的比例；当 stableRatio × 每音时长 < stableWindowMs 时切换为走势判定。
 * - contourMinDwellMs / contourDwellRatio：走势判定下每个音在容差内的最短停留。
 */
export const PHRASE_EVAL_CONFIG = Object.freeze({
  lagMinMs: -100,
  lagMaxMs: 350,
  lagStepMs: 10,
  localSlackMs: 150,
  centCostCap: 300,
  stableRatio: 0.5,
  contourMinDwellMs: 60,
  contourDwellRatio: 0.3
});

/**
 * @zh 计算数组的中位数（空数组返回 0）。
 * @param {number[]} arr 数值数组
 * @returns {number} 中位数
 */
export const calcMedian = (arr = []) => {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * @zh 判断一帧是否为可用于音高比较的「有声帧」：基频在 (50, 2000) Hz、能量与清晰度通过门限。
 * 削波帧不排除——削波只作为 UI 提示。
 * @param {{ pitch:number, clarity:number, rms:number }} frame 帧数据
 * @param {number} baselineRms 噪声基线 RMS
 * @param {number} deltaDb 能量门限（dB）
 * @param {number} clarityTheta 清晰度门限
 * @returns {boolean} 是否为有声帧
 */
const isVoicedFrame = (frame, baselineRms, deltaDb, clarityTheta) =>
  Number.isFinite(frame.pitch) &&
  frame.pitch > 50 &&
  frame.pitch < 2000 &&
  gateByEnergy(frame.rms, baselineRms, deltaDb) &&
  gateByStability(frame.clarity, clarityTheta);

/**
 * @zh 根据每个音的时长选择判定方式。
 * 0.5 × 每音时长 ≥ stableWindowMs（默认 200 ms，即每音 ≥ 400 ms）时用稳定判定，要求连续保持 stableWindowMs；
 * 否则改为走势判定，只要求每个音在容差内停留 max(60 ms, 30% × 每音时长)。
 * BPM 由用户设置，所以判定方式随速度自动切换。
 * @param {number} noteMs 每个练习音的时长（毫秒）
 * @param {number} stableWindowMs 稳定判定要求的保持时长（毫秒）
 * @returns {{ regime: 'stable'|'contour', requiredMs: number }} 判定方式与每个音需满足的时长
 */
export const resolveJudgeRegime = (noteMs, stableWindowMs) => {
  const { stableRatio, contourMinDwellMs, contourDwellRatio } = PHRASE_EVAL_CONFIG;
  if (noteMs * stableRatio >= stableWindowMs) {
    return { regime: 'stable', requiredMs: stableWindowMs };
  }
  return { regime: 'contour', requiredMs: Math.max(contourMinDwellMs, noteMs * contourDwellRatio) };
};

/**
 * @zh 检测"切入过早"——在练习音开始前是否已经持续发声。
 *
 * 判定规则：取 t < endT 的所有帧（示范 / 空拍阶段），找到最长一段连续通过 gate
 * （能量、清晰度、基频范围）的"持续发声时长"，当且仅当这一段 > thresholdMs 时判定切入过早。
 * endT 由调用方设为「第一个练习音开始时间 + 允许的最早抢拍量」，抢拍在允许范围内不算切入过早。
 *
 * 这样可以容忍：
 *   - 单帧 / 孤立误检（pitchy 偶发跳变）
 *   - 示例拍因耳机漏音被麦克风录到的短暂能量泄露
 *   - 用户清嗓子 / 麦克风咔哒声等瞬态
 *
 * @param {Object} params
 * @param {Array<{ pitch:number, clarity:number, rms:number, t:number, clipped?:boolean }>} params.frames 整轮按时间排序的帧
 * @param {number} params.endT 只检查 t < endT 的帧
 * @param {number} params.baselineRms 噪声基线
 * @param {number} params.deltaDb 能量门限（dB）
 * @param {number} params.clarityTheta 清晰度阈值
 * @param {number} [params.thresholdMs=250] 触发判定所需的连续发声时长（毫秒）
 * @returns {{ early: boolean, durationMs: number }}
 */
export const detectEarlyVoicing = ({
  frames,
  endT,
  baselineRms,
  deltaDb,
  clarityTheta,
  thresholdMs = 250
}) => {
  let runStart = null;
  let maxMs = 0;
  for (const f of frames) {
    if (f.t >= endT) break;
    // clipped 帧也算"发声"，只通过 UI 提示用户调小音量
    if (isVoicedFrame(f, baselineRms, deltaDb, clarityTheta)) {
      if (runStart === null) runStart = f.t;
      maxMs = Math.max(maxMs, f.t - runStart);
    } else {
      runStart = null;
    }
  }
  return { early: maxMs > thresholdMs, durationMs: maxMs };
};

/**
 * @zh 估计整句的全局延迟：在 [lagMinMs, lagMaxMs] 内平移目标音高阶梯，取总代价最小的平移量。
 * 代价：落在某个音内的有声帧取 min(|偏差|, centCostCap)；早于第一个音的有声帧记 centCostCap / 2（提前发声）；
 * 晚于最后一个音的有声帧不计代价（最后一个音自然延长是正常的，不能因此把延迟估大）。
 * 代价相同时取 |延迟| 更小者，因此没有有声帧时结果为 0。
 * @param {Array<{ t:number, cents:number }>} voiced 有声帧（时间升序，cents 相对本轮基准音）
 * @param {Array<{ startT:number, endT:number, targetCents:number }>} notes 名义音符区间（时间升序、首尾相接）
 * @returns {number} 估计的延迟（毫秒）
 */
export const estimateGlobalLag = (voiced, notes) => {
  const { lagMinMs, lagMaxMs, lagStepMs, centCostCap } = PHRASE_EVAL_CONFIG;
  const lags = [];
  for (let lag = lagMinMs; lag <= lagMaxMs; lag += lagStepMs) lags.push(lag);
  // 先试 |lag| 小的，严格更优才替换，实现「同代价取最小延迟」
  lags.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);

  let bestLag = 0;
  let bestCost = Infinity;
  for (const lag of lags) {
    let cost = 0;
    let k = 0;
    for (const v of voiced) {
      if (v.t < notes[0].startT + lag) {
        cost += centCostCap / 2;
        continue;
      }
      while (k < notes.length && v.t >= notes[k].endT + lag) k += 1;
      if (k >= notes.length) break; // 之后的帧都晚于最后一个音，不计代价
      cost += Math.min(Math.abs(v.cents - notes[k].targetCents), centCostCap);
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestLag = lag;
    }
  }
  return bestLag;
};

/**
 * @zh 二分查找第一个时间戳 ≥ t 的帧下标（全部小于 t 时返回 frames.length）。
 * @param {Array<{ t:number }>} frames 时间升序的帧
 * @param {number} t 时间
 * @returns {number} 下标
 */
const lowerBound = (frames, t) => {
  let lo = 0;
  let hi = frames.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/**
 * @zh 在全局延迟附近为每个换音点找最优位置（动态规划）。
 * 换音点 k（k < K 为第 k 个音的开始，k = K 为最后一个音的结束）的候选为时间落在
 * [名义时间 + lag ± slack] ∩ [名义时间 + lagMinMs, 名义时间 + lagMaxMs] 内的帧下标；
 * 窗口内没有帧时取窗口起点之后的第一个下标（可能得到空段，后续按「未检测到」处理）。
 * 因为 slack < 每音时长 / 2，相邻窗口互不重叠，候选下标天然有序。
 * @param {Array<{ t:number, cents:number|null }>} frames 分析窗口内的全部帧（时间升序，无声帧 cents 为 null）
 * @param {Array<{ startT:number, endT:number, targetCents:number }>} notes 名义音符区间
 * @param {number} lag 全局延迟（毫秒）
 * @param {number} noteMs 每个音的名义时长（毫秒）
 * @returns {number[]} K + 1 个换音点下标，第 k 段为 [b[k], b[k+1])
 */
const alignBoundaries = (frames, notes, lag, noteMs) => {
  const { lagMinMs, lagMaxMs, localSlackMs, centCostCap } = PHRASE_EVAL_CONFIG;
  const K = notes.length;
  const N = frames.length;
  const slack = Math.min(localSlackMs, noteMs * 0.45);
  const nominal = [...notes.map(n => n.startT), notes[K - 1].endT];

  const candidates = nominal.map(nom => {
    const lo = Math.max(nom + lag - slack, nom + lagMinMs);
    const hi = Math.min(nom + lag + slack, nom + lagMaxMs);
    const first = lowerBound(frames, lo);
    const list = [];
    for (let i = first; i < N && frames[i].t <= hi; i++) list.push(i);
    return list.length ? list : [first];
  });

  // prefix[k][i]：前 i 帧都归给第 k 个音时的累计代价（无声帧代价为 0）
  const prefix = notes.map(note => {
    const arr = new Float64Array(N + 1);
    for (let i = 0; i < N; i++) {
      const c = frames[i].cents;
      arr[i + 1] = arr[i] + (c === null ? 0 : Math.min(Math.abs(c - note.targetCents), centCostCap));
    }
    return arr;
  });

  let prevCost = candidates[0].map(() => 0);
  const back = [];
  for (let k = 1; k <= K; k++) {
    const segPrefix = prefix[k - 1];
    const prevCands = candidates[k - 1];
    const choice = [];
    const cost = candidates[k].map(j => {
      let best = Infinity;
      let bestIdx = -1;
      prevCands.forEach((i, idx) => {
        if (i > j) return;
        const value = prevCost[idx] + segPrefix[j] - segPrefix[i];
        if (value < best) {
          best = value;
          bestIdx = idx;
        }
      });
      choice.push(bestIdx);
      return best;
    });
    back.push(choice);
    prevCost = cost;
  }

  let endIdx = 0;
  prevCost.forEach((value, idx) => {
    if (value < prevCost[endIdx]) endIdx = idx;
  });
  if (!Number.isFinite(prevCost[endIdx])) {
    // 候选窗口互不重叠时不可能发生；出现即为调用方传入了乱序音符
    throw new Error('换音点对齐失败：音符区间必须按时间升序且首尾相接。');
  }
  const boundaries = new Array(K + 1);
  let idx = endIdx;
  for (let k = K; k >= 1; k--) {
    boundaries[k] = candidates[k][idx];
    idx = back[k - 1][idx];
  }
  boundaries[0] = candidates[0][idx];
  return boundaries;
};

/**
 * @zh 整句判定：估计延迟、对齐换音点并逐个音判定（见文件头说明）。
 *
 * @param {Object} params
 * @param {Array<{ pitch:number, clarity:number, rms:number, t:number }>} params.frames 整轮按时间排序的帧（含练习音结束后的尾段）
 * @param {Array<{ offset:number, startT:number, endT:number }>} params.noteSteps 练习音的半音偏移与名义起止时间（与帧同一时钟，首尾相接）
 * @param {number} params.noteMs 每个练习音的名义时长（毫秒），决定判定方式
 * @param {number} params.baseFreq 本轮基准频率（Hz）
 * @param {number} params.semitoneRatio 半音比值（2^(1/12)）
 * @param {number} params.tolerance 容差（cents）
 * @param {number} params.baselineRms 噪声基线 RMS
 * @param {number} params.deltaDb 能量门限（dB）
 * @param {number} params.clarityTheta 清晰度门限
 * @param {number} params.stableWindowMs 稳定判定要求的保持时长（毫秒）
 * @returns {{
 *   passed: boolean,
 *   regime: 'stable'|'contour',
 *   requiredMs: number,
 *   lagMs: number,
 *   notes: Array<{ idx:number, freq:number, startT:number|null, endT:number|null, voicedFrames:number, cents:number|null, stableMs:number }>,
 *   failedNote?: { idx:number, freq:number, type:'miss'|'high'|'low'|'unstable'|'brief', cents?:number, stableMs?:number, requiredMs?:number }
 * }}
 */
export const evaluatePhrase = ({
  frames,
  noteSteps,
  noteMs,
  baseFreq,
  semitoneRatio,
  tolerance,
  baselineRms,
  deltaDb,
  clarityTheta,
  stableWindowMs
}) => {
  if (!Array.isArray(noteSteps) || noteSteps.length === 0) {
    throw new Error('evaluatePhrase 需要至少一个练习音。');
  }
  const { lagMinMs, lagMaxMs } = PHRASE_EVAL_CONFIG;
  const { regime, requiredMs } = resolveJudgeRegime(noteMs, stableWindowMs);

  const notes = noteSteps.map(step => ({
    startT: step.startT,
    endT: step.endT,
    targetCents: (step.offset ?? 0) * 100,
    freq: baseFreq * Math.pow(semitoneRatio, step.offset ?? 0)
  }));

  // 分析窗口：第一个音最早允许的起点 → 最后一个音最晚允许的终点
  const windowStart = notes[0].startT + lagMinMs;
  const windowEnd = notes[notes.length - 1].endT + lagMaxMs;
  const windowFrames = frames
    .filter(f => f.t >= windowStart && f.t <= windowEnd)
    .map(f => ({
      ...f,
      cents: isVoicedFrame(f, baselineRms, deltaDb, clarityTheta) ? 1200 * Math.log2(f.pitch / baseFreq) : null
    }));
  const voiced = windowFrames.filter(f => f.cents !== null);

  const lagMs = estimateGlobalLag(voiced, notes);
  const boundaries = alignBoundaries(windowFrames, notes, lagMs, noteMs);

  const results = [];
  let failedNote;
  notes.forEach((note, k) => {
    const segment = windowFrames.slice(boundaries[k], boundaries[k + 1]);
    const voicedSeg = segment.filter(f => f.cents !== null);
    const idx = k + 1;
    const stableMs = accumulateStableWindow(segment, note.freq, tolerance, baselineRms, deltaDb, clarityTheta, 0);
    const cents = voicedSeg.length
      ? 1200 * Math.log2(calcMedian(voicedSeg.map(f => f.pitch)) / note.freq)
      : null;
    results.push({
      idx,
      freq: note.freq,
      startT: segment.length ? segment[0].t : null,
      endT: segment.length ? segment[segment.length - 1].t : null,
      voicedFrames: voicedSeg.length,
      cents,
      stableMs
    });
    if (failedNote) return;
    if (cents === null) {
      failedNote = { idx, freq: note.freq, type: 'miss' };
    } else if (cents < -tolerance) {
      failedNote = { idx, freq: note.freq, type: 'low', cents };
    } else if (cents > tolerance) {
      failedNote = { idx, freq: note.freq, type: 'high', cents };
    } else if (stableMs < requiredMs) {
      failedNote = {
        idx,
        freq: note.freq,
        type: regime === 'stable' ? 'unstable' : 'brief',
        stableMs,
        requiredMs
      };
    }
  });

  return {
    passed: !failedNote,
    regime,
    requiredMs,
    lagMs,
    notes: results,
    ...(failedNote ? { failedNote } : {})
  };
};
