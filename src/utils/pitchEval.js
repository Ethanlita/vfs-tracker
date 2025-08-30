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
  let current = 0;
  let maxStable = 0;
  for (const { pitch, clarity, rms } of frames) {
    const pass =
      pitch > 0 &&
      gateByEnergy(rms, baseline, deltaDb) &&
      gateByStability(clarity, theta) &&
      Math.abs(1200 * Math.log2(pitch / targetFreq)) <= tolerance;
    if (pass) {
      current += dt;
      if (current > maxStable) maxStable = current;
    } else {
      current = 0;
    }
  }
  return maxStable;
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
