/** @file 生成浏览器回归的模拟麦克风与 Playwright CLI 配置，不使用真实设备。 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve('output/playwright');
await mkdir(directory, { recursive: true });
const rate = 48000;
const frames = rate * 4;
const wav = Buffer.alloc(44 + frames * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(frames * 2, 40);
for (let i = 0; i < frames; i++) wav.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * 200 * i / rate)), 44 + i * 2);
const microphone = resolve(directory, 'vfs-tone200.wav');
await writeFile(microphone, wav);
await writeFile(resolve(directory, 'vfs-audio-cli.json'), JSON.stringify({ browser: {
  browserName: 'chromium', launchOptions: { channel: 'chrome', headless: true, args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${microphone}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  ] }, contextOptions: { permissions: ['microphone'], viewport: { width: 1280, height: 960 } },
} }, null, 2));
