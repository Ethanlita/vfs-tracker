import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class MockWasmModule {}

const closeMock = vi.fn(() => Promise.resolve());
const copyToChannelMock = vi.fn();
const createBufferMock = vi.fn(() => ({
  copyToChannel: copyToChannelMock,
}));

const createTemporaryAudioContextMock = vi.fn(() => ({
  context: {
    createBuffer: createBufferMock,
  },
  close: closeMock,
}));

vi.mock('../../../src/utils/audioContextManager', () => ({
  createTemporaryAudioContext: createTemporaryAudioContextMock,
}));

let availableSamples = 0;
let originalFetch;
let originalWebAssembly;

const fakeApi = {
  rubberband_new: vi.fn(() => 1),
  rubberband_set_pitch_scale: vi.fn(),
  rubberband_set_time_ratio: vi.fn(),
  rubberband_set_expected_input_duration: vi.fn(),
  rubberband_get_samples_required: vi.fn(() => 4),
  malloc: vi.fn(() => 1),
  memWritePtr: vi.fn(),
  memWrite: vi.fn(),
  rubberband_study: vi.fn(),
  rubberband_process: vi.fn((state, ptr, remaining) => {
    availableSamples = remaining;
  }),
  rubberband_available: vi.fn(() => availableSamples),
  rubberband_retrieve: vi.fn((state, ptr, toRetrieve) => {
    availableSamples = 0;
    return toRetrieve;
  }),
  memReadF32: vi.fn((ptr, length) => new Float32Array(length)),
  free: vi.fn(),
  rubberband_delete: vi.fn(),
};

const initializeMock = vi.fn(async () => fakeApi);

vi.mock('rubberband-wasm', () => ({
  RubberBandInterface: {
    initialize: initializeMock,
  },
}));

vi.mock('rubberband-wasm/dist/rubberband.wasm?url', () => ({
  default: 'mock-wasm-url',
}), { virtual: true });

vi.mock('rubberband-wasm/dist/rubberband.wasm?init', () => ({
  default: new MockWasmModule(),
}), { virtual: true });

describe('processWithRubberBand', () => {
  beforeEach(() => {
    vi.resetModules();
    availableSamples = 0;
    closeMock.mockClear();
    copyToChannelMock.mockClear();
    createBufferMock.mockClear();
    createTemporaryAudioContextMock.mockClear();

    originalFetch = global.fetch;
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }));

    const compileMock = vi.fn(async () => new MockWasmModule());

    originalWebAssembly = global.WebAssembly;
    global.WebAssembly = {
      compile: compileMock,
      Module: MockWasmModule,
      Instance: class MockInstance {},
    };
  });

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }

    if (originalWebAssembly) {
      global.WebAssembly = originalWebAssembly;
    } else {
      delete global.WebAssembly;
    }
  });

  it('closes the temporary audio context after creating the output buffer', async () => {
    const { processWithRubberBand } = await import('../../../src/utils/rubberbandProcessor.js');

    const audioBuffer = {
      sampleRate: 44100,
      numberOfChannels: 1,
      length: 4,
      getChannelData: vi.fn(() => new Float32Array(4)),
    };

    await processWithRubberBand(audioBuffer, 25);

    expect(createBufferMock).toHaveBeenCalledWith(1, 4, 44100);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
