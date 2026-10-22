import { before, after, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Interview from '../../models/Interview.model.js';
import UserProfile from '../../models/UserProfile.model.js';
import Resume from '../../models/Resume.model.js';
import ResumeVersion from '../../models/ResumeVersion.model.js';
import { CampusStudent, CampusDiscoveryConfirmation, CampusSaveOperation, CampusJob } from '../models.js';
import { availableScores, groupedAnalytics, sessionJson, normalizeAnalysisScores, SCORE_VERSION } from '../../services/interviewScoring.js';
import { groundDiscoveryResult } from '../../services/discoveryService.js';
import { persistInterviewAnswer } from '../../services/interviewAnswers.js';
import { renderImportedResume } from '../importSave.js';

let memory, workflow, confirmations, saves, profileWrites, cache;
before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.REDIS_URL = '';
  process.env.CACHE_ENABLED = 'false';
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri());
  await Promise.all([Interview.init(), UserProfile.init(), CampusStudent.init(), CampusDiscoveryConfirmation.init(), CampusSaveOperation.init(), Resume.init(), CampusJob.init()]);
  workflow = await import('../../services/interviewWorkflow.js');
  confirmations = await import('../discoveryConfirmation.js');
  saves = await import('../materialSave.js');
  profileWrites = await import('../profileWrite.js');
  cache = await import('../../middleware/cacheLayer.js');
});
after(async () => {
  mock.restoreAll();
  await cache?.closeCacheConnection();
  await mongoose.disconnect();
  await memory?.stop();
});
const provider = (value) => ({ generateContent: async () => ({ text: JSON.stringify(value) }) });
const discovery = (uid, extra = {}) => Interview.create({ userId: uid, purpose: 'discovery', jobRole: '交流', industry: '交流', experienceLevel: 'unknown', mode: 'behavioral', language: 'zh', totalQuestionCount: 4, questions: [{ questionId: 'q1', question: '最近的兴趣？' }], ...extra });
const answer = { questionId: 'q1', question: '最近的兴趣？', transcript: '我不是大学生。我喜欢绘画，想做一个绘画分享网站，还没开始。' };
const result = {
  summarySources: [{ questionId: 'q1', excerpt: answer.transcript }], advice: [],
  candidates: [
    { kind: 'collegeStudent', value: false, source: { questionId: 'q1', excerpt: '我不是大学生。' } },
    { kind: 'interest', value: '绘画', source: { questionId: 'q1', excerpt: '我喜欢绘画' } },
    { kind: 'experience', value: '想做一个绘画分享网站，还没开始。', state: 'completed', source: { questionId: 'q1', excerpt: '想做一个绘画分享网站，还没开始。' } },
  ],
};
function confirmationBody(view) {
  return { candidates: view.candidates.map(({ id, value, state }) => ({ id, value, ...(state ? { state } : {}) })), expected: view.expected, resolutions: {} };
}

test('available scores distinguish genuine zero, missing dimensions and compatible groups', () => {
  const partial = availableScores({ mode: 'mixed', answers: [{ analysis: { relevance: 100, clarity: 0, confidence: 100 } }, { analysis: { relevance: null, clarity: 100, confidence: 100 } }] });
  assert.equal(partial.overallScore, 84);
  assert.equal(normalizeAnalysisScores({ relevance: 0 }).clarity, null);
  assert.throws(() => normalizeAnalysisScores({ relevance: '100' }));
  assert.throws(() => normalizeAnalysisScores({ relevance: 101 }));
  assert.equal(partial.dimensions.relevance.observed, 1);
  assert.equal(partial.dimensions.clarity.observed, 2);
  assert.equal(partial.dimensions.expression.score, null);
  assert.equal(partial.dimensions.expression.effectiveWeight, 0);
  assert.equal(availableScores({ mode: 'mixed', answers: [{}] }).overallScore, null);
  assert.equal(availableScores({ mode: 'mixed', answers: [{ analysis: { relevance: 0 } }] }).overallScore, 0);
  const analytics = groupedAnalytics([{ mode: 'mixed', overallScore: 20 }, { mode: 'mixed', overallScore: partial.overallScore, scoreVersion: SCORE_VERSION, scoring: partial }, { purpose: 'discovery', overallScore: 99 }]);
  assert.equal(analytics.sessions.length, 2);
  assert.equal(analytics.groups.length, 2);
  assert.equal(analytics.summary.averageOverallScore, null);
  assert.equal(sessionJson({ _id: 'legacy', overallScore: 0 }).overallScore, 0);
  assert.equal(sessionJson({ _id: 'legacy' }).scoreVersion, 'legacy');
});

