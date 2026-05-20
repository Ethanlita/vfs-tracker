export const gateByEnergy = (rms, baseline, deltaDb = 12) => {
  const threshold = baseline * Math.pow(10, deltaDb / 20);
  return rms >= threshold;
};

export const gateByStability = (clarity, theta = 0.6) => clarity >= theta;

export const accumulateStableWindow = (
  frames,
  targetFreq,
  tolerance,
  baseline,
  deltaDb,
  theta,
  dt
) => {
  let runStart = null;
  let current = 0;
  let maxStable = 0;
  for (const frame of frames) {
    const { pitch, clarity, rms, t } = frame;
    // 注意：clipped 帧不再在这里被排除——削波只作为 UI 提示。pitch 检测对削波信号
    // 准确度可能下降，但仍然有意义（autocorrelation 对部分削波有鲁棒性），由 clarity
    // / tolerance gate 自然处理。
    const pass =
      pitch > 0 &&
      gateByEnergy(rms, baseline, deltaDb) &&
      gateByStability(clarity, theta) &&
      Math.abs(1200 * Math.log2(pitch / targetFreq)) <= tolerance;
    if (pass) {
      if (typeof t === 'number') {
        if (runStart === null) {
          runStart = t;
          current = 0;
        } else {
          current = t - runStart;
        }
      } else {
        current += dt;
      }
      if (current > maxStable) maxStable = current;
    } else {
      runStart = null;
      current = 0;
    }
  }
  return maxStable;
};

/**
 * @zh 创建一个 F0 显示平滑器，用于实时 UI 上抑制视觉抖动。
 * - 滚动中值（默认 5 帧）：抑制 ±几 Hz 的随机抖动；
 * - 八度跳跃锁存（默认 600 cents 阈值，需要 2 帧确认）：抑制 pitchy 偶发的 2× / 0.5× octave error。
 *
 * 用法：
 *   const sm = createDisplayPitchSmoother();
 *   const display = sm.push(rawPitch); // pitch <= 0 表示无声，缓冲区会清空
 *
 * @param {Object} [opts]
 * @param {number} [opts.medianWindow=5] 中值窗口长度
 * @param {number} [opts.octaveCentThreshold=600] 视为"大跳"的最小 cent 偏差
 * @param {number} [opts.confirmCount=2] 大跳需要的连续确认帧数
 * @param {number} [opts.pendingMatchCents=200] 两次"大跳"互相属于同一新区间的最大 cent 偏差
 * @returns {{ push: (raw: number) => number, value: number, reset: () => void }}
 */
export const createDisplayPitchSmoother = ({
  medianWindow = 5,
  octaveCentThreshold = 600,
  confirmCount = 2,
  pendingMatchCents = 200
} = {}) => {
  let buffer = [];
  let pending = { pitch: 0, count: 0 };
  let displayed = 0;

  const median = (arr) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  const api = {
    push(rawPitch) {
      if (!Number.isFinite(rawPitch) || rawPitch <= 0) {
        buffer = [];
        pending = { pitch: 0, count: 0 };
        displayed = 0;
        return 0;
      }
      if (displayed === 0) {
        buffer.push(rawPitch);
        if (buffer.length > medianWindow) buffer.shift();
        pending = { pitch: 0, count: 0 };
        displayed = median(buffer);
        return displayed;
      }
      const cents = Math.abs(1200 * Math.log2(rawPitch / displayed));
      if (cents > octaveCentThreshold) {
        if (
          pending.pitch > 0 &&
          Math.abs(1200 * Math.log2(rawPitch / pending.pitch)) < pendingMatchCents
        ) {
          pending = { pitch: rawPitch, count: pending.count + 1 };
          if (pending.count >= confirmCount) {
            buffer = [rawPitch];
            displayed = rawPitch;
            pending = { pitch: 0, count: 0 };
          }
        } else {
          pending = { pitch: rawPitch, count: 1 };
        }
        return displayed;
      }
      pending = { pitch: 0, count: 0 };
      buffer.push(rawPitch);
      if (buffer.length > medianWindow) buffer.shift();
      displayed = median(buffer);
      return displayed;
    },
    get value() { return displayed; },
    reset() {
      buffer = [];
      pending = { pitch: 0, count: 0 };
      displayed = 0;
    }
  };
  return api;
};

// Constants for adaptiveParamsFromMAD
const MAD_HIGH_THRESHOLD = 50;
const MAD_LOW_THRESHOLD = 15;
const TOLERANCE_HIGH = 75;
const TOLERANCE_LOW = 30;
const TOLERANCE_DEFAULT = 50;
const WINDOW_MS_HIGH = 350;
const WINDOW_MS_LOW = 250;
const WINDOW_MS_DEFAULT = 300;

export const adaptiveParamsFromMAD = (mad) => {
  if (mad > MAD_HIGH_THRESHOLD) return { tolerance: TOLERANCE_HIGH, windowMs: WINDOW_MS_HIGH };
  if (mad < MAD_LOW_THRESHOLD) return { tolerance: TOLERANCE_LOW, windowMs: WINDOW_MS_LOW };
  return { tolerance: TOLERANCE_DEFAULT, windowMs: WINDOW_MS_DEFAULT };
};
