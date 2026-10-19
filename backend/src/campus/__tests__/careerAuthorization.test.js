import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CampusStudent, CampusJob, CampusGrant, CampusTarget } from '../models.js';
import Resume from '../../models/Resume.model.js';
import Interview from '../../models/Interview.model.js';
import targets from '../targets.js';
import sharing, { authorizedExportTarget } from '../sharing.js';
import growth from '../growth.js';
import { globalErrorHandler } from '../../middleware/globalErrorHandler.js';
import { requestDiagnostics } from '../../utils/diagnostics.js';
import { persistInterviewAnswer } from '../../services/interviewAnswers.js';

let memory, server;
const owner = 'student-owner';
let identity = { uid: owner, name: 'Fixture student', emailVerified: false, isTeacher: false };
before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.CAMPUS_TEACHER_UIDS = 'user_teacher,user_other';
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri());
  const app = express();
  app.use(requestDiagnostics, express.json());
  // Isolated harness injects trusted identity; the production app has no identity header.
  app.use((req, _res, next) => { req.user = identity; next(); });
  app.use(growth, targets, sharing, globalErrorHandler);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (memory) await memory.stop();
});
async function call(path, method = 'GET', body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}

test('owner-scoped jobs, exact target revisions, consent revocation and source changes', async () => {
  const availability = { startDate: '2026-10-01', endDate: '2026-12-31', daysPerWeek: 3 };
  const job = await CampusJob.create({ creatorUid: owner, authorKind: 'student', company: 'Fixture', title: 'Fixture', description: 'SQL', status: 'published', availability });
  const source = await Resume.create({ userId: owner, originalText: '确认的课程经历' });
  const target = await CampusTarget.create({ studentId: owner, sourceResumeId: source._id, sourceRevision: source.lastModified, jobId: job._id, jobRevision: job.updatedAt, title: 'Fixture', draft: '确认的课程经历' });
  await CampusStudent.create({ uid: owner, availability });
  await CampusGrant.create({ studentId: owner, teacherId: 'user_teacher' });
  assert.equal(await authorizedExportTarget(target._id, job, 'user_teacher'), null);
  assert.equal((await call(`/me/targets/${target._id}/approve`, 'POST', { revision: 1 })).status, 200);
  assert.ok(await authorizedExportTarget(target._id, job, 'user_teacher'));
  assert.equal(await authorizedExportTarget(target._id, job, 'user_other'), null);
  assert.equal((await call(`/me/targets/${target._id}`, 'PATCH', { revision: 1, draft: '编辑后的确认经历' })).body.data.approved, false);
  assert.equal((await call(`/me/targets/${target._id}/approve`, 'POST', { revision: 1 })).status, 409);
  assert.equal(await authorizedExportTarget(target._id, job, 'user_teacher'), null);
  assert.equal((await call(`/me/targets/${target._id}/approve`, 'POST', { revision: 2 })).status, 200);
  assert.equal((await call('/me/sharing/user_teacher', 'DELETE')).status, 200);
  assert.equal(await authorizedExportTarget(target._id, job, 'user_teacher'), null);
  await CampusGrant.create({ studentId: owner, teacherId: 'user_teacher' });
  identity = { uid: 'user_teacher', emailVerified: true, isTeacher: true };
  assert.equal((await call(`/teacher/jobs/${job._id}/candidates`)).body.data.eligible.length, 1);
  identity = { uid: 'user_other', emailVerified: true, isTeacher: true };
  assert.equal((await call(`/teacher/jobs/${job._id}/candidates`)).body.data.eligible.length, 0);
  assert.equal((await call(`/jobs/${job._id}`, 'PATCH', { title: 'Forged' })).status, 403);
  assert.equal((await call(`/me/targets/${target._id}/approve`, 'POST', { revision: 2 })).status, 404);
  identity = { uid: owner, emailVerified: false, isTeacher: false };
  assert.equal((await call(`/teacher/jobs/${job._id}/candidates`)).status, 403);
  const changedJob = await CampusJob.findOneAndUpdate({ _id: job._id }, { $set: { updatedAt: new Date(job.updatedAt.getTime() + 1) } }, { timestamps: false, new: true });
  assert.equal((await call(`/me/targets/${target._id}/approve`, 'POST', { revision: 2 })).body.code, 'JOB_CHANGED');
  assert.equal((await call('/me/targets')).body.data[0].stale, true);
  assert.equal(await authorizedExportTarget(target._id, changedJob, 'user_teacher'), null);
  await CampusJob.updateOne({ _id: job._id }, { $set: { updatedAt: job.updatedAt } }, { timestamps: false });
  await Resume.updateOne({ _id: source._id }, { $set: { lastModified: new Date(source.lastModified.getTime() + 1) } }, { timestamps: false });
  assert.equal((await call(`/me/targets/${target._id}/approve`, 'POST', { revision: 2 })).body.code, 'SOURCE_CHANGED');
  assert.equal((await call('/me/targets')).body.data[0].approved, false);
  assert.equal(await authorizedExportTarget(target._id, job, 'user_teacher'), null);
});

test('atomic answer predicate accepts only one duplicate and never closed sessions', async () => {
  const session = await Interview.create({ userId: owner, jobRole: 'Fixture', industry: 'Fixture', experienceLevel: 'student', questions: [{ questionId: 'q1', question: '课程经历？' }] });
  const submit = () => persistInterviewAnswer({ id: session._id, userId: owner, questionId: 'q1', answerCount: 0, update: { $push: { answers: { questionId: 'q1', question: '课程经历？', transcript: '确认内容' } } } });
  const results = await Promise.allSettled([submit(), submit()]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'ANSWER_ALREADY_SUBMITTED');
  assert.equal((await Interview.findById(session._id)).answers.length, 1);
  await Interview.updateOne({ _id: session._id }, { $set: { status: 'completed' } });
  await assert.rejects(() => persistInterviewAnswer({ id: session._id, userId: owner, questionId: 'q2', answerCount: 1, update: { $push: { answers: { questionId: 'q2', question: '其他经历？', transcript: '确认内容' } } } }), { code: 'ANSWER_ALREADY_SUBMITTED' });
});
