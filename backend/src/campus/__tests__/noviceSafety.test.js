import { before, after, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Interview from '../../models/Interview.model.js';
import UserProfile from '../../models/UserProfile.model.js';
import Resume from '../../models/Resume.model.js';
import { CampusStudent, CampusDiscoveryConfirmation, CampusSaveOperation, CampusAccountWriteState } from '../models.js';
import { groundDiscoveryResult } from '../../services/discoveryService.js';

let memory, confirmations, saves, deletion, account, erasure, answers, profile, providers, service, cache;
before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.REDIS_URL = '';
  process.env.CACHE_ENABLED = 'false';
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri());
  await Promise.all([UserProfile.init(), CampusStudent.init(), CampusDiscoveryConfirmation.init(), CampusSaveOperation.init(), CampusAccountWriteState.init()]);
  confirmations = await import('../discoveryConfirmation.js');
  saves = await import('../materialSave.js');
  deletion = await import('../resumeDelete.js');
  account = await import('../accountWrites.js');
  erasure = await import('../../routes/gdpr.js');
  answers = await import('../../services/interviewAnswers.js');
  profile = await import('../profileWrite.js');
  providers = await import('../../config/aiProviders.js');
  service = await import('../../services/interviewService.js');
  cache = await import('../../middleware/cacheLayer.js');
});
after(async () => { mock.restoreAll(); await cache?.closeCacheConnection(); await mongoose.disconnect(); await memory?.stop(); });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
async function sessionFor(uid, candidates) {
  return Interview.create({ userId: uid, purpose: 'discovery', jobRole: '交流', industry: '交流', experienceLevel: 'unknown', status: 'completed', discovery: { candidates, summary: '', advice: [] } });
}
const bodyFor = (view) => ({ candidates: view.candidates.map(({ id, value, state }) => ({ id, value, ...(state ? { state } : {}) })), expected: view.expected, resolutions: {} });
function extract(transcript, candidate, question = '请讲讲你自己', excerpt = transcript) {
  const source = { questionId: 'q', excerpt };
  return groundDiscoveryResult({ summarySources: [source], advice: [], candidates: [{ ...candidate, source }] }, { _id: 'fixture', answers: [{ questionId: 'q', question, transcript }] });
}

test('candidate relations reject other people, quotes and negated completion but retain clear self statements', () => {
  assert.equal(extract('我的朋友是大一学生', { kind: 'collegeStudent', value: true }).candidates.length, 0);
  assert.equal(extract('我朋友的专业是数学', { kind: 'major', value: '数学' }).candidates.length, 0);
  assert.equal(extract('她说：“我是大一学生”', { kind: 'collegeStudent', value: true }).candidates.length, 0);
  assert.equal(extract('我没有完成网站开发', { kind: 'experience', value: '网站开发', state: 'completed' }).candidates.length, 0);
  assert.ok(extract('我没有完成网站开发', { kind: 'experience', value: '网站开发', state: 'completed' }).uncertainties.length);
  assert.equal(extract('目前大二', { kind: 'collegeStudent', value: true }, '你现在读大学吗，几年级？').candidates[0].value, true);
  assert.equal(extract('本人就读于大学，专业是数学', { kind: 'major', value: '数学' }).candidates[0].value, '数学');
  assert.equal(extract('我不是大学生', { kind: 'collegeStudent', value: false }).candidates[0].value, false);
  assert.equal(extract('我正在做网站，但还没有完成', { kind: 'experience', value: '网站', state: 'completed' }).candidates[0].state, 'in_progress');
  assert.equal(extract('我不是大学生', { kind: 'collegeStudent', value: true }, '请讲讲你自己', '大学生').candidates.length, 0);
  assert.equal(extract('我没有完成网站开发', { kind: 'experience', value: '网站开发', state: 'completed' }, '请讲讲你自己', '完成网站开发').candidates.length, 0);
  const planned = extract('我正在计划做一个网站，还没开始', { kind: 'experience', value: '网站', state: 'idea' }, '请讲讲你自己', '做一个网站');
  assert.equal(planned.candidates[0].state, 'idea');
  assert.equal(planned.candidates[0].value, '我正在计划做一个网站，还没开始');
  assert.equal(planned.candidates[0].source.excerpt, planned.candidates[0].value);
  assert.equal(planned.summary, planned.candidates[0].value);
  const underway = extract('我正在做网站，但还没有完成', { kind: 'experience', value: '网站', state: 'completed' }, '请讲讲你自己', '做网站');
  assert.equal(underway.candidates[0].state, 'in_progress');
  assert.equal(underway.candidates[0].value, '我正在做网站，但还没有完成');
});

