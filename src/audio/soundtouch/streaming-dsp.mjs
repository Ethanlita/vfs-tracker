/** @zh SoundTouch 整数 PCM 路径的 JavaScript 重建；支持小数半音，保留上游归属。 */
/*
 * Stateful mono JavaScript reconstruction of the SoundTouch 1.7.0 integer
 * path identified in VSC. No per-block offline pitchShift or tail padding.
 * Algorithm reference: SoundTouch, (c) Olli Parviainen 2001-2012.
 * Adaptation 2026-11-07, LGPL-2.1-or-later; see dsp-LICENSE.txt.
 * This is not original VSC source, native bit-exact emulation, or a driver.
 */
import { _streamingDSP, DSP_VERSION } from "./dsp.mjs";

const SCALE = 65536;
const TAPS = 32;
const INTERNAL_CHUNK = 512;
const f32 = Math.fround;
const clamp16 = value => Math.max(-32768, Math.min(32767, value));
const nearestSigned = value => value < 0 ? -Math.round(-value) : Math.round(value);

function validate(sampleRate, semitones) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new RangeError("sampleRate must be an integer from 8000 to 192000");
  }
  if (!Number.isFinite(semitones) || semitones < -19 || semitones > 20) {
    throw new RangeError("Semitones must be finite and from -19 to 20");
  }
}

function capacityFor(limit) {
  let capacity = 1;
  while (capacity < limit) capacity *= 2;
  return capacity;
}

// Each FIFO has an explicit bound derived from one algorithm window and
// the largest internal stage feed. Capacity never grows during a segment.
class SampleFIFO {
  constructor(limit) {
    this.limit = limit;
    this.data = new Int16Array(capacityFor(Math.max(1, limit)));
    this.start = 0;
    this.length = 0;
    this.highWater = 0;
  }

  append(samples) {
    if (samples.length === 0) return;
    if (this.length + samples.length > this.limit) {
      throw new Error("Internal DSP FIFO exceeded its configured bound");
    }
    if (this.start + this.length + samples.length > this.data.length) {
      this.data.copyWithin(0, this.start, this.start + this.length);
      this.start = 0;
    }
    this.data.set(samples, this.start + this.length);
    this.length += samples.length;
    this.highWater = Math.max(this.highWater, this.length);
  }

  consume(count) {
    if (count < 0 || count > this.length) throw new Error("Invalid FIFO consumption");
    this.start += count;
    this.length -= count;
    if (this.length === 0) this.start = 0;
  }
}

class IntegerRateTransposer {
  constructor(step) {
    this.step = step;
    this.phase = 0;
    this.previous = 0;
  }

  push(samples) {
    if (samples.length === 0) return new Int16Array(0);
    const output = new Int16Array(Math.ceil(samples.length * SCALE / this.step) + 2);
    let count = 0;
    // An incoming sample closes one interpolation interval. The previous
    // sample and phase persist across arbitrary push boundaries, even 1 frame.
    for (let i = 0; i < samples.length; i++) {
      const current = samples[i];
      while (this.phase <= SCALE) {
        output[count++] = Math.trunc(((SCALE - this.phase) * this.previous + this.phase * current) / SCALE);
        this.phase += this.step;
      }
      this.phase -= SCALE;
      this.previous = current;
    }
    return output.subarray(0, count);
  }
}

class StreamingFIR {
  constructor(coefficients, feedLimit) {
    this.coefficients = coefficients;
    this.fifo = new SampleFIFO(TAPS + feedLimit);
  }

  push(samples) {
    this.fifo.append(samples);
    const count = Math.max(0, this.fifo.length - TAPS);
    if (count === 0) return new Int16Array(0);
    const output = new Int16Array(count);
    const data = this.fifo.data;
    const start = this.fifo.start;
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (let tap = 0; tap < TAPS; tap++) sum += data[start + i + tap] * this.coefficients[tap];
      output[i] = clamp16(Math.floor(sum / 16384));
    }
    this.fifo.consume(count); // Keep the final 32 frames for the next call.
    return output;
  }
}

class StreamingTDStretch {
  constructor(params, feedLimit) {
    this.params = params;
    this.fifo = new SampleFIFO(params.sampleReq + feedLimit);
    this.mid = new Int16Array(params.overlapFrames);
    this.skipFraction = 0;
    this.iterations = 0;
  }

