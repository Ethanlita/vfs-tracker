/** @zh SoundTouch 整数 PCM 路径的 JavaScript 重建；支持小数半音，保留上游归属。 */
/*
 * Educational JavaScript reconstruction of the SoundTouch 1.7.0 integer
 * pitch-shifting path identified in VSCMain.exe. This is not original VSC
 * source, not the original compiled library, and not bit-exact emulation.
 *
 * Algorithm reference: SoundTouch, Copyright (c) Olli Parviainen 2001-2012.
 * This adapted DSP module is distributed under LGPL-2.1-or-later; see
 * dsp-LICENSE.txt. Original reference: https://www.surina.net/soundtouch/
 * Adaptation: JavaScript offline PCM processing, 2026-11-07.
 */

export const DSP_VERSION = "VSC-inspired / SoundTouch 1.7.0 integer-path JS reconstruction";

const SCALE = 65536;
const TAPS = 32;
const OLD_PI = 3.141592655357989;
const f32 = Math.fround;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const clamp16 = (x) => clamp(x, -32768, 32767);
const nearestSigned = (x) => x < 0 ? -Math.round(-x) : Math.round(x);
const clockNow = () => globalThis.performance?.now?.() ?? Date.now();

function progress(options, stage, value) {
  if (typeof options.onProgress === "function") {
    options.onProgress({ stage, progress: clamp(value, 0, 1) });
  }
}

function parameters(sampleRate, semitones) {
  const exponent = f32(f32(semitones / 12) * f32(Math.LN2));
  const rate = f32(Math.exp(exponent));
  const tempo = f32(1 / rate);
  const q16Step = Math.trunc(f32(f32(rate * SCALE) + 0.5));
  const sequenceMs = Math.trunc(clamp(150 - 50 * tempo, 50, 125) + 0.5);
  const seekMs = Math.trunc(clamp(28.333333333333332 - 6.666666666666667 * tempo, 15, 25) + 0.5);
  const overlapRequestMs = 8;
  const dividerBits = clamp(Math.trunc(Math.log2(sampleRate * overlapRequestMs / 1000) + 0.5) - 1, 3, 9);
  const overlapFrames = 2 ** (dividerBits + 1);
  const sequenceFrames = Math.max(Math.trunc(sampleRate * sequenceMs / 1000), 2 * overlapFrames);
  const seekFrames = Math.trunc(sampleRate * seekMs / 1000);
  const batchFrames = sequenceFrames - overlapFrames;
  const nominalSkip = f32(batchFrames * tempo);
  const sampleReq = Math.max(Math.trunc(f32(nominalSkip + 0.5)) + overlapFrames, sequenceFrames) + seekFrames;
  return { rate, tempo, q16Step, sequenceMs, seekMs, overlapRequestMs, overlapFrames,
    dividerBits, sequenceFrames, seekFrames, batchFrames, nominalSkip, sampleReq };
}

function makeCoefficients(rate) {
  // Preserve the old 1.7.0 center branch h=1, including its difference from
  // the continuous limit 2*fc. Do not substitute a modern ideal-sinc kernel.
  const fc = rate <= 1 ? f32(rate * 0.5) : f32(0.5 / rate);
  const work = new Float64Array(TAPS);
  let sum = 0;
  for (let i = 0; i < TAPS; i++) {
    const d = i - TAPS / 2;
    const theta = d * (2 * fc) * OLD_PI;
    const h = theta === 0 ? 1 : (2 * fc) * Math.sin(theta) / theta;
    const window = 0.54 + 0.46 * Math.cos(d * (2 * OLD_PI / TAPS));
    work[i] = h * window;
    sum += work[i];
  }
  const coeffs = new Int16Array(TAPS);
  for (let i = 0; i < TAPS; i++) coeffs[i] = clamp16(nearestSigned(work[i] * 16384 / sum));
  return coeffs;
}

