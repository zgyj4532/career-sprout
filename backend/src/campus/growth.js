import express from 'express';
import UserProfile from '../models/UserProfile.model.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { CampusStudent, CampusJob } from './models.js';
import { studentSchema, jobSchema, jobPatchSchema, analyzeSchema, objectId } from './schemas.js';
import { campusError } from './errors.js';
import { matchStudent } from './matching.js';
import { analyzeJob } from './ai.js';
import { logEvent } from '../utils/diagnostics.js';

export function resourceJson(record) {
  const value = typeof record.toObject === 'function' ? record.toObject() : record;
  const { _id, __v, ...rest } = value;
  return { ...rest, id: String(_id) };
}
export async function visibleJob(id, uid) {
  if (!objectId.safeParse(String(id)).success) throw campusError(404, 'NOT_FOUND', '岗位不存在或不可访问。');
  const job = await CampusJob.findOne({ _id: id, $or: [{ status: 'published' }, { creatorUid: uid }] }).lean();
  if (!job) throw campusError(404, 'NOT_FOUND', '岗位不存在或不可访问。');
  return job;
}
async function ownMaterial(user) {
  const profile = await UserProfile.findOne({ uid: user.uid }).select('+phone +dateOfBirth +gender').lean();
  const student = await CampusStudent.findOne({ uid: user.uid }).lean();
  return { profile: profile || { displayName: user.name || '', studyStage: '', education: [] }, student: {
    interests: student?.interests || [], experiences: student?.experiences || [], skillAssessments: student?.skillAssessments || [],
    availability: student?.availability || { startDate: null, endDate: null, daysPerWeek: null }, targetJobId: student?.targetJobId ? String(student.targetJobId) : null,
  } };
}
const router = express.Router();
router.get('/me', asyncHandler(async (req, res) => res.json({ success: true, data: await ownMaterial(req.user) })));
router.put('/me', validate(studentSchema), asyncHandler(async (req, res) => {
  if (req.body.targetJobId) await visibleJob(req.body.targetJobId, req.user.uid);
  await CampusStudent.findOneAndUpdate({ uid: req.user.uid }, { $set: req.body }, { upsert: true, new: true, runValidators: true });
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
router.post('/jobs', validate(jobSchema), asyncHandler(async (req, res) => {
  const job = await CampusJob.create({ ...req.body, creatorUid: req.user.uid, authorKind: req.user.isTeacher ? 'teacher' : req.body.authorKind === 'alumni' ? 'alumni' : 'student' });
  logEvent('job.saved');
  res.status(201).json({ success: true, data: resourceJson(job) });
}));
router.get('/jobs/:id', asyncHandler(async (req, res) => res.json({ success: true, data: resourceJson(await visibleJob(req.params.id, req.user.uid)) })));
router.patch('/jobs/:id', validate(jobPatchSchema), asyncHandler(async (req, res) => {
  await visibleJob(req.params.id, req.user.uid);
  const patch = { ...req.body };
  if (patch.authorKind !== undefined) patch.authorKind = req.user.isTeacher ? 'teacher' : patch.authorKind === 'alumni' ? 'alumni' : 'student';
  const job = await CampusJob.findOneAndUpdate({ _id: req.params.id, creatorUid: req.user.uid }, { $set: patch }, { new: true, runValidators: true });
  if (!job) throw campusError(403, 'JOB_OWNER_REQUIRED', '只有发布者可以修改岗位。');
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