test('legacy true remains known and conflicting, legacy false and explicit null remain unknown', async () => {
  assert.equal(profile.profileJson({ collegeStudent: true }).collegeStudentKnown, true);
  assert.equal(confirmations.profileTargets({ collegeStudent: true }).collegeStudent, true);
  assert.equal(profile.profileJson({ collegeStudent: false }).collegeStudent, null);
  assert.equal(profile.profileJson({ collegeStudent: null, collegeStudentKnown: false }).collegeStudent, null);
  const uid = 'legacy-true-conflict';
  await UserProfile.collection.insertOne({ uid, collegeStudent: true });
  const session = await sessionFor(uid, [{ id: 'identity', kind: 'collegeStudent', value: false, source: { questionId: 'q', excerpt: '我不是大学生' } }]);
  const body = bodyFor(await confirmations.confirmationView(session));
  await assert.rejects(() => confirmations.confirmDiscovery(session, body), { code: 'PROFILE_CONFLICT' });
});

test('capacity growth before first write releases frozen confirmation for review', async () => {
  const uid = 'capacity-race';
  await CampusStudent.create({ uid, interests: Array.from({ length: 19 }, (_, i) => `兴趣${i}`) });
  const session = await sessionFor(uid, [{ id: 'interest', kind: 'interest', value: '画画', source: { questionId: 'q', excerpt: '我喜欢画画' } }]);
  const body = bodyFor(await confirmations.confirmationView(session));
  const original = CampusDiscoveryConfirmation.create.bind(CampusDiscoveryConfirmation);
  const intercept = mock.method(CampusDiscoveryConfirmation, 'create', async (...args) => {
    const value = await original(...args);
    await CampusStudent.updateOne({ uid }, { $push: { interests: '并发兴趣' } });
    return value;
  });
  await assert.rejects(() => confirmations.confirmDiscovery(session, body), { code: 'PROFILE_CAPACITY' });
  intercept.mock.restore();
  assert.equal((await confirmations.confirmationView(session)).status, 'unconfirmed');
  assert.equal((await Interview.findById(session.id)).confirmationPending, false);
  assert.equal((await confirmations.confirmDiscovery(session, { ...body, candidates: [] })).status, 'completed');
});

test('expired pending generation is cancelled atomically before answer and old token cannot commit', async () => {
  const uid = 'expired-generation';
  const session = await Interview.create({ userId: uid, purpose: 'discovery', jobRole: '交流', industry: '交流', experienceLevel: 'unknown', questions: [{ questionId: 'q', question: '问题？' }], generation: { kind: 'complete', status: 'pending', token: 'old-token', leaseUntil: new Date(0) } });
  const saved = await answers.persistInterviewAnswer({ id: session.id, userId: uid, questionId: 'q', answerCount: 0, update: { $push: { answers: { questionId: 'q', question: '问题？', transcript: '恢复后回答' } } } });
  assert.equal(saved.answers.length, 1);
  assert.equal(saved.generation.status, 'failed');
  assert.equal(saved.generation.token, undefined);
  const stale = await Interview.updateOne({ _id: session.id, 'generation.token': 'old-token', 'generation.status': 'pending' }, { $set: { status: 'completed' } });
  assert.equal(stale.matchedCount, 0);
});