function filter(input, channelCount, coeffs) {
  const frames = Math.max(0, input.length / channelCount - TAPS);
  const output = new Int16Array(frames * channelCount);
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      let sum = 0;
      let offset = frame * channelCount + channel;
      for (let tap = 0; tap < TAPS; tap++, offset += channelCount) sum += input[offset] * coeffs[tap];
      // Arithmetic division, including floor for negative signed shifts.
      // JS safe-number accumulation deliberately avoids native int32 overflow.
      output[frame * channelCount + channel] = clamp16(Math.floor(sum / 16384));
    }
  }
  return output;
}

function interpolateQ16(input, channelCount, q16Step) {
  const frames = input.length / channelCount;
  if (frames === 0) return new Int16Array(0);
  const count = Math.floor(frames * SCALE / q16Step) + 1;
  const output = new Int16Array(count * channelCount);
  // A fresh 1.7.0 integer transposer starts with a zero previous frame and
  // zero phase. Express the same full-buffer phase in exact integer units.
  for (let frame = 0; frame < count; frame++) {
    const position = frame * q16Step;
    if (position <= SCALE) {
      for (let ch = 0; ch < channelCount; ch++) {
        output[frame * channelCount + ch] = Math.trunc(input[ch] * position / SCALE);
      }
    } else {
      const shifted = position - SCALE;
      const left = Math.floor(shifted / SCALE);
      const fraction = shifted - left * SCALE;
      for (let ch = 0; ch < channelCount; ch++) {
        const a = input[Math.min(left, frames - 1) * channelCount + ch];
        const b = input[Math.min(left + 1, frames - 1) * channelCount + ch];
        output[frame * channelCount + ch] = Math.trunc((a * (SCALE - fraction) + b * fraction) / SCALE);
      }
    }
  }
  return output;
}

function transpose(input, channelCount, params, coeffs) {
  if (params.rate < 1) {
    return filter(interpolateQ16(input, channelCount, params.q16Step), channelCount, coeffs);
  }
  return interpolateQ16(filter(input, channelCount, coeffs), channelCount, params.q16Step);
}

