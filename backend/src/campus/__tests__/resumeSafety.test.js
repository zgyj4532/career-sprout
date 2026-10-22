import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const keys = ['APP_PROFILE', 'NODE_ENV', 'DEV_BYPASS_AUTH', 'DEV_USER_UID', 'REDIS_URL', 'CLERK_SECRET_KEY'];
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const owner = 'resume-safety-owner';
let memory, server, Resume, Version, Ats, Share, Comment, Interview, models, lifecycle, closeCache;
before(async () => {
  Object.assign(process.env, { APP_PROFILE: 'test', NODE_ENV: 'development', DEV_BYPASS_AUTH: 'true', DEV_USER_UID: owner, REDIS_URL: '' });
  delete process.env.CLERK_SECRET_KEY;
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri());
  const [resumes, collaboration, profiles, growth, targets, diagnostics, errors] = await Promise.all([
    import('../../routes/resume.js'), import('../../routes/collaboration.js'), import('../../routes/userProfile.js'), import('../growth.js'), import('../targets.js'), import('../../utils/diagnostics.js'), import('../../middleware/globalErrorHandler.js'),
  ]);
  Resume = (await import('../../models/Resume.model.js')).default;
  Version = (await import('../../models/ResumeVersion.model.js')).default;
  Ats = (await import('../../models/ResumeAtsHistory.model.js')).default;
  Share = (await import('../../models/ResumeShare.model.js')).default;
  Comment = (await import('../../models/ResumeComment.model.js')).default;
  Interview = (await import('../../models/Interview.model.js')).default;
  models = await import('../models.js');
  lifecycle = await import('../resumeDelete.js');
  closeCache = (await import('../../middleware/cacheLayer.js')).closeCacheConnection;
  const app = express();
  app.use(diagnostics.requestDiagnostics, express.json());
  app.use((req, _res, next) => { req.user = { uid: process.env.DEV_USER_UID }; next(); });
  app.use('/resumes', resumes.default);
  app.use('/collaboration', collaboration.default);
  app.use('/profiles', profiles.default);
  app.use('/campus', growth.default, targets.default);
  app.use(errors.globalErrorHandler);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeCache?.();
  await mongoose.disconnect();
  await memory?.stop();
  for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
});
async function call(path, method = 'GET', body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function source() { return Resume.create({ userId: owner, title: 'Original', originalText: 'Original body' }); }

test('HTTP title/body CAS prevents stale overwrite and only content changes invalidate targets', async () => {
  const resume = await source();
  const job = await models.CampusJob.create({ creatorUid: owner, authorKind: 'student', title: 'Job', company: 'School', description: 'Experience' });
  const target = await models.CampusTarget.create({ studentId: owner, sourceResumeId: resume._id, sourceRevision: 1, jobId: job._id, jobRevision: job.updatedAt, title: 'Target', draft: 'Original body', approvedRevision: 1 });
  assert.equal((await call(`/resumes/${resume.id}`, 'PUT', { title: 'Blind' })).status, 400);
  const renamed = await call(`/resumes/${resume.id}`, 'PUT', { title: 'Renamed', revision: 1 });
  assert.equal(renamed.body.data.revision, 2);
  assert.equal(renamed.body.data.contentRevision, 1);
  assert.equal((await call(`/campus/me/targets/${target.id}/approve`, 'POST', { revision: 1 })).status, 200);
  assert.equal((await call(`/resumes/${resume.id}`, 'PUT', { title: 'Original', originalText: 'Late body', revision: 1 })).status, 409);
  const saved = await call(`/resumes/${resume.id}`, 'PUT', { title: 'Ignored', originalText: 'Edited body', revision: 2 });
  assert.equal(saved.body.data.title, 'Renamed');
  assert.equal(saved.body.data.contentRevision, 2);
  assert.equal((await call(`/campus/me/targets/${target.id}/approve`, 'POST', { revision: 1 })).body.code, 'SOURCE_CHANGED');
  const same = await call(`/resumes/${resume.id}`, 'PUT', { originalText: 'Edited body', revision: 3 });
  assert.equal(same.body.data.contentRevision, 2);
  const reordered = await call(`/resumes/${resume.id}/reorder`, 'PUT', { sectionOrder: ['skills'], revision: 4 });
  assert.equal(reordered.body.data.contentRevision, 3);
  const version = await call(`/resumes/${resume.id}/versions`, 'POST', { originalText: 'Restored body', atsScore: null });
  assert.equal(version.status, 201);
  assert.equal((await call(`/resumes/${resume.id}/versions/${version.body.data.id}/restore`, 'POST', { revision: 4 })).status, 409);
  const restored = await call(`/resumes/${resume.id}/versions/${version.body.data.id}/restore`, 'POST', { revision: 5 });
  assert.equal(restored.body.data.title, 'Renamed');
  assert.equal(restored.body.data.contentRevision, 4);
  const historical = new mongoose.Types.ObjectId();
  await Resume.collection.insertOne({ _id: historical, userId: owner, originalText: 'Before revisions', title: 'Old' });
  const migrated = await call(`/resumes/${historical}`, 'PUT', { originalText: 'After revisions', revision: 1 });
  assert.equal(migrated.status, 200);
  assert.equal(migrated.body.data.contentRevision, 2);
});

test('deletion closes admission, cleans every association, preserves interviews and retries without resume', async () => {
  const resume = await source();
  await Share.create({ resumeId: resume._id, ownerId: owner, shareToken: 'b'.repeat(48), isActive: true });
  await Comment.create({ resumeId: resume._id, shareToken: 'b'.repeat(48), section: 'summary', text: 'Review', authorEmail: 'fixture@example.test' });
  const jobId = new mongoose.Types.ObjectId();
  await models.CampusTarget.create({ studentId: owner, sourceResumeId: resume._id, sourceRevision: 1, jobId, title: 'Target', draft: 'Material' });
  const interview = await Interview.create({ userId: owner, jobRole: 'Job', industry: 'School', experienceLevel: 'student', resumeText: resume.originalText });
  let entered, release;
  const enteredPromise = new Promise((resolve) => { entered = resolve; });
  const hold = new Promise((resolve) => { release = resolve; });
  const writer = lifecycle.withResumeAssociation(resume.id, owner, 'version', async () => {
    entered(); await hold;
    return Version.create({ resumeId: resume._id, userId: owner, versionNumber: 1, originalText: resume.originalText });
  });
  await enteredPromise;
  const deletion = lifecycle.deleteResumeOwned(resume.id, owner);
  const lateWriter = lifecycle.withResumeAssociation(resume.id, owner, 'ats', () => Ats.create({ resumeId: resume._id, userId: owner, atsScore: 80, jobRole: 'Job' }));
  const rejected = assert.rejects(lateWriter, { code: 'RESUME_NOT_FOUND' });
  release();
  await Promise.all([writer, deletion, rejected]);
  assert.equal(await Version.countDocuments({ resumeId: resume._id }), 0);
  assert.equal(await Ats.countDocuments({ resumeId: resume._id }), 0);
  assert.ok(await Interview.exists({ _id: interview._id }));
  assert.equal(await Share.countDocuments({ resumeId: resume._id }), 0);
  assert.equal(await Comment.countDocuments({ resumeId: resume._id }), 0);
  assert.equal(await models.CampusTarget.countDocuments({ sourceResumeId: resume._id }), 0);
  assert.ok(await models.CampusResumeTombstone.exists({ resumeId: resume._id, userId: owner }));
  // A crash can leave rows even when the resume is already absent.
  await Comment.create({ resumeId: resume._id, shareToken: 'a'.repeat(48), section: 'summary', text: 'Residual', authorName: 'Fixture', authorEmail: 'fixture@example.test' });
  assert.equal((await call(`/resumes/${resume.id}`, 'DELETE')).status, 200);
  assert.equal(await Comment.countDocuments({ resumeId: resume._id }), 0);
  const marked = await source();
  await Resume.updateOne({ _id: marked._id }, { $set: { deleting: true } });
  for (const [suffix, body] of [['versions', { originalText: 'Snapshot' }], ['ats-history', { jobRole: 'Job', atsScore: 60 }]]) {
    assert.equal((await call(`/resumes/${marked.id}/${suffix}`, 'POST', body)).body.code, 'RESUME_DELETING');
  }
  assert.equal((await call(`/collaboration/resumes/${marked.id}/share`, 'POST', {})).body.code, 'RESUME_DELETING');
  for (const kind of ['version', 'ats', 'share', 'comment', 'target']) await assert.rejects(lifecycle.withResumeAssociation(marked.id, owner, kind, () => assert.fail('writer must not run')), { code: 'RESUME_DELETING' });
  const changed = await source();
  await Resume.updateOne({ _id: changed._id }, { $inc: { revision: 1 } });
  await assert.rejects(lifecycle.deleteResumeOwned(changed.id, owner, { expectedRevision: 1 }), { code: 'RESTORE_CONFLICT' });
  assert.equal((await Resume.findById(changed.id)).deleting, false);
});

test('cleanup persists tombstone before interruption and can recover real partial database writes', async () => {
  const resume = await source();
  const deps = { resumes: Resume, versions: Version, ats: Ats, shares: Share, comments: Comment, targets: models.CampusTarget, tombstones: models.CampusResumeTombstone };
  await Version.create({ resumeId: resume._id, userId: owner, versionNumber: 1, originalText: 'Before cleanup' });
  await assert.rejects(lifecycle.cleanupDeletedResume({ ...deps, ats: { deleteMany: async () => { throw new Error('Injected cleanup outage'); } } }, resume._id, owner));
  assert.ok(await models.CampusResumeTombstone.exists({ resumeId: resume._id }));
  assert.ok(await Resume.exists({ _id: resume._id }));
  assert.equal(await Version.countDocuments({ resumeId: resume._id }), 0);
  await lifecycle.cleanupDeletedResume(deps, resume._id, owner);
  assert.equal(await Resume.exists({ _id: resume._id }), null);
});

test('collaboration enforces owner and expiration without echoing malformed identifiers', async () => {
  const resume = await source();
  const shared = await call(`/collaboration/resumes/${resume.id}/share`, 'POST', {});
  const token = shared.body.shareToken;
  const added = await call(`/collaboration/shared/${token}/comments`, 'POST', { text: 'Private review', authorEmail: 'fixture@example.test', authorName: 'Fixture' });
  assert.equal(added.status, 201);
  process.env.DEV_USER_UID = 'other-owner';
  try {
    assert.equal((await call(`/collaboration/resumes/${resume.id}/comments`)).status, 404);
    assert.equal((await call(`/collaboration/comments/${added.body._id}/resolve`, 'PATCH', { resolved: true })).status, 404);
  } finally { process.env.DEV_USER_UID = owner; }
  assert.equal((await Comment.findById(added.body._id)).resolved, false);
  await Share.updateOne({ shareToken: token }, { $set: { expiresAt: new Date(0) } });
  assert.equal((await call(`/collaboration/shared/${token}/comments`)).status, 404);
  assert.equal((await call(`/collaboration/shared/${token}/comments`, 'POST', { text: 'Late', authorEmail: 'fixture@example.test', authorName: 'Fixture' })).status, 404);
  const malformed = await call('/collaboration/resumes/private-secret-id/comments');
  assert.equal(malformed.status, 400);
  assert.equal(JSON.stringify(malformed.body).includes('private-secret-id'), false);
  assert.ok(malformed.body.requestId);
});

test('ordinary profile save retains imported dates, full material and skills; preparation is account-owned', async () => {
  const education = [{ id: 'education-1', institution: 'Fixture school', dateText: '2023年09月至今', precision: 'month', current: true, fullText: 'Education detail '.repeat(100) }];
  const saved = await call('/profiles/me', 'PUT', { education, otherMaterials: 'Certificate and contact', skills: Array.from({ length: 21 }, (_, index) => `Skill ${index}`) });
  assert.equal(saved.status, 200);
  const loaded = await call('/profiles/me');
  assert.equal(loaded.body.profile.education[0].dateText, education[0].dateText);
  assert.equal(loaded.body.profile.education[0].fullText, education[0].fullText);
  assert.equal(loaded.body.profile.skills.length, 21);
  assert.equal(loaded.body.profile.otherMaterials, 'Certificate and contact');
  assert.equal((await call(`/profiles/${owner}-other`)).status, 403);
  const prep = { jobRole: 'Selected job', manualRole: 'Original direction', mode: 'mixed', count: 4, resumeId: null, text: 'Unsaved material', jobId: null, savedJobTitle: '' };
  assert.equal((await call('/campus/me/interview-prep', 'PUT', prep)).status, 200);
  assert.equal((await call('/campus/me/interview-prep')).body.data.manualRole, prep.manualRole);
  process.env.DEV_USER_UID = 'other-owner';
  try { assert.equal((await call('/campus/me/interview-prep')).body.data, null); }
  finally { process.env.DEV_USER_UID = owner; }
});

test('imported skill labels remain unknown through ordinary edits and job matching', async () => {
  const imported = [{ name: 'SQL', evidence: 'Course project' }, { name: 'Python', level: null, evidence: 'Notebook' }, { name: 'Java', level: 0, evidence: '' }];
  await models.CampusStudent.findOneAndUpdate({ uid: owner }, { $set: { skillAssessments: imported } }, { upsert: true });
  const loaded = await call('/campus/me');
  const saved = await call('/campus/me', 'PUT', { skillAssessments: loaded.body.data.student.skillAssessments });
  assert.equal(saved.status, 200);
  const persisted = (await models.CampusStudent.findOne({ uid: owner }).lean()).skillAssessments;
  assert.equal(persisted[0].level, undefined);
  assert.equal(persisted[1].level, null);
  assert.equal(persisted[2].level, 0);
  const job = await models.CampusJob.create({ creatorUid: owner, authorKind: 'student', title: 'Skills fixture', company: 'School', description: 'SQL Python Java', requirements: imported.map(({ name }) => ({ name, level: 1, required: true })) });
  const gap = await call(`/campus/jobs/${job.id}/gap`);
  assert.equal(gap.status, 200);
  assert.deepEqual(gap.body.data.unknownSkills.map((skill) => skill.name), ['SQL', 'Python']);
  assert.deepEqual(gap.body.data.missingSkills.map((skill) => skill.name), ['Java']);
  assert.equal(gap.body.data.matchedSkills.length, 0);
  assert.equal(gap.body.data.unknownSkills.every((skill) => skill.currentLevel === null), true);
});

test('campus extension saves cannot replace canonical education with an imported subset', async () => {
  const education = [
    { id: 'manual-school', institution: 'Manually entered school', fullText: 'Original education detail' },
    { id: 'imported-school', institution: 'Imported school', dateText: '2024年09月至今', precision: 'month', current: true },
  ];
  assert.equal((await call('/profiles/me', 'PUT', { education })).status, 200);
  const before = (await call('/profiles/me')).body.profile.education;
  const subset = await call('/campus/me', 'PUT', { importedEducation: [education[1]], interests: ['Research'] });
  assert.equal(subset.status, 200);
  assert.deepEqual(subset.body.data.profile.education, before);
  assert.equal(subset.body.data.student.importedEducation.length, 1);
  const cleared = await call('/campus/me', 'PUT', { importedEducation: [] });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.body.data.student.importedEducation, []);
  assert.deepEqual((await call('/profiles/me')).body.profile.education, before);
});

test('all canonical education fields and the twenty-entry limit roundtrip through extension projection', async () => {
  const education = Array.from({ length: 20 }, (_, index) => ({
    id: `education-${index}`, institution: `School ${index}`, degree: 'Bachelor', field: 'Computing',
    startYear: 2020, endYear: 2024, dateText: '2020年09月—2024年06月', precision: 'month', current: false,
    fullText: `Full education record ${index}`,
  }));
  const saved = await call('/profiles/me', 'PUT', { education });
  assert.equal(saved.status, 200);
  const canonical = saved.body.profile.education;
  const importedEducation = canonical.map((entry) => { const projected = { ...entry }; delete projected._id; return projected; });
  const extension = await call('/campus/me', 'PUT', { importedEducation });
  assert.equal(extension.status, 200);
  assert.deepEqual(extension.body.data.student.importedEducation, education);
  assert.deepEqual(extension.body.data.profile.education, canonical);
  assert.equal((await call('/profiles/me', 'PUT', { education: [...education, education[0]] })).status, 400);
  assert.equal((await call('/campus/me', 'PUT', { importedEducation: [...importedEducation, importedEducation[0]] })).status, 400);
});