test('active confirmation cannot be overtaken just because its lease expired; keep records a target receipt', async () => {
  const uid = 'confirmation-fence';
  await UserProfile.create({ uid, education: [{ field: '数学' }] });
  const session = await sessionFor(uid, [{ id: 'major', kind: 'major', value: '物理', source: { questionId: 'q', excerpt: '我的专业是物理' } }]);
  const body = bodyFor(await confirmations.confirmationView(session));
  body.resolutions.major = 'keep';
  const entered = deferred(), release = deferred();
  const original = UserProfile.collection.updateOne.bind(UserProfile.collection);
  const intercept = mock.method(UserProfile.collection, 'updateOne', async (...args) => {
    if (args[1]?.$addToSet?.confirmationReceipts) { entered.resolve(); await release.promise; }
    return original(...args);
  });
  const first = confirmations.confirmDiscovery(session, body);
  await entered.promise;
  await CampusDiscoveryConfirmation.updateOne({ interviewId: session._id }, { $set: { leaseUntil: new Date(0) } });
  await assert.rejects(() => confirmations.confirmDiscovery(session, { ...body, resolutions: { major: 'replace' } }), { code: 'CONFIRMATION_PENDING' });
  release.resolve();
  await first;
  intercept.mock.restore();
  const saved = await UserProfile.findOne({ uid }).lean();
  assert.equal(saved.education[0].field, '数学');
  assert.ok(saved.confirmationReceipts.includes(session.id));
  await confirmations.confirmDiscovery(session, { ...body, resolutions: { major: 'replace' } });
  assert.equal((await UserProfile.findOne({ uid })).education[0].field, '数学');
});

test('resume deletion scrubs operation snapshots and pending create retries cannot resurrect', async () => {
  const uid = 'deleted-operation';
  const body = { operationId: 'delete-save-01', originalText: '敏感材料不得残留', title: '私有材料' };
  const saved = await saves.saveMaterial({ kind: 'resume', uid, body });
  await CampusSaveOperation.updateOne({ userId: uid }, { $set: { status: 'pending' } });
  await account.withAccountWrite(uid, async () => {
    const entered = deferred(), release = deferred();
    const deletionInProgress = deletion.withResumeLock(saved.id, async () => { entered.resolve(); await release.promise; });
    await entered.promise;
    // Nested account admission enters the resource lock synchronously, so
    // deletion is definitely queued before the stale create retry.
    const deleting = deletion.deleteResumeOwned(saved.id, uid);
    const retry = saves.saveMaterial({ kind: 'resume', uid, body });
    const rejected = assert.rejects(() => retry, (error) => ['MATERIAL_DELETED', 'RESUME_DELETED'].includes(error.code));
    release.resolve();
    await deletionInProgress;
    await deleting;
    await rejected;
  });
  assert.equal(await Resume.countDocuments({ userId: uid }), 0);
  const ledger = await CampusSaveOperation.findOne({ userId: uid }).lean();
  assert.equal(ledger.status, 'cancelled');
  assert.equal(ledger.frozen, undefined);
  assert.equal(ledger.result, undefined);
});

test('erasure drains admitted writes, removes canonical student and snapshots, permits fresh onboarding only', async () => {
  const uid = 'erase-race';
  await CampusStudent.create({ uid, interests: ['私有兴趣'], experiences: [{ id: 'private', fullText: '私有原话', state: 'idea' }] });
  const entered = deferred(), release = deferred();
  const body = { operationId: 'old-operation-01', originalText: '被删除的内容' };
  const original = Resume.prototype.save;
  const intercept = mock.method(Resume.prototype, 'save', async function (...args) { entered.resolve(); await release.promise; return original.apply(this, args); });
  const saving = saves.saveMaterial({ kind: 'resume', uid, body });
  await entered.promise;
  const deleting = erasure.eraseAccountData(uid);
  await assert.rejects(() => saves.saveMaterial({ kind: 'resume', uid, body: { operationId: 'queued-old-01', originalText: '排队的旧内容' } }), { code: 'ACCOUNT_ERASING' });
  release.resolve();
  await saving;
  intercept.mock.restore();
  await deleting;
  assert.equal(await Resume.countDocuments({ userId: uid }), 0);
  assert.equal(await CampusStudent.countDocuments({ uid }), 0);
  assert.equal((await CampusSaveOperation.findOne({ userId: uid })).frozen, undefined);
  await assert.rejects(() => saves.saveMaterial({ kind: 'resume', uid, body }), { code: 'MATERIAL_DELETED' });
  const fresh = await saves.saveMaterial({ kind: 'resume', uid, body: { operationId: 'new-operation-01', originalText: '删除后主动新建' } });
  assert.ok(fresh.id);
});