function seekBest(input, startFrame, mid, channelCount, params) {
  const length = params.overlapFrames * channelCount;
  const divisor = 2 ** params.dividerBits;
  let best = 0;
  let bestScore = 1.1754943508222875e-38;
  for (let candidate = 0; candidate < params.seekFrames; candidate++) {
    const start = (startFrame + candidate) * channelCount;
    let corr = 0;
    let norm = 0;
    // Match the scalar 1.7.0 four-sample normalization structure. Use wide
    // accumulation to stay finite on clipped/high-level WebAudio recordings.
    for (let i = 0; i < length; i += 4) {
      const a = input[start + i], b = input[start + i + 1];
      const c = input[start + i + 2], d = input[start + i + 3];
      corr += Math.floor((a * mid[i] + b * mid[i + 1] + c * mid[i + 2] + d * mid[i + 3]) / divisor);
      norm += Math.floor((a * a + b * b + c * c + d * d) / divisor);
    }
    const correlation = corr / Math.sqrt(Math.max(1, norm));
    const relative = (2 * candidate - params.seekFrames) / params.seekFrames;
    const score = (correlation + 0.1) * (1 - 0.25 * relative * relative);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function stretch(input, channelCount, params, wantedFrames, options, phaseStart, phaseSpan) {
  const totalFrames = input.length / channelCount;
  const iterations = Math.max(1, Math.ceil(wantedFrames / params.batchFrames));
  const output = new Int16Array(iterations * params.batchFrames * channelCount);
  const mid = new Int16Array(params.overlapFrames * channelCount);
  let inputCursor = 0;
  let outputFrames = 0;
  let skipFraction = 0;
  let done = 0;
  while (totalFrames - inputCursor >= params.sampleReq && outputFrames < wantedFrames) {
    const offset = seekBest(input, inputCursor, mid, channelCount, params);
    const position = inputCursor + offset;
    const outputStart = outputFrames * channelCount;
    for (let i = 0; i < params.overlapFrames; i++) {
      for (let ch = 0; ch < channelCount; ch++) {
        const index = i * channelCount + ch;
        const sample = ((params.overlapFrames - i) * mid[index] + i * input[position * channelCount + index]) / params.overlapFrames;
        output[outputStart + index] = clamp16(Math.trunc(sample));
      }
    }
    const centralFrames = params.sequenceFrames - 2 * params.overlapFrames;
    const centralStart = (position + params.overlapFrames) * channelCount;
    output.set(input.subarray(centralStart, centralStart + centralFrames * channelCount),
      outputStart + params.overlapFrames * channelCount);
    const tailStart = (position + params.sequenceFrames - params.overlapFrames) * channelCount;
    mid.set(input.subarray(tailStart, tailStart + mid.length));
    outputFrames += params.batchFrames;
    skipFraction = f32(skipFraction + params.nominalSkip);
    const skipped = Math.trunc(skipFraction);
    skipFraction = f32(skipFraction - skipped);
    inputCursor += skipped;
    done++;
    if (done % 4 === 0 || done === iterations) {
      progress(options, "time-stretch", phaseStart + phaseSpan * done / iterations);
    }
  }
  return { samples: output.subarray(0, outputFrames * channelCount), iterations: done, consumedFrames: inputCursor };
}

function paddingPlan(inputFrames, params) {
  // Finish by providing future zero samples, then keep only the requested
  // duration. This adapts the upstream flush principle to an offline clip.
  // It is not a byte-for-byte port of the upstream 64-frame flush loop.
  const wantedStretchFrames = params.rate > 1
    ? Math.ceil(Math.max(0, inputFrames - 1) * params.q16Step / SCALE) + TAPS + 2
    : inputFrames;
  const iterations = Math.max(1, Math.ceil(wantedStretchFrames / params.batchFrames));
  const neededStretchInput = Math.ceil((iterations - 1) * params.nominalSkip) + params.sampleReq + 4;
  const neededSource = params.rate < 1
    ? Math.ceil((neededStretchInput + TAPS - 1) * params.q16Step / SCALE) + 4
    : neededStretchInput;
  return { wantedStretchFrames, paddingFrames: Math.max(0, neededSource - inputFrames) };
}

/**
 * Offline pitch shift for one or two equally sized WebAudio channels.
 * Runs synchronously; callers should run this in a Worker for longer clips.
 * @param {Float32Array[]} channels mono or stereo, normalized PCM
 * @param {number} sampleRate integer 8000..192000
 * @param {number} semitones finite -19..20 (fractional values supported); zero copies the input
 * @param {{onProgress?:Function}} options callback receives {stage, progress}
 * @returns {{channels:Float32Array[], sampleRate:number, stats:object}}
 */
export function pitchShift(channels, sampleRate, semitones, options = {}) {
  const started = clockNow();
  if (!Array.isArray(channels) || channels.length < 1 || channels.length > 2 ||
      channels.some(ch => !(ch instanceof Float32Array))) {
    throw new TypeError("channels must be one or two Float32Array channels");
  }
  const inputFrames = channels[0].length;
  if (channels.some(ch => ch.length !== inputFrames)) throw new RangeError("Channel lengths must match");
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError("Unsupported sample rate");
  if (!Number.isFinite(semitones) || semitones < -19 || semitones > 20) throw new RangeError("Semitones must be finite and from -19 to 20");
  if (!options || typeof options !== "object") throw new TypeError("options must be an object");
  const channelCount = channels.length;
  let sanitizedSamples = 0;
  let clippedInputSamples = 0;
  progress(options, "prepare", 0);
  if (semitones === 0 || inputFrames === 0) {
    const copy = channels.map(ch => {
      const out = new Float32Array(ch.length);
      for (let i = 0; i < ch.length; i++) {
        if (Number.isFinite(ch[i])) out[i] = ch[i];
        else { out[i] = 0; sanitizedSamples++; }
      }
      return out;
    });
    progress(options, "complete", 1);
    let peak = 0;
    for (const channel of copy) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
    return { channels: copy, sampleRate, stats: { version: DSP_VERSION, bypass: true,
      bypassReason: semitones === 0 ? "zero-semitones" : "empty-input",
      semitones, inputFrames, outputFrames: inputFrames, durationSeconds: inputFrames / sampleRate,
      channelCount, paddingFrames: 0, sanitizedSamples, clippedInputSamples,
      rawOutputFrames: inputFrames, trimmedOutputFrames: 0, flushAttempts: 0,
      pitchRatio: 1, tempo: 1, q16Step: SCALE, effectiveQ16Rate: 1,
      processingOrder: "bypass", aaTaps: 0, aaCoefficientBits: 0, quickSeek: false,
      sequenceMs: 0, seekMs: 0, overlapRequestMs: 0, overlapFrames: 0,
      tdInputRequirement: 0, tdIterations: 0, peak,
      processingMs: clockNow() - started } };
  }
  const params = parameters(sampleRate, semitones);
  const plan = paddingPlan(inputFrames, params);
  let paddingFrames = plan.paddingFrames;
  const coeffs = makeCoefficients(params.rate);
  let raw, stretchResult, attempt;
  for (attempt = 0; attempt < 3; attempt++) {
    const pcm = new Int16Array((inputFrames + paddingFrames) * channelCount);
    sanitizedSamples = 0;
    clippedInputSamples = 0;
    for (let i = 0; i < inputFrames; i++) {
      for (let ch = 0; ch < channelCount; ch++) {
        let sample = channels[ch][i];
        if (!Number.isFinite(sample)) { sample = 0; sanitizedSamples++; }
        if (sample < -1 || sample > 1) clippedInputSamples++;
        pcm[i * channelCount + ch] = clamp16(nearestSigned(clamp(sample, -1, 1) * 32768));
      }
    }
    progress(options, "prepare", 0.05);
    if (params.rate > 1) {
      stretchResult = stretch(pcm, channelCount, params, plan.wantedStretchFrames, options, 0.05, 0.8);
      progress(options, "resample", 0.9);
      raw = transpose(stretchResult.samples, channelCount, params, coeffs);
    } else {
      progress(options, "resample", 0.1);
      const resampled = transpose(pcm, channelCount, params, coeffs);
      stretchResult = stretch(resampled, channelCount, params, inputFrames, options, 0.15, 0.75);
      raw = stretchResult.samples;
    }
    if (raw.length / channelCount >= inputFrames) break;
    paddingFrames += Math.ceil(params.sampleReq * Math.max(1, params.rate)) + 128;
  }
  if (!raw || raw.length / channelCount < inputFrames) throw new Error("Unable to flush the requested duration");
  const output = Array.from({ length: channelCount }, () => new Float32Array(inputFrames));
  let peak = 0;
  for (let i = 0; i < inputFrames; i++) {
    for (let ch = 0; ch < channelCount; ch++) {
      const sample = raw[i * channelCount + ch] / 32768;
      output[ch][i] = sample;
      peak = Math.max(peak, Math.abs(sample));
    }
  }
  progress(options, "complete", 1);
  return { channels: output, sampleRate, stats: {
    version: DSP_VERSION, bypass: false, semitones, channelCount, inputFrames,
    outputFrames: inputFrames, rawOutputFrames: raw.length / channelCount,
    trimmedOutputFrames: raw.length / channelCount - inputFrames,
    durationSeconds: inputFrames / sampleRate, paddingFrames, flushAttempts: attempt + 1,
    pitchRatio: params.rate, tempo: params.tempo, q16Step: params.q16Step,
    effectiveQ16Rate: params.q16Step / SCALE,
    processingOrder: params.rate > 1 ? "TDStretch → AA FIR → Q16 resample" : "Q16 resample → AA FIR → TDStretch",
    aaTaps: TAPS, aaCoefficientBits: 14, aaOldCenterValue: 1, quickSeek: false,
    sequenceMs: params.sequenceMs, seekMs: params.seekMs,
    overlapRequestMs: params.overlapRequestMs, overlapFrames: params.overlapFrames,
    tdInputRequirement: params.sampleReq, tdIterations: stretchResult.iterations,
    sanitizedSamples, clippedInputSamples, peak,
    processingMs: clockNow() - started,
    limitations: "Offline JS scalar reconstruction; Float32/Int16 conversion and safe accumulators, no MMX or native bit-exact guarantee. Duration is explicitly cropped after zero-tail flushing."
  } };
}

// Internal, read-only helper surface shared by the stateful streaming port.
// Exporting these functions does not change the offline processing path.
export const _streamingDSP = Object.freeze({ parameters, makeCoefficients, seekBest });
