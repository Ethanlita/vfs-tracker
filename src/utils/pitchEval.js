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

export const adaptiveParamsFromMAD = (mad) => {
  if (mad > 50) return { tolerance: 75, windowMs: 350 };
  if (mad < 15) return { tolerance: 30, windowMs: 250 };
  return { tolerance: 50, windowMs: 300 };
};
