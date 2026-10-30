import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CampusJob, CampusMembership, CampusTarget } from '../models.js';
import Resume from '../../models/Resume.model.js';
import sharing from '../sharing.js';
import { globalErrorHandler } from '../../middleware/globalErrorHandler.js';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

let memory, server, job, target, source;
let identity = { uid: 'user_teacher', emailVerified: true, isTeacher: true };
before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.CAMPUS_TEACHER_UIDS = 'user_teacher,user_other';
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri());
  const app = express();
  app.use(express.json(), (req, _res, next) => { req.user = identity; next(); }, sharing, globalErrorHandler);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  job = await CampusJob.create({ creatorUid: 'student', authorKind: 'student', company: 'Fixture', title: 'Fixture', description: 'SQL', status: 'published' });
  source = await Resume.create({ userId: 'student', originalText: '姓名\n\n经历一\n\n经历二' });
  target = await CampusTarget.create({ studentId: 'student', sourceResumeId: source._id, sourceRevision: source.contentRevision, jobId: job._id, jobRevision: job.updatedAt, title: 'Fixture', draft: source.originalText, classGeneratedBy: 'user_teacher', classGeneratedRevision: 1 });
  await CampusMembership.create({ classId: new mongoose.Types.ObjectId(), studentId: 'student', teacherId: 'user_teacher', active: true, consentVersion: 'class-recommendation-v1', joinedAt: new Date() });
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (memory) await memory.stop();
});
async function request(body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/teacher/jobs/${job._id}/targets/${target._id}/review-export`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
test('review export renders a real PDF from selected source paragraphs without changing stored material', { skip: process.env.CAMPUS_REAL_PDF_TEST === '1' ? false : 'Set CAMPUS_REAL_PDF_TEST=1 to run the real-browser PDF smoke test' }, async () => {
  const original = 'SYNTHETIC STUDENT\n\nCourse project: built a small demo.\n\nVolunteer project: organized materials.';
  const resume = await Resume.create({ userId: 'student', originalText: original });
  const reviewed = await CampusTarget.create({ studentId: 'student', sourceResumeId: resume._id, sourceRevision: resume.contentRevision, jobId: job._id, jobRevision: job.updatedAt, title: 'Fixture', draft: original, classGeneratedBy: 'user_teacher', classGeneratedRevision: 1 });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/teacher/jobs/${job._id}/targets/${reviewed._id}/review-export`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: 1, selected: [0, 2] }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/pdf/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const parsed = await pdfParse(Uint8Array.from(bytes));
  assert.equal(parsed.numpages, 1);
  assert.match(parsed.text, /SYNTHETIC STUDENT/);
  assert.match(parsed.text, /Volunteer project: organized materials/);
  assert.doesNotMatch(parsed.text, /Course project/);
  assert.equal((await Resume.findById(resume._id)).originalText, original);
  assert.equal((await CampusTarget.findById(reviewed._id)).draft, original);
});
test('review export rejects forged content, wrong teacher, stale version and withdrawn consent before rendering', async () => {
  assert.equal((await request({ revision: 1, selected: [0, 2], draft: '伪造' })).status, 400);
  assert.equal((await request({ revision: 1, selected: [0, 99] })).body.code, 'PDF_COMPRESSION_UNGROUNDED');
  assert.equal((await request({ revision: 2, selected: [0, 2] })).body.code, 'EXPORT_CHANGED');
  identity = { uid: 'user_other', emailVerified: true, isTeacher: true };
  assert.equal((await request({ revision: 1, selected: [0, 2] })).body.code, 'EXPORT_CHANGED');
  identity = { uid: 'user_teacher', emailVerified: true, isTeacher: true };
  await Resume.updateOne({ _id: source._id }, { $inc: { contentRevision: 1 } });
  assert.equal((await request({ revision: 1, selected: [0, 2] })).body.code, 'EXPORT_CHANGED');
  await Resume.updateOne({ _id: source._id }, { $set: { contentRevision: source.contentRevision } });
  await CampusJob.updateOne({ _id: job._id }, { $set: { updatedAt: new Date(job.updatedAt.getTime() + 1000) } }, { timestamps: false });
  assert.equal((await request({ revision: 1, selected: [0, 2] })).body.code, 'EXPORT_CHANGED');
  await CampusJob.updateOne({ _id: job._id }, { $set: { updatedAt: job.updatedAt } }, { timestamps: false });
  await CampusMembership.updateMany({ studentId: 'student' }, { $set: { active: false } });
  assert.equal((await request({ revision: 1, selected: [0, 2] })).body.code, 'EXPORT_CHANGED');
  assert.equal((await Resume.findById(source._id)).originalText, source.originalText);
  assert.equal((await CampusTarget.findById(target._id)).draft, target.draft);
});