  push(samples, emit) {
    this.fifo.append(samples);
    const p = this.params;
    while (this.fifo.length >= p.sampleReq) {
      const data = this.fifo.data;
      const position = this.fifo.start + _streamingDSP.seekBest(data, this.fifo.start, this.mid, 1, p);
      const output = new Int16Array(p.batchFrames);
      for (let i = 0; i < p.overlapFrames; i++) {
        output[i] = clamp16(Math.trunc(((p.overlapFrames - i) * this.mid[i] + i * data[position + i]) / p.overlapFrames));
      }
      const centralStart = position + p.overlapFrames;
      const centralFrames = p.sequenceFrames - 2 * p.overlapFrames;
      output.set(data.subarray(centralStart, centralStart + centralFrames), p.overlapFrames);
      const tailStart = position + p.sequenceFrames - p.overlapFrames;
      this.mid.set(data.subarray(tailStart, tailStart + p.overlapFrames));
      this.skipFraction = f32(this.skipFraction + p.nominalSkip);
      const skip = Math.trunc(this.skipFraction);
      this.skipFraction = f32(this.skipFraction - skip);
      this.fifo.consume(skip);
      this.iterations++;
      emit(output);
    }
  }
}

/**
 * Persistent mono pitch shifter, called from a Worker rather than an
 * AudioWorklet render callback. push() returns newly available output only.
 * It may return zero frames or a full WSOLA batch. It never pads or flushes.
 */
export class StreamingPitchShifter {
  constructor(sampleRate, semitones, options = {}) {
    validate(sampleRate, semitones);
    if (!options || typeof options !== "object") throw new TypeError("options must be an object");
    if ((options.channels ?? 1) !== 1) throw new RangeError("Streaming DSP supports mono only");
    this.sampleRate = sampleRate;
    this.semitones = semitones;
    this.channels = 1;
    this.resetCount = 0;
    this._initialize();
  }

  _initialize() {
    this._params = _streamingDSP.parameters(this.sampleRate, this.semitones);
    this._inputFrames = 0;
    this._outputFrames = 0;
    this._pushCount = 0;
    this._firstOutputAtInputFrames = null;
    this._sanitizedSamples = 0;
    this._clippedInputSamples = 0;
    if (this.semitones === 0) {
      this._rate = this._fir = this._td = null;
      this._minimumInputFrames = 0;
      return;
    }
    const p = this._params;
    this._rate = new IntegerRateTransposer(p.q16Step);
    const largestResampledChunk = Math.ceil(INTERNAL_CHUNK * SCALE / p.q16Step) + 2;
    this._fir = new StreamingFIR(_streamingDSP.makeCoefficients(p.rate),
      p.rate > 1 ? p.batchFrames : largestResampledChunk);
    this._td = new StreamingTDStretch(p, p.rate > 1 ? INTERNAL_CHUNK : largestResampledChunk);
    this._minimumInputFrames = p.rate > 1 ? p.sampleReq : Math.ceil((p.sampleReq + TAPS - 1) * p.q16Step / SCALE);
  }

  /** Discard all pending audio and restart with the current pitch. */
  reset() {
    this.resetCount++;
    this._initialize();
    return this.getStats();
  }

  /** A pitch change intentionally clears phase/FIFOs and starts a new segment. */
  setPitch(semitones) {
    validate(this.sampleRate, semitones);
    this.semitones = semitones;
    return this.reset();
  }