test('interrupted erasure blocks writes but explicit erasure retry can finish', async () => {
  const uid = 'erase-interrupted';
  await assert.rejects(() => account.withAccountErasure(uid, async () => { throw new Error('controlled interrupted delete'); }));
  await assert.rejects(() => account.withAccountWrite(uid, async () => {}), { code: 'ACCOUNT_ERASING' });
  await account.withAccountErasure(uid, async () => {});
  assert.equal(await account.withAccountWrite(uid, async () => 'new'), 'new');
});

test('Gemini forwards generation bounds and available-score feedback honors selected language', async () => {
  const gemini = providers.createAIProvider('gemini', 'synthetic-key');
  let request, options;
  gemini.model = { generateContent: async (input, requestOptions) => { request = input; options = requestOptions; return { response: { text: () => '{}' } }; } };
  const controller = new AbortController();
  await gemini.generateContent('prompt', { maxTokens: 6000, temperature: 0, signal: controller.signal, timeout: 60000 });
  assert.deepEqual(request.generationConfig, { maxOutputTokens: 6000, temperature: 0 });
  assert.equal(options.signal, controller.signal);
  let prompt;
  await service.generateOverallFeedback({ scoreVersion: 'available-v1', mode: 'mixed', language: 'es', answers: [{ analysis: { relevance: 100 }, transcript: 'Respuesta' }] }, { generateContent: async (text) => { prompt = text; return { text: JSON.stringify({ summary: 'Resumen', topStrengths: [], areasToImprove: [], recommendations: [] }) }; } });
  assert.match(prompt, /MUST be written in Spanish/);
});

test('request awaiting account state before erasure cannot write after reopening', async () => {
  const uid = 'pre-admission-race';
  const entered = deferred(), release = deferred();
  const original = CampusAccountWriteState.findById.bind(CampusAccountWriteState);
  let first = true;
  const intercept = mock.method(CampusAccountWriteState, 'findById', (...args) => {
    if (!first) return original(...args);
    first = false;
    return { lean: async () => { entered.resolve(); await release.promise; return null; } };
  });
  let wrote = false;
  const oldRequest = account.withAccountWrite(uid, async () => { wrote = true; });
  const rejected = assert.rejects(() => oldRequest, { code: 'ACCOUNT_ERASING' });
  await entered.promise;
  await account.withAccountErasure(uid, async () => {});
  release.resolve();
  await rejected;
  intercept.mock.restore();
  assert.equal(wrote, false);
  assert.equal(await account.withAccountWrite(uid, async () => 'fresh'), 'fresh');
});

