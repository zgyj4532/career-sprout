import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CampusImportDraft, CampusImportQuota, CampusJob } from '../models.js';
import { createQuotaBook } from '../importQuota.js';
import { requestDiagnostics } from '../../utils/diagnostics.js';
import { globalErrorHandler } from '../../middleware/globalErrorHandler.js';

let memory, server, directory, previousRoot, previousEnv;
let uid = 'job-image-owner';
const book = createQuotaBook(CampusImportQuota);
before(async () => {
  previousEnv = process.env.NODE_ENV;
  previousRoot = process.env.CAMPUS_IMPORT_DIR;
  process.env.NODE_ENV = 'test';
  directory = await mkdtemp(path.join(os.tmpdir(), 'campus-job-images-test-'));
  process.env.CAMPUS_IMPORT_DIR = directory;
  const { default: routes } = await import('../jobImages.js');
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri());
  const app = express();
  app.use(requestDiagnostics, express.json());
  app.use((req, _res, next) => { req.user = { uid }; next(); });
  app.use(routes, globalErrorHandler);
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (memory) await memory.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
  if (previousRoot === undefined) delete process.env.CAMPUS_IMPORT_DIR; else process.env.CAMPUS_IMPORT_DIR = previousRoot;
  if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv;
});
async function call(url, method = 'GET', body) {
  return fetch(`http://127.0.0.1:${server.address().port}${url}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
}

test('retained screenshot recovery is owner scoped and discard cannot race active processing', async () => {
  const bytes = Buffer.from('private synthetic image fixture');
  const filePath = path.join(directory, 'retained.png');
  await writeFile(filePath, bytes);
  const draft = await CampusImportDraft.create({ userId: uid, purpose: 'job', status: 'ready', files: [{ id: 'image-1', filePath, mime: 'image/png', kind: 'png', bytes: bytes.length }], result: { candidates: [{ id: 'job-1', title: '合成岗位', company: '测试单位', description: '整理文档', sourcePages: [1] }] } });
  await book.reserve({ uid, bytes: bytes.length, draftId: String(draft._id) });
  let response = await call(`/jobs/images/${draft._id}/source/0`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  const view = await (await call(`/jobs/images/${draft._id}`)).json();
  assert.equal(view.data.candidates[0].title, '合成岗位');
  assert.equal(JSON.stringify(view).includes(filePath), false);
  uid = 'different-student';
  assert.equal((await call(`/jobs/images/${draft._id}`)).status, 404);
  assert.equal((await call(`/jobs/images/${draft._id}/source/0`)).status, 404);
  assert.equal((await call(`/jobs/images/${draft._id}`, 'DELETE')).status, 404);
  assert.deepEqual((await (await call('/jobs/images')).json()).data.items, []);
  uid = 'job-image-owner';
  await CampusImportDraft.updateOne({ _id: draft._id }, { $set: { leaseUntil: new Date(Date.now() + 60000), status: 'processing' } });
  assert.equal((await call(`/jobs/images/${draft._id}`, 'DELETE')).status, 409);
  assert.equal((await call(`/jobs/images/${draft._id}/continue`, 'POST')).status, 409);
  await CampusImportDraft.updateOne({ _id: draft._id }, { $set: { leaseUntil: null, status: 'ready' } });
  assert.equal((await call(`/jobs/images/${draft._id}/saved`, 'POST', { jobId: String(new mongoose.Types.ObjectId()) })).status, 404);
  const job = await CampusJob.create({ creatorUid: uid, authorKind: 'student', title: '合成岗位', company: '测试单位', description: '整理文档', status: 'draft' });
  assert.equal((await call(`/jobs/images/${draft._id}/saved`, 'POST', { jobId: String(job._id) })).status, 200);
  assert.equal((await CampusImportQuota.findById('imports').lean()).holds[String(draft._id)].unfinished, false);
  assert.equal((await call(`/jobs/images/${draft._id}/source/0`)).status, 200);
  assert.equal((await call(`/jobs/images/${draft._id}`, 'DELETE')).status, 200);
  assert.equal(await CampusImportDraft.findById(draft._id), null);
  assert.equal((await book.snapshot()).globalBytes, 0);
  assert.equal((await call(`/jobs/images/${draft._id}/source/0`)).status, 404);
});

test('invalid image upload releases its durable reservation and does not call the model', async () => {
  const body = new FormData();
  body.append('images', new Blob(['not an image'], { type: 'text/plain' }), 'invalid.txt');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/jobs/images`, { method: 'POST', body });
  assert.equal(response.status, 415);
  assert.equal((await response.json()).code, 'IMPORT_TYPE');
  assert.equal(await CampusImportDraft.countDocuments({ userId: uid, purpose: 'job' }), 0);
  assert.equal((await book.snapshot()).globalBytes, 0);
});

test('retry cannot reorder or delete retained screenshot sources', async () => {
  const files = [{ id: 'image-1', filePath: path.join(directory, 'one.png'), mime: 'image/png', kind: 'png', bytes: 3 }, { id: 'image-2', filePath: path.join(directory, 'two.png'), mime: 'image/png', kind: 'png', bytes: 3 }];
  for (const file of files) await writeFile(file.filePath, 'one');
  const draft = await CampusImportDraft.create({ userId: uid, purpose: 'job', status: 'busy', files, bytes: 6 });
  await book.reserve({ uid, bytes: 6, draftId: String(draft._id) });
  for (const order of [['image-2', 'image-1'], ['image-1']]) {
    const response = await call(`/jobs/images/${draft.id}/continue`, 'POST', { order });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'IMPORT_INPUT_CHANGED');
  }
  const retained = await CampusImportDraft.findById(draft.id).lean();
  assert.deepEqual(retained.files.map(file => file.id), ['image-1', 'image-2']);
  assert.equal(retained.bytes, 6);
  assert.equal((await call(`/jobs/images/${draft.id}/source/1`)).status, 200);
  assert.equal((await call(`/jobs/images/${draft.id}`, 'DELETE')).status, 200);
});
