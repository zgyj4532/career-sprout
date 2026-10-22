import { before, after, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Interview from '../../models/Interview.model.js';
import UserProfile from '../../models/UserProfile.model.js';
import Resume from '../../models/Resume.model.js';
import { CampusStudent, CampusDiscoveryConfirmation, CampusSaveOperation } from '../models.js';

let memory, confirmations, saves, workflow, cache;
before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.REDIS_URL = '';
  process.env.CACHE_ENABLED = 'false';
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri());
  await Promise.all([UserProfile.init(), CampusStudent.init(), CampusDiscoveryConfirmation.init(), CampusSaveOperation.init()]);
  confirmations = await import('../discoveryConfirmation.js');
  saves = await import('../materialSave.js');
  workflow = await import('../../services/interviewWorkflow.js');
  cache = await import('../../middleware/cacheLayer.js');
});
after(async () => {
  mock.restoreAll();
  await cache?.closeCacheConnection();
  await mongoose.disconnect();
  await memory?.stop();
});

async function sessionFor(uid) {
  return Interview.create({ userId: uid, purpose: 'discovery', jobRole: '交流', industry: '交流', experienceLevel: 'unknown', mode: 'behavioral', status: 'completed', answers: [{ questionId: 'a1', question: '你的兴趣？', transcript: '我喜欢画画' }], discovery: { summary: '我喜欢画画', advice: [], candidates: [{ id: 'interest-a1', kind: 'interest', value: '画画', source: { questionId: 'a1', excerpt: '我喜欢画画' } }] } });
}
const bodyFor = (view) => ({ candidates: view.candidates.map(({ id, value }) => ({ id, value })), expected: view.expected, resolutions: {} });

test('atomic target receipt survives response loss and later edits before ledger checkpoint', async () => {
  const uid = 'receipt-loss';
  await CampusStudent.create({ uid, interests: ['原有'] });
  const session = await sessionFor(uid);
  const body = bodyFor(await confirmations.confirmationView(session));
  const original = CampusStudent.collection.updateOne.bind(CampusStudent.collection);
  let injected = false;
  const controlled = mock.method(CampusStudent.collection, 'updateOne', async (...args) => {
    const result = await original(...args);
    if (!injected && args[1]?.$addToSet?.confirmationReceipts) {
      injected = true;
      await original({ uid }, { $set: { interests: ['写入后用户手改'] } });
      throw new Error('controlled lost acknowledgement after target commit');
    }
    return result;
  });
  await assert.rejects(() => confirmations.confirmDiscovery(session, body));
  controlled.mock.restore();
  const view = await confirmations.confirmDiscovery(session, body);
  assert.equal(view.status, 'completed');
  assert.deepEqual((await CampusStudent.findOne({ uid })).interests, ['写入后用户手改']);
});

test('concurrent ordinary interest edit makes CAS fail without losing either source', async () => {
  const uid = 'interest-race';
  await CampusStudent.create({ uid, interests: ['旧值'] });
  const session = await sessionFor(uid);
  const body = bodyFor(await confirmations.confirmationView(session));
  const original = CampusStudent.collection.updateOne.bind(CampusStudent.collection);
  let injected = false;
  const controlled = mock.method(CampusStudent.collection, 'updateOne', async (...args) => {
    if (!injected && args[1]?.$addToSet?.confirmationReceipts) { injected = true; await original({ uid }, { $set: { interests: ['其他页面'] } }); }
    return original(...args);
  });
  await assert.rejects(() => confirmations.confirmDiscovery(session, body), { code: 'PROFILE_CONFLICT' });
  controlled.mock.restore();
  assert.deepEqual((await CampusStudent.findOne({ uid })).interests, ['其他页面']);
  await confirmations.confirmDiscovery(session, body);
  assert.deepEqual((await CampusStudent.findOne({ uid })).interests, ['其他页面', '画画']);
});

test('material write acknowledgement loss recovers original identity without duplicate create', async () => {
  const uid = 'save-loss';
  const body = { operationId: 'lost-create-01', originalText: '材料原文', title: '材料' };
  const original = CampusSaveOperation.updateOne.bind(CampusSaveOperation);
  let fail = true;
  const controlled = mock.method(CampusSaveOperation, 'updateOne', async (...args) => {
    if (fail && args[1]?.$set?.status === 'completed') { fail = false; throw new Error('controlled ledger checkpoint failure'); }
    return original(...args);
  });
  await assert.rejects(() => saves.saveMaterial({ kind: 'resume', uid, body }));
  controlled.mock.restore();
  assert.equal(await Resume.countDocuments({ userId: uid }), 1);
  const recovered = await saves.recoverMaterialSave('resume', uid, body.operationId);
  assert.equal((await saves.saveMaterial({ kind: 'resume', uid, body })).id, recovered.id);
  assert.equal(await Resume.countDocuments({ userId: uid }), 1);
});

test('completion admits one generation and failed provider allows deliberate retry', async () => {
  const session = await Interview.create({ userId: 'complete-race', purpose: 'discovery', jobRole: '交流', industry: '交流', experienceLevel: 'unknown', answers: [{ questionId: 'a1', question: '兴趣？', transcript: '我喜欢画画' }] });
  let entered, release, calls = 0;
  const ready = new Promise((resolve) => { entered = resolve; });
  const held = new Promise((resolve) => { release = resolve; });
  const completion = workflow.completeInterview(session.id, 'complete-race', { generateContent: async () => { calls++; entered(); await held; throw new Error('controlled failure'); } });
  await ready;
  await assert.rejects(() => workflow.completeInterview(session.id, 'complete-race', { generateContent: async () => { throw new Error('not called'); } }), { code: 'GENERATION_PENDING' });
  release();
  await assert.rejects(() => completion, { code: 'DISCOVERY_GENERATION_FAILED' });
  const completed = await workflow.completeInterview(session.id, 'complete-race', { generateContent: async () => { calls++; return { text: JSON.stringify({ summarySources: [{ questionId: 'a1', excerpt: '我喜欢画画' }], advice: [], candidates: [] }) }; } });
  assert.equal(completed.status, 'completed');
  assert.equal(calls, 2);
});

test('new formal completion persists full text-only score and exact observation coverage', async () => {
  const session = await Interview.create({ userId: 'formal', purpose: 'interview', scoreVersion: 'available-v1', mode: 'mixed', jobRole: '岗位', industry: '行业', experienceLevel: 'entry', answers: [{ questionId: 'q1', question: '问题', transcript: '真实回答', analysis: { relevance: 100, clarity: 100, confidence: 100 }, observations: { relevance: true, clarity: true, confidence: true, expression: false } }] });
  const saved = await workflow.completeInterview(session.id, 'formal', { generateContent: async () => ({ text: JSON.stringify({ summary: '针对回答的总结', topStrengths: [], areasToImprove: [], recommendations: ['补充具体行动'] }) }) });
  assert.equal(saved.overallScore, 100);
  assert.equal(saved.scoring.dimensions.expression.score, null);
  assert.equal(saved.scoring.dimensions.expression.observed, 0);
  assert.equal(saved.scoring.dimensions.expression.answered, 1);
  assert.equal(saved.scoring.dimensions.relevance.observed, 1);
  const replay = await workflow.completeInterview(session.id, 'formal', { generateContent: async () => { throw new Error('completed result must not regenerate'); } });
  assert.deepEqual(replay.scoring, saved.scoring);
});