test('grounded extraction retains plans and rejects invented source or identity', () => {
  const session = { _id: 'synthetic', answers: [answer] };
  const grounded = groundDiscoveryResult(result, session);
  assert.equal(grounded.candidates.find((item) => item.kind === 'collegeStudent').value, false);
  assert.equal(grounded.candidates.find((item) => item.kind === 'experience').state, 'idea');
  assert.equal(grounded.summary, answer.transcript);
  const invented = structuredClone(result);
  invented.candidates[0].value = true;
  assert.equal(groundDiscoveryResult(invented, session).candidates.some((item) => item.kind === 'collegeStudent'), false);
  invented.candidates[0].source.excerpt = '没有说过';
  assert.throws(() => groundDiscoveryResult(invented, session), { code: 'DISCOVERY_UNGROUNDED' });
});

test('accepted answer survives provider failure; next question and completion are single-flight and replay-safe', async () => {
  const session = await discovery('turns');
  await persistInterviewAnswer({ id: session.id, userId: 'turns', questionId: 'q1', answerCount: 0, update: { $push: { answers: answer } } });
  await assert.rejects(() => workflow.continueDiscovery(session.id, 'other', provider({ question: '不能读' })), { code: 'INTERVIEW_NOT_FOUND' });
  await assert.rejects(() => workflow.continueDiscovery(session.id, 'turns', { generateContent: async () => { throw new Error('controlled provider outage'); } }), { code: 'DISCOVERY_GENERATION_FAILED' });
  assert.equal((await Interview.findById(session.id)).answers.length, 1);
  let release, entered, calls = 0;
  const started = new Promise((resolve) => { entered = resolve; });
  const held = new Promise((resolve) => { release = resolve; });
  const next = workflow.continueDiscovery(session.id, 'turns', { generateContent: async () => { calls++; entered(); await held; return { text: JSON.stringify({ question: '这个网站想帮助谁？' }) }; } });
  await started;
  await assert.rejects(() => workflow.continueDiscovery(session.id, 'turns', provider({ question: '重复？' })), { code: 'GENERATION_PENDING' });
  release();
  const saved = await next;
  assert.equal(saved.questions.length, 2);
  await workflow.continueDiscovery(session.id, 'turns', { generateContent: async () => { throw new Error('must not call again'); } });
  assert.equal(calls, 1);
  const completed = await workflow.completeInterview(session.id, 'turns', provider(result));
  assert.equal(completed.overallScore, null);
  assert.equal(completed.discovery.candidates.length, 3);
  const replay = await workflow.completeInterview(session.id, 'turns', { generateContent: async () => { throw new Error('must not regenerate'); } });
  assert.deepEqual(replay.discovery, completed.discovery);
});

test('empty discovery does not fabricate output or call model; legacy completion retains old weighting', async () => {
  const empty = await discovery('empty');
  const done = await workflow.completeInterview(empty.id, 'empty', { generateContent: async () => { throw new Error('no answers'); } });
  assert.deepEqual(done.discovery.candidates, []);
  assert.equal(done.discovery.summary, '');
  const legacy = await Interview.create({ userId: 'legacy', mode: 'mixed', jobRole: '岗位', industry: '行业', experienceLevel: 'entry', answers: [{ ...answer, analysis: { relevance: 100, clarity: 100, confidence: 100 } }] });
  const oldResult = await workflow.completeInterview(legacy.id, 'legacy', provider({ summary: 'legacy stored summary' }));
  assert.equal(oldResult.overallScore, 80);
  assert.equal(oldResult.scoreVersion, undefined);
});

test('editable confirmation is idempotent, independent from resume creation and preserves later edits', async () => {
  const session = await discovery('confirmation', { answers: [answer], status: 'completed' });
  session.discovery = groundDiscoveryResult(result, session);
  await session.save();
  const view = await confirmations.confirmationView(session);
  assert.equal(await UserProfile.countDocuments({ uid: 'confirmation' }), 0, 'view/skip is read-only');
  const body = confirmationBody(view);
  body.candidates.find((item) => item.id === view.candidates.find((candidate) => candidate.kind === 'interest').id).value = '手绘';
  const saved = await confirmations.confirmDiscovery(session, body);
  assert.equal(saved.status, 'completed');
  const student = await CampusStudent.findOne({ uid: 'confirmation' }).lean();
  const profile = await UserProfile.findOne({ uid: 'confirmation' }).lean();
  assert.deepEqual(student.interests, ['手绘']);
  assert.equal(student.experiences[0].state, 'idea');
  assert.equal(profile.collegeStudentKnown, true);
  assert.equal(profile.collegeStudent, false);
  assert.equal(await Resume.countDocuments({ userId: 'confirmation' }), 0);
  await profileWrites.writeProfileFields(CampusStudent, 'confirmation', { interests: ['之后编辑'] }, student.updatedAt.toISOString());
  await confirmations.confirmDiscovery(session, body);
  assert.deepEqual((await CampusStudent.findOne({ uid: 'confirmation' })).interests, ['之后编辑']);
  await assert.rejects(() => profileWrites.writeProfileFields(CampusStudent, 'confirmation', { interests: ['过期表单'] }, student.updatedAt.toISOString()), { code: 'PROFILE_CONFLICT' });
});

