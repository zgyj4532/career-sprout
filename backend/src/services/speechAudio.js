import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { campusError } from '../campus/errors.js';

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_SPEECH_SECONDS = 180;
const MAX_DECODED_BYTES = 6 * 1024 * 1024;
export function assertAudioInput(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw campusError(422, 'ASR_EMPTY_AUDIO', '录音为空，请重新录音。');
  if (buffer.length > MAX_AUDIO_BYTES) throw campusError(413, 'ASR_TOO_LARGE', '录音文件过大，请缩短后重试。');
}
export function assertSpeechOutput(bytes, duration) {
  if (bytes > MAX_DECODED_BYTES || duration > MAX_SPEECH_SECONDS) throw campusError(422, 'ASR_TOO_LONG', '录音超过三分钟或解码上限，请缩短后重试。');
  if (!Number.isFinite(duration) || duration < 0.4) throw campusError(422, 'ASR_SILENCE', '录音里没有足够的可用语音，请重新录音。');
}
export function pcmWavDuration(buffer) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return null;
  let rate = 0, size = null;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const length = buffer.readUInt32LE(offset + 4), start = offset + 8;
    if (start + length > buffer.length) return null;
    const type = buffer.toString('ascii', offset, offset + 4);
    if (type === 'fmt ' && length >= 16) {
      if (buffer.readUInt16LE(start) !== 1) return null;
      const channels = buffer.readUInt16LE(start + 2), sampleRate = buffer.readUInt32LE(start + 4), block = buffer.readUInt16LE(start + 12), bits = buffer.readUInt16LE(start + 14);
      if (!channels || channels > 8 || !sampleRate || sampleRate > 192000 || ![8, 16, 24, 32].includes(bits) || block !== channels * bits / 8 || buffer.readUInt32LE(start + 8) !== sampleRate * block) throw campusError(422, 'ASR_INVALID_AUDIO', '音频文件头无效，请重新录音。');
      rate = buffer.readUInt32LE(start + 8);
    }
    if (type === 'data') size = length;
    offset = start + length + (length % 2);
  }
  return rate > 0 && size !== null ? size / rate : null;
}
function runFfmpeg(bin, args, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'], timeout: 30000, killSignal: 'SIGKILL' });
    let stderr = '', failure;
    const abort = () => child.kill('SIGKILL');
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-16000); });
    child.on('error', (error) => { failure = error; });
    // close, not error/exit: do not release admission before the process/stdio end.
    child.on('close', (code) => {
      signal?.removeEventListener('abort', abort);
      if (signal?.aborted) return reject(signal.reason);
      if (failure || code !== 0) return reject(campusError(502, 'ASR_CONVERT', '录音格式转换失败，请重录或使用文字输入。'));
      resolve(stderr);
    });
  });
}
export async function prepareSpeechAudio(buffer, signal) {
  assertAudioInput(buffer);
  signal?.throwIfAborted();
  const directDuration = pcmWavDuration(buffer);
  if (directDuration !== null) {
    assertSpeechOutput(buffer.length, directDuration);
    return { buffer, mime: 'audio/wav' };
  }
  const dir = await mkdtemp(path.join(tmpdir(), 'campus-asr-'));
  try {
    const input = path.join(dir, 'input'), output = path.join(dir, 'output.wav');
    await writeFile(input, buffer, { signal });
    const bin = process.env.FFMPEG_PATH || '/mnt/c/Users/ll/scoop/shims/ffmpeg.exe';
    const argument = (file) => bin.endsWith('.exe') ? execFileSync('wslpath', ['-w', file], { encoding: 'utf8', timeout: 5000, maxBuffer: 4096 }).trim() : file;
    signal?.throwIfAborted();
    const log = await runFfmpeg(bin, ['-nostdin', '-y', '-i', argument(input), '-vn', '-t', '181', '-fs', String(MAX_DECODED_BYTES), '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', argument(output)], signal);
    const bytes = (await stat(output)).size;
    if (bytes >= MAX_DECODED_BYTES) throw campusError(422, 'ASR_TOO_LONG', '录音解码超过上限，请缩短后重试。');
    const decoded = await readFile(output, { signal });
    const duration = pcmWavDuration(decoded);
    assertSpeechOutput(bytes, duration ?? NaN);
    // The output cap decodes one extra second to detect overlength instead of silently accepting a truncated recording.
    const declared = log.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (declared) assertSpeechOutput(bytes, Number(declared[1]) * 3600 + Number(declared[2]) * 60 + Number(declared[3]));
    return { buffer: decoded, mime: 'audio/wav' };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
