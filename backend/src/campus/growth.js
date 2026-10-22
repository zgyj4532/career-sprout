import express from 'express';
import { readFreshProfile } from './profileRead.js';
import { preserveEducation } from './importSave.js';
import Resume from '../models/Resume.model.js';
import { accountWriteHandler as asyncHandler } from './accountWrites.js';
import { validate } from '../middleware/validate.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { CampusStudent, CampusJob, CampusInterviewPrep } from './models.js';
import { studentSchema, jobSchema, jobPatchSchema, analyzeSchema, objectId, interviewPrepSchema } from './schemas.js';
import { campusError } from './errors.js';
import { matchStudent } from './matching.js';
import { analyzeJob } from './ai.js';
import { logEvent } from '../utils/diagnostics.js';
import { saveMaterial, recoverMaterialSave } from './materialSave.js';
import { writeProfileFields, profileJson } from './profileWrite.js';

export function resourceJson(record) {
  const value = typeof record.toObject === 'function' ? record.toObject() : record;
  const { _id, __v, saveReceipts, confirmationReceipts, ...rest } = value;
  return { ...rest, id: String(_id) };
}
export async function visibleJob(id, uid) {
  if (!objectId.safeParse(String(id)).success) throw campusError(404, 'NOT_FOUND', '岗位不存在或不可访问。');
  const job = await CampusJob.findOne({ _id: id, $or: [{ status: 'published' }, { creatorUid: uid }] }).lean();
  if (!job) throw campusError(404, 'NOT_FOUND', '岗位不存在或不可访问。');
  return job;
}
async function ownMaterial(user) {
  const profile = await readFreshProfile(user.uid);
  const student = await CampusStudent.findOne({ uid: user.uid }).lean();
  return { profile: profileJson(profile) || { displayName: user.name || '', studyStage: '', collegeStudent: null, collegeStudentKnown: false, updatedAt: null, education: [], skills: [] }, student: {
    interests: student?.interests || [], experiences: student?.experiences || [], skillAssessments: student?.skillAssessments || [],
    updatedAt: student?.updatedAt || null,
    availability: student?.availability || { startDate: null, endDate: null, daysPerWeek: null }, targetJobId: student?.targetJobId ? String(student.targetJobId) : null,
    otherMaterials: student?.otherMaterials || '',
    importedEducation: student?.importedEducation || profile?.education || [],
  } };
}
const router = express.Router();
router.get('/me/interview-prep', asyncHandler(async (req, res) => {
  const prep = await CampusInterviewPrep.findOne({ uid: req.user.uid }).lean();
  res.json({ success: true, data: prep ? resourceJson(prep) : null });
}));
router.put('/me/interview-prep', validate(interviewPrepSchema), asyncHandler(async (req, res) => {
  if (req.body.jobId) await visibleJob(req.body.jobId, req.user.uid);
  if (req.body.resumeId && !await Resume.exists({ _id: req.body.resumeId, userId: req.user.uid, deleting: { $ne: true } })) throw campusError(404, 'RESUME_NOT_FOUND', '简历不存在或不可访问。');
  const prep = await CampusInterviewPrep.findOneAndUpdate({ uid: req.user.uid }, { $set: req.body }, { new: true, upsert: true, runValidators: true });
  res.json({ success: true, data: resourceJson(prep) });
}));
router.get('/me', asyncHandler(async (req, res) => res.json({ success: true, data: await ownMaterial(req.user) })));
router.put('/me', validate(studentSchema), asyncHandler(async (req, res) => {
  if (req.body.targetJobId) await visibleJob(req.body.targetJobId, req.user.uid);
  const { importedEducation, expectedUpdatedAt, ...studentBody } = req.body;
  await writeProfileFields(CampusStudent, req.user.uid, { ...studentBody, ...(importedEducation ? { importedEducation: preserveEducation(importedEducation) } : {}) }, expectedUpdatedAt);
  logEvent('student.saved');
  res.json({ success: true, data: await ownMaterial(req.user) });
}));
router.get('/jobs', asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1), limit = Number(req.query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(limit) || limit < 1 || limit > 50) throw campusError(400, 'INVALID_PAGINATION', '分页参数不正确。');
  const filter = { $or: [{ status: 'published' }, { creatorUid: req.user.uid }] };
  const items = await CampusJob.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean();
  res.json({ success: true, data: { items: items.map(resourceJson), total: await CampusJob.countDocuments(filter) } });
}));
router.post('/jobs/analyze', aiRateLimiter, validate(analyzeSchema), asyncHandler(async (req, res) => res.json({ success: true, data: await analyzeJob(req.body.description) })));
router.get('/jobs/save-operations/:operationId', asyncHandler(async (req, res) => res.json({ success: true, data: await recoverMaterialSave('job', req.user.uid, req.params.operationId) })));
router.post('/jobs', validate(jobSchema), asyncHandler(async (req, res) => {
  if (req.body.operationId) return res.status(201).json({ success: true, data: await saveMaterial({ kind: 'job', uid: req.user.uid, body: req.body, isTeacher: req.user.isTeacher }) });
  const job = await CampusJob.create({ ...req.body, creatorUid: req.user.uid, authorKind: req.user.isTeacher ? 'teacher' : req.body.authorKind === 'alumni' ? 'alumni' : 'student' });
  logEvent('job.saved');
  res.status(201).json({ success: true, data: resourceJson(job) });
}));
router.get('/jobs/:id', asyncHandler(async (req, res) => res.json({ success: true, data: resourceJson(await visibleJob(req.params.id, req.user.uid)) })));
router.patch('/jobs/:id', validate(jobPatchSchema), asyncHandler(async (req, res) => {
  const existing = await visibleJob(req.params.id, req.user.uid);
  if (existing.creatorUid !== req.user.uid) throw campusError(403, 'JOB_OWNER_REQUIRED', '只有发布者可以修改岗位。');
  if (req.body.operationId) return res.json({ success: true, data: await saveMaterial({ kind: 'job', uid: req.user.uid, id: req.params.id, body: req.body, isTeacher: req.user.isTeacher }) });
  const { expectedUpdatedAt, ...patch } = req.body;
  if (patch.authorKind !== undefined) patch.authorKind = req.user.isTeacher ? 'teacher' : patch.authorKind === 'alumni' ? 'alumni' : 'student';
  const job = await CampusJob.findOneAndUpdate({ _id: req.params.id, creatorUid: req.user.uid, ...(expectedUpdatedAt !== undefined ? { updatedAt: expectedUpdatedAt } : { 'saveReceipts.0': { $exists: false } }) }, { $set: patch }, { new: true, runValidators: true });
  if (!job) throw campusError(409, 'JOB_CHANGED', '岗位已变化或不可修改，请保留编辑并重新核对。');
  logEvent('job.saved');
  res.json({ success: true, data: resourceJson(job) });
}));
router.get('/jobs/:id/gap', asyncHandler(async (req, res) => {
  const job = await visibleJob(req.params.id, req.user.uid);
  const student = await CampusStudent.findOne({ uid: req.user.uid }).lean();
  const { coverage, ...gap } = matchStudent(student || {}, job);
  res.json({ success: true, data: gap });
}));
export default router;