test('partial target write recovers without overwriting a later ordinary profile edit', async () => {
  const uid = 'partial';
  await CampusStudent.create({ uid, interests: ['原有'] });
  const session = await discovery(uid, { answers: [answer], status: 'completed' });
  session.discovery = groundDiscoveryResult(result, session);
  await session.save();
  const body = confirmationBody(await confirmations.confirmationView(session));
  const original = CampusStudent.updateOne.bind(CampusStudent);
  const failure = mock.method(CampusStudent.collection, 'updateOne', async () => { throw new Error('controlled target write failure'); });
  await assert.rejects(() => confirmations.confirmDiscovery(session, body));
  failure.mock.restore();
  const profile = await UserProfile.findOne({ uid }).lean();
  await profileWrites.writeProfileFields(UserProfile, uid, { collegeStudent: true, collegeStudentKnown: true }, profile.updatedAt.toISOString());
  await original({ uid }, { $set: { interests: ['并发新增'] } });
  const restored = await confirmations.confirmDiscovery(session, body);
  assert.equal(restored.status, 'completed');
  assert.equal((await UserProfile.findOne({ uid })).collegeStudent, true);
  assert.deepEqual((await CampusStudent.findOne({ uid })).interests, ['并发新增', '绘画']);
  assert.equal((await CampusStudent.findOne({ uid })).experiences.length, 1);
});

test('conflicting profile values require a fresh explicit choice and no preflight write', async () => {
  const uid = 'conflict';
  await UserProfile.create({ uid, collegeStudentKnown: true, collegeStudent: true });
  const session = await discovery(uid, { answers: [answer], status: 'completed' });
  session.discovery = groundDiscoveryResult(result, session);
  await session.save();
  const body = confirmationBody(await confirmations.confirmationView(session));
  await assert.rejects(() => confirmations.confirmDiscovery(session, body), { code: 'PROFILE_CONFLICT' });
  assert.equal(await CampusDiscoveryConfirmation.countDocuments({ userId: uid }), 0);
  assert.equal(await CampusStudent.countDocuments({ uid }), 0);
  body.resolutions.collegeStudent = 'keep';
  await confirmations.confirmDiscovery(session, body);
  assert.equal((await UserProfile.findOne({ uid })).collegeStudent, true);
});

test('operation-bound creates and updates recover original versions with owner isolation', async () => {
  const uid = 'material';
  const body = { operationId: 'resume-create-01', originalText: '确认的原文', title: '练习材料', preferences: {}, customSections: [] };
  const created = await saves.saveMaterial({ kind: 'resume', uid, body });
  assert.equal((await saves.saveMaterial({ kind: 'resume', uid, body })).id, created.id);
  assert.equal(await Resume.countDocuments({ userId: uid }), 1);
  assert.equal(await ResumeVersion.countDocuments({ resumeId: created.id }), 1);
  await assert.rejects(() => saves.recoverMaterialSave('resume', 'other', body.operationId), { code: 'SAVE_NOT_FOUND' });
  await assert.rejects(() => saves.saveMaterial({ kind: 'resume', uid, body: { ...body, originalText: 'different' } }), { code: 'OPERATION_CONFLICT' });
  const update = { operationId: 'resume-update-01', revision: created.revision, originalText: '刚保存的新版本' };
  const changed = await saves.saveMaterial({ kind: 'resume', uid, id: created.id, body: update });
  assert.equal(changed.revision, 2);
  assert.equal((await saves.recoverMaterialSave('resume', uid, body.operationId)).revision, 1);
  assert.equal((await saves.saveMaterial({ kind: 'resume', uid, id: created.id, body: update })).revision, 2);
  const job = await saves.saveMaterial({ kind: 'job', uid, body: { operationId: 'job-create-01', company: '测试', title: '岗位', description: '需求' } });
  assert.equal(job.status, 'draft');
  const jobUpdate = { operationId: 'job-update-01', expectedUpdatedAt: new Date(job.updatedAt).toISOString(), description: '新需求' };
  const edited = await saves.saveMaterial({ kind: 'job', uid, id: job.id, body: jobUpdate });
  assert.equal(edited.description, '新需求');
  assert.equal((await saves.recoverMaterialSave('job', uid, jobUpdate.operationId)).description, '新需求');
});

test('unknown legacy identity stays unknown and ideas never become resume achievements', () => {
  assert.equal(profileWrites.profileJson({ collegeStudent: false }).collegeStudent, null);
  assert.equal(profileWrites.profileJson({ collegeStudent: false, collegeStudentKnown: true }).collegeStudent, false);
  const text = renderImportedResume({ education: [], skills: [], experiences: [{ title: '设想', fullText: '想做网站', state: 'idea' }, { title: '正在做', fullText: '正在做课程设计', state: 'in_progress' }] });
  assert.doesNotMatch(text, /想做网站/);
  assert.match(text, /进行中（未完成）/);
});