test('ordinary deployment foreign reads bypass owner cache and omit private discovery fields', async () => {
  const uid = 'private-profile-owner';
  const session = await sessionFor(uid, [
    { id: 'attendance', kind: 'collegeStudent', value: true, source: { questionId: 'q', excerpt: '我是大学生' } },
    { id: 'major', kind: 'major', value: '数学', source: { questionId: 'q', excerpt: '我的专业是数学' } },
  ]);
  await confirmations.confirmDiscovery(session, bodyFor(await confirmations.confirmationView(session)));
  const saved = await UserProfile.findOne({ uid }).lean();
  assert.ok(saved.discoveryPrivateFields.includes('education'));
  const { updateProfileSchema } = await import('../../schemas/userProfile.schema.js');
  const parsed = updateProfileSchema.parse({ displayName: '仍公开的名字', discoveryPrivateFields: [] });
  assert.equal(Object.hasOwn(parsed, 'discoveryPrivateFields'), false);
  await profile.writeProfileFields(UserProfile, uid, parsed, saved.updatedAt.toISOString());
  const router = (await import('../../routes/userProfile.js')).default;
  const route = router.stack.find((layer) => layer.route?.path === '/:uid' && layer.route.methods.get).route;
  const app = express();
  // Trusted identities in this harness; production authentication is unchanged.
  app.use((req, _res, next) => { req.user = { uid: req.headers['x-test-user'] }; req.campusRequest = false; next(); });
  app.get('/profiles/:uid', ...route.stack.map((layer) => layer.handle));
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/profiles/${uid}`;
    const ownerResponse = await fetch(url, { headers: { 'x-test-user': uid } });
    const owner = (await ownerResponse.json()).profile;
    assert.equal(owner.education[0].field, '数学');
    assert.equal(owner.collegeStudent, true);
    for (const suffix of ['', '?fresh=1']) {
      const response = await fetch(`${url}${suffix}`, { headers: { 'x-test-user': 'foreign-account' } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-cache'), 'BYPASS');
      const other = (await response.json()).profile;
      assert.equal(other.displayName, '仍公开的名字');
      assert.equal(Object.hasOwn(other, 'education'), false);
      assert.equal(Object.hasOwn(other, 'collegeStudent'), false);
      assert.equal(Object.hasOwn(other, 'collegeStudentKnown'), false);
    }
    for (const kind of ['collegeStudent', 'major']) {
      const legacyUid = `legacy-private-${kind}`;
      await UserProfile.collection.insertOne({ uid: legacyUid, displayName: '旧确认资料', collegeStudent: true, education: [{ field: '数学' }], confirmationReceipts: ['earlier-confirmation'] });
      const legacyUrl = `http://127.0.0.1:${server.address().port}/profiles/${legacyUid}`;
      const beforeResponse = await fetch(legacyUrl, { headers: { 'x-test-user': 'foreign-account' } });
      const before = (await beforeResponse.json()).profile;
      assert.equal(Object.hasOwn(before, 'education'), false);
      assert.equal(Object.hasOwn(before, 'collegeStudent'), false);
      const candidate = kind === 'collegeStudent'
        ? { id: 'attendance', kind, value: true, source: { questionId: 'q', excerpt: '我是在读大学生' } }
        : { id: 'major', kind, value: '数学', source: { questionId: 'q', excerpt: '我的专业是数学' } };
      const subsequent = await sessionFor(legacyUid, [candidate]);
      await confirmations.confirmDiscovery(subsequent, bodyFor(await confirmations.confirmationView(subsequent)));
      const persisted = await UserProfile.findOne({ uid: legacyUid }).lean();
      assert.deepEqual(new Set(persisted.discoveryPrivateFields), new Set(['collegeStudent', 'collegeStudentKnown', 'education']));
      const afterResponse = await fetch(legacyUrl, { headers: { 'x-test-user': 'foreign-account' } });
      const after = (await afterResponse.json()).profile;
      assert.equal(after.displayName, '旧确认资料');
      assert.equal(Object.hasOwn(after, 'education'), false);
      assert.equal(Object.hasOwn(after, 'collegeStudent'), false);
      assert.equal(Object.hasOwn(after, 'collegeStudentKnown'), false);
    }
  } finally { await new Promise((resolve) => server.close(resolve)); }
  assert.equal(profile.publicProfileJson({ confirmationReceipts: ['old-confirmation'], collegeStudent: true, education: [{ field: '旧确认' }] }).education, undefined);
  assert.equal(profile.publicProfileJson({ collegeStudent: true, education: [{ field: '旧公开' }] }).education[0].field, '旧公开');
});

test('native legacy education comparison still rejects a concurrent field mutation', async () => {
  const uid = 'legacy-bson-cas';
  await UserProfile.collection.insertOne({ uid, education: [{ field: '数学' }], confirmationReceipts: ['prior'] });
  const session = await sessionFor(uid, [{ id: 'major', kind: 'major', value: '物理', source: { questionId: 'q', excerpt: '我的专业是物理' } }]);
  const body = bodyFor(await confirmations.confirmationView(session));
  body.resolutions.major = 'replace';
  const original = UserProfile.collection.updateOne.bind(UserProfile.collection);
  let changed = false;
  const intercept = mock.method(UserProfile.collection, 'updateOne', async (filter, update, ...rest) => {
    if (!changed && update.$addToSet?.confirmationReceipts) {
      changed = true;
      assert.deepEqual(filter.education, [{ field: '数学' }]);
      assert.deepEqual(filter.discoveryPrivateFields, { $exists: false });
      await original({ uid }, { $set: { education: [{ field: '化学' }] } });
    }
    return original(filter, update, ...rest);
  });
  await assert.rejects(() => confirmations.confirmDiscovery(session, body), { code: 'PROFILE_CONFLICT' });
  intercept.mock.restore();
  const saved = await UserProfile.findOne({ uid }).lean();
  assert.deepEqual(saved.education, [{ field: '化学' }]);
  assert.equal(saved.discoveryPrivateFields, undefined);
  assert.equal((await confirmations.confirmationView(session)).status, 'unconfirmed');
});