  push(input) {
    if (!(input instanceof Float32Array)) throw new TypeError("push expects a mono Float32Array");
    this._pushCount++;
    if (input.length === 0) return new Float32Array(0);
    if (this.semitones === 0) {
      const copy = new Float32Array(input.length);
      for (let i = 0; i < input.length; i++) {
        if (Number.isFinite(input[i])) copy[i] = input[i];
        else { copy[i] = 0; this._sanitizedSamples++; }
      }
      this._inputFrames += input.length;
      this._outputFrames += copy.length;
      if (this._firstOutputAtInputFrames === null) this._firstOutputAtInputFrames = this._inputFrames;
      return copy;
    }
    const outputParts = [];
    let outputLength = 0;
    const emit = output => {
      if (output.length !== 0) {
        outputParts.push(output);
        outputLength += output.length;
      }
    };
    // Bound every internal feed even if a caller supplies a very large push.
    for (let start = 0; start < input.length; start += INTERNAL_CHUNK) {
      const end = Math.min(start + INTERNAL_CHUNK, input.length);
      const pcm = new Int16Array(end - start);
      for (let i = start; i < end; i++) {
        let value = input[i];
        if (!Number.isFinite(value)) { value = 0; this._sanitizedSamples++; }
        if (value < -1 || value > 1) this._clippedInputSamples++;
        pcm[i - start] = clamp16(nearestSigned(Math.max(-1, Math.min(1, value)) * 32768));
      }
      if (this._params.rate > 1) {
        this._td.push(pcm, batch => emit(this._rate.push(this._fir.push(batch))));
      } else {
        this._td.push(this._fir.push(this._rate.push(pcm)), emit);
      }
    }
    this._inputFrames += input.length;
    this._outputFrames += outputLength;
    if (outputLength > 0 && this._firstOutputAtInputFrames === null) {
      this._firstOutputAtInputFrames = this._inputFrames;
    }
    const output = new Float32Array(outputLength);
    let cursor = 0;
    for (const part of outputParts) {
      for (let i = 0; i < part.length; i++) output[cursor++] = part[i] / 32768;
    }
    return output;
  }

  getStats() {
    const p = this._params;
    const bypass = this.semitones === 0;
    const tdFIFO = this._td?.fifo;
    const firFIFO = this._fir?.fifo;
    const stateBufferBytes = bypass ? 0 : tdFIFO.data.byteLength + firFIFO.data.byteLength +
      this._td.mid.byteLength + this._fir.coefficients.byteLength;
    return {
      version: DSP_VERSION,
      mode: "stateful-streaming-mono",
      sampleRate: this.sampleRate,
      semitones: this.semitones,
      channels: 1,
      bypass,
      pitchRatio: bypass ? 1 : p.rate,
      tempo: bypass ? 1 : p.tempo,
      q16Step: bypass ? SCALE : p.q16Step,
      inputFrames: this._inputFrames,
      outputFrames: this._outputFrames,
      pushCount: this._pushCount,
      bufferedInputFrames: tdFIFO?.length ?? 0,
      bufferedInputFrameDomain: p.rate < 1 ? "resampled-before-stretch" : "source-before-stretch",
      tdBufferedFrames: tdFIFO?.length ?? 0,
      firBufferedFrames: firFIFO?.length ?? 0,
      bufferedOutputFrames: 0,
      sequenceMs: bypass ? 0 : p.sequenceMs,
      seekMs: bypass ? 0 : p.seekMs,
      overlapFrames: bypass ? 0 : p.overlapFrames,
      sampleReq: bypass ? 0 : p.sampleReq,
      minInputLatencyFrames: this._minimumInputFrames,
      minInputLatencyMs: this._minimumInputFrames / this.sampleRate * 1000,
      nominalOutputBatchFrames: bypass ? 0 : p.rate > 1 ? p.batchFrames * SCALE / p.q16Step : p.batchFrames,
      nominalInputBatchFrames: bypass ? 0 : p.rate > 1 ? p.nominalSkip : p.nominalSkip * p.q16Step / SCALE,
      tdOutputBatchFrames: bypass ? 0 : p.batchFrames,
      tdIterations: this._td?.iterations ?? 0,
      firstOutputAtInputFrames: this._firstOutputAtInputFrames,
      phaseQ16: this._rate?.phase ?? 0,
      sanitizedSamples: this._sanitizedSamples,
      clippedInputSamples: this._clippedInputSamples,
      aaTaps: bypass ? 0 : TAPS,
      quickSeek: false,
      internalChunkFrames: INTERNAL_CHUNK,
      memoryBounded: true,
      stateBufferBytes,
      tdBufferLimitFrames: tdFIFO?.limit ?? 0,
      firBufferLimitFrames: firFIFO?.limit ?? 0,
      tdBufferCapacityFrames: tdFIFO?.data.length ?? 0,
      firBufferCapacityFrames: firFIFO?.data.length ?? 0,
      maxTdBufferedFrames: tdFIFO?.highWater ?? 0,
      maxFirBufferedFrames: firFIFO?.highWater ?? 0,
      resetCount: this.resetCount,
      memoryNote: "Persistent typed buffers have fixed per-configuration capacities; excludes caller input, returned arrays and JS object overhead.",
      latencyNote: "Fresh-state algorithm frame-availability model, not microphone/speaker end-to-end latency. No tail padding or flushing in push()."
    };
  }
}
