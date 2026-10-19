import express from 'express';
import Resume from '../models/Resume.model.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { CampusTarget, CampusJob } from './models.js';
import { polishSchema, targetCreateSchema, targetEditSchema, revisionSchema, objectId } from './schemas.js';
import { visibleJob, resourceJson } from './growth.js';
import { polishResume } from './ai.js';
import { campusError } from './errors.js';
import { logEvent } from '../utils/diagnostics.js';

export function targetJson(target, sourceCurrent = true) {
  const { approvedRevision, studentId, ...data } = resourceJson(target);
  return { ...data, sourceResumeId: String(target.sourceResumeId), jobId: String(target.jobId), stale: !sourceCurrent || !target.jobRevision, approved: sourceCurrent && Boolean(target.jobRevision) && approvedRevision === target.revision };
}
export async function ownedSource(id, uid) {
  if (!objectId.safeParse(String(id)).success) throw campusError(404, 'SOURCE_NOT_FOUND', '原始简历不存在或不可访问。');
  const source = await Resume.findOne({ _id: id, userId: uid }).lean();
  if (!source) throw campusError(404, 'SOURCE_NOT_FOUND', '原始简历不存在或不可访问。');
  return source;
}
async function ownedTarget(id, uid) {
  if (!objectId.safeParse(id).success) throw campusError(404, 'TARGET_NOT_FOUND', '定向简历不存在或不可访问。');
  const target = await CampusTarget.findOne({ _id: id, studentId: uid }).lean();
  if (!target) throw campusError(404, 'TARGET_NOT_FOUND', '定向简历不存在或不可访问。');
  const source = await ownedSource(target.sourceResumeId, uid);
  if (new Date(source.lastModified).getTime() !== new Date(target.sourceRevision).getTime()) throw campusError(409, 'SOURCE_CHANGED', '原始简历已修改，请基于最新版本重新生成定向草稿。');
  const job = await visibleJob(target.jobId, uid);
  if (!target.jobRevision || new Date(job.updatedAt).getTime() !== new Date(target.jobRevision).getTime()) throw campusError(409, 'JOB_CHANGED', '岗位要求已更新，请基于最新岗位重新生成定向草稿。');
  return target;
}
const router = express.Router();
router.post('/resumes/polish', aiRateLimiter, validate(polishSchema), asyncHandler(async (req, res) => {
  const job = req.body.jobId ? await visibleJob(req.body.jobId, req.user.uid) : null;
  res.json({ success: true, data: await polishResume(req.body.sourceText, job) });
}));
router.post('/me/resumes/:id/target', aiRateLimiter, validate(targetCreateSchema), asyncHandler(async (req, res) => {
  const source = await ownedSource(req.params.id, req.user.uid);
  const job = await visibleJob(req.body.jobId, req.user.uid);
  const result = await polishResume(source.originalText, job);
  const current = await ownedSource(source._id, req.user.uid);
  if (new Date(current.lastModified).getTime() !== new Date(source.lastModified).getTime()) throw campusError(409, 'SOURCE_CHANGED', '原始简历已修改，请基于最新版本重新生成。');
  const currentJob = await visibleJob(job._id, req.user.uid);
  if (new Date(currentJob.updatedAt).getTime() !== new Date(job.updatedAt).getTime()) throw campusError(409, 'JOB_CHANGED', '生成期间岗位已更新，请重新生成。');
  const target = await CampusTarget.create({ studentId: req.user.uid, sourceResumeId: source._id, sourceRevision: source.lastModified, jobId: job._id, jobRevision: job.updatedAt, title: job.title, company: job.company, ...result });
  logEvent('target.created', { revision: 1 });
  res.status(201).json({ success: true, data: targetJson(target) });
}));
router.get('/me/targets', asyncHandler(async (req, res) => {
  const sources = await Resume.find({ userId: req.user.uid }).select('_id lastModified').lean();
  const targets = await CampusTarget.find({ studentId: req.user.uid, sourceResumeId: { $in: sources.map((source) => source._id) } }).sort({ updatedAt: -1 }).limit(100).lean();
  const revisions = new Map(sources.map((source) => [String(source._id), new Date(source.lastModified).getTime()]));
  const jobs = new Map((await CampusJob.find({ _id: { $in: targets.map((target) => target.jobId) }, $or: [{ status: 'published' }, { creatorUid: req.user.uid }] }).select('updatedAt').lean()).map((job) => [String(job._id), new Date(job.updatedAt).getTime()]));
  res.json({ success: true, data: targets.map((target) => targetJson(target, revisions.get(String(target.sourceResumeId)) === new Date(target.sourceRevision).getTime() && Boolean(target.jobRevision) && jobs.get(String(target.jobId)) === new Date(target.jobRevision).getTime())) });
}));
router.patch('/me/targets/:id', validate(targetEditSchema), asyncHandler(async (req, res) => {
  await ownedTarget(req.params.id, req.user.uid);
  const target = await CampusTarget.findOneAndUpdate({ _id: req.params.id, studentId: req.user.uid, revision: req.body.revision }, { $set: { draft: req.body.draft, approvedRevision: null }, $inc: { revision: 1 } }, { new: true });
  if (!target) throw campusError(409, 'REVISION_CONFLICT', '草稿已更新，请刷新后再编辑。');
  logEvent('target.saved', { revision: target.revision });
  res.json({ success: true, data: targetJson(target) });
}));
router.post('/me/targets/:id/approve', validate(revisionSchema), asyncHandler(async (req, res) => {
  await ownedTarget(req.params.id, req.user.uid);
  const target = await CampusTarget.findOneAndUpdate({ _id: req.params.id, studentId: req.user.uid, revision: req.body.revision }, { $set: { approvedRevision: req.body.revision } }, { new: true });
  if (!target) throw campusError(409, 'REVISION_CONFLICT', '草稿已更新，请重新阅读并确认最新版本。');
  const current = await ownedTarget(req.params.id, req.user.uid);
  if (current.revision !== req.body.revision || current.approvedRevision !== req.body.revision) throw campusError(409, 'REVISION_CONFLICT', '草稿已更新，请重新阅读并确认最新版本。');
  logEvent('target.approved', { revision: target.revision });
  res.json({ success: true, data: targetJson(target) });
}));
export default router;
