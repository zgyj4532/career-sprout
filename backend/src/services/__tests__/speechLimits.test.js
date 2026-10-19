import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { assertSpeechOutput, prepareSpeechAudio } from '../speechAudio.js';
import { speechAdmission } from '../../middleware/speechAdmission.js';
import { generatePDF, generatePDFFromHTML, pdfFailureMetadata } from '../pdfGenerator.js';
import { safeErrorMetadata, logEvent } from '../../utils/diagnostics.js';
import { startInterviewSchema } from '../../schemas/interview.schema.js';

export function wavFixture() {
  const audio = Buffer.alloc(44 + 16000);
  audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(16000, 24); audio.writeUInt32LE(32000, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
  audio.write('data', 36); audio.writeUInt32LE(16000, 40); return audio;
}
test('speech duration and decoded bytes reject expansion without truncation', async () => {
  assert.throws(() => assertSpeechOutput(6 * 1024 * 1024 + 1, 10), { code: 'ASR_TOO_LONG' });
  assert.throws(() => assertSpeechOutput(100, 181), { code: 'ASR_TOO_LONG' });
  const audio = wavFixture();
  assert.equal((await prepareSpeechAudio(audio)).buffer, audio);
  audio.writeUInt32LE(1, 24); audio.writeUInt32LE(2, 28);
  await assert.rejects(() => prepareSpeechAudio(audio), { code: 'ASR_TOO_LONG' });
});
test('speech admission rejects before upload and retains slot until aborted work settles', async () => {
  let uploads = 0, finish;
  const middleware = speechAdmission((_req, _res, next) => { uploads++; next(); }, async (req) => {
    await new Promise((resolve) => { finish = resolve; });
    assert.equal(req.speechSignal.aborted, true);
  });
  const req = new EventEmitter(), res = new EventEmitter();
  middleware(req, res, (error) => { if (error) throw error; });
  await Promise.resolve();
  res.emit('close');
  let busy;
  middleware(new EventEmitter(), new EventEmitter(), (error) => { busy = error; });
  assert.equal(busy.code, 'ASR_BUSY'); assert.equal(uploads, 1);
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  let released = false;
  speechAdmission((_req, _res, next) => next(new Error('upload-failed')), async () => {})(new EventEmitter(), new EventEmitter(), (error) => { released = error.message === 'upload-failed'; });
  assert.equal(released, true);
});
test('oversized raw PDFs reject before rendering and context rejects oversized resolved values', async () => {
  await assert.rejects(() => generatePDF('x'.repeat(200001)), { code: 'RESUME_TOO_LONG' });
  await assert.rejects(() => generatePDFFromHTML('中'.repeat(70000)), { code: 'RESUME_TOO_LONG' });
  assert.equal(startInterviewSchema.safeParse({ jobRole: 'x', industry: 'x', experienceLevel: 'x', resumeText: 'x'.repeat(20001) }).success, false);
});
test('safe failures retain network/database causes without private messages', () => {
  assert.deepEqual(safeErrorMetadata({ name: 'APIConnectionError', cause: { code: 'ECONNRESET', message: 'secret' } }), { state: 'APIConnectionError', code: 'ECONNRESET' });
  assert.equal(safeErrorMetadata({ name: 'MongoServerError', code: 18, message: 'mongodb://secret' }).code, 'DATABASE_AUTH_FAILED');
});

test('PDF failure identifies stage and timeout class without source or stack', () => {
  const result = pdfFailureMetadata({ name: 'TimeoutError', message: 'PRIVATE_SOURCE', stack: '/private/path' }, 'print');
  assert.deepEqual(result, { state: 'TimeoutError', stage: 'print', code: 'PDF_TIMEOUT' });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|private/);
});

test('multipart callback restores request correlation for downstream stages', async (t) => {
  process.env.NODE_ENV = 'test';
  const events = [];
  t.mock.method(console, 'log', (line) => { events.push(JSON.parse(line)); });
  const req = new EventEmitter(), res = new EventEmitter();
  req.requestId = 'asr-fixture-123';
  let uploadDone;
  const middleware = speechAdmission((_req, _res, next) => { uploadDone = next; }, async () => { logEvent('asr.stage', { stage: 'provider' }); });
  middleware(req, res, (error) => { if (error) throw error; });
  uploadDone();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.find((event) => event.event === 'asr.stage')?.requestId, req.requestId);
});
