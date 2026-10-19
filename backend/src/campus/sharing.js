import express from 'express';
import { zip, strToU8 } from 'fflate';
import { promisify } from 'node:util';
import Resume from '../models/Resume.model.js';
import UserProfile from '../models/UserProfile.model.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { requireTeacher, trustedTeacherIds, getClerkClient } from '../middleware/auth.js';
import { CampusGrant, CampusStudent, CampusTarget } from './models.js';
import { grantSchema, exportSchema } from './schemas.js';
import { visibleJob } from './growth.js';
import { matchStudent } from './matching.js';
import { campusError } from './errors.js';
import { generatePDF } from '../services/pdfGenerator.js';
import { logEvent } from '../utils/diagnostics.js';

const zipAsync = promisify(zip);
let exportActive = false;
const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const router = express.Router();
async function teacherDisplay(uid) {
  const client = getClerkClient();
  if (!client || !trustedTeacherIds().includes(uid)) throw campusError(400, 'INVALID_TEACHER', '请选择名单中的已授权教师。');
  let user;
  try { user = await client.users.getUser(uid); } catch { throw campusError(503, 'TEACHER_DIRECTORY_UNAVAILABLE', '教师信息暂时无法读取。'); }
  if (user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId)?.verification?.status !== 'verified') throw campusError(400, 'INVALID_TEACHER', '该教师尚未完成邮箱验证。');
  return user.fullName || user.username || '教师';
}
router.get('/me/sharing', asyncHandler(async (req, res) => {
  const grants = await CampusGrant.find({ studentId: req.user.uid }).limit(100).lean();
  const data = [];
  for (const grant of grants) {
    let displayName = '教师信息暂不可用（仍可撤回）';
    try { displayName = await teacherDisplay(grant.teacherId); } catch { /* Existing consent must remain revocable during directory outages. */ }
    data.push({ teacherId: grant.teacherId, displayName, grantedAt: grant.grantedAt });
  }
  res.json({ success: true, data });
}));
router.post('/me/sharing', validate(grantSchema), asyncHandler(async (req, res) => {
  const displayName = await teacherDisplay(req.body.teacherId);
  const grant = await CampusGrant.findOneAndUpdate({ studentId: req.user.uid, teacherId: req.body.teacherId }, { $setOnInsert: { grantedAt: new Date() } }, { upsert: true, new: true });
  logEvent('sharing.granted');
  res.json({ success: true, data: { teacherId: grant.teacherId, displayName, grantedAt: grant.grantedAt } });
}));
router.delete('/me/sharing/:teacherId', asyncHandler(async (req, res) => {
  await CampusGrant.deleteOne({ studentId: req.user.uid, teacherId: req.params.teacherId });
  logEvent('sharing.revoked');
  res.json({ success: true, data: { revoked: true } });
}));
router.get('/teacher/jobs/:id/candidates', requireTeacher, asyncHandler(async (req, res) => {
  const job = await visibleJob(req.params.id, req.user.uid);
  const grants = await CampusGrant.find({ teacherId: req.user.uid }).sort({ studentId: 1 }).limit(501).lean();
  if (grants.length > 500) throw campusError(422, 'CANDIDATE_LIMIT', '授权候选人数超过单次查询上限，请先缩小授权范围。');
  const data = { eligible: [], conflict: [], unknown: [] };
  const studentIds = grants.map((grant) => grant.studentId);
  const students = new Map((await CampusStudent.find({ uid: { $in: studentIds } }).select('uid skillAssessments availability').lean()).map((student) => [student.uid, student]));
  const profiles = new Map((await UserProfile.find({ uid: { $in: studentIds } }).select('uid displayName').lean()).map((profile) => [profile.uid, profile]));
  const allTargets = await CampusTarget.find({ studentId: { $in: studentIds }, jobId: job._id }).select('studentId sourceResumeId sourceRevision jobRevision revision approvedRevision title').limit(2001).lean();
  if (allTargets.length > 2000) throw campusError(422, 'CANDIDATE_LIMIT', '定向简历数量超过单次查询上限。');
  const sources = new Map((await Resume.find({ _id: { $in: allTargets.map((target) => target.sourceResumeId) }, userId: { $in: studentIds } }).select('userId lastModified').lean()).map((source) => [String(source._id), source]));
  const targetsByStudent = new Map();
  for (const target of allTargets) {
    const source = sources.get(String(target.sourceResumeId));
    if (!source || source.userId !== target.studentId) continue;
    const entries = targetsByStudent.get(target.studentId) || [];
    entries.push({ id: String(target._id), revision: target.revision, approved: target.approvedRevision === target.revision && new Date(source.lastModified).getTime() === new Date(target.sourceRevision).getTime() && Boolean(target.jobRevision) && new Date(target.jobRevision).getTime() === new Date(job.updatedAt).getTime(), title: target.title });
    targetsByStudent.set(target.studentId, entries);
  }
  for (const grant of grants) {
    const match = matchStudent(students.get(grant.studentId) || {}, job);
    const candidate = { studentId: grant.studentId, displayName: profiles.get(grant.studentId)?.displayName || '未填写姓名', ...match, targets: targetsByStudent.get(grant.studentId) || [] };
    data[match.timeStatus === 'covered' ? 'eligible' : match.timeStatus === 'conflict' ? 'conflict' : 'unknown'].push(candidate);
  }
  for (const group of Object.values(data)) group.sort((a, b) => (b.coverage ?? -1) - (a.coverage ?? -1) || a.studentId.localeCompare(b.studentId));
  const currentJob = await visibleJob(req.params.id, req.user.uid);
  if (new Date(currentJob.updatedAt).getTime() !== new Date(job.updatedAt).getTime()) throw campusError(409, 'JOB_CHANGED', '岗位已更新，请刷新候选人列表。');
  const currentTargets = new Map((await CampusTarget.find({ _id: { $in: allTargets.map((target) => target._id) } }).select('studentId jobId jobRevision sourceResumeId sourceRevision revision approvedRevision').lean()).map((target) => [String(target._id), target]));
  const currentSources = new Map((await Resume.find({ _id: { $in: allTargets.map((target) => target.sourceResumeId) } }).select('userId lastModified').lean()).map((source) => [String(source._id), source]));
  for (const group of Object.values(data)) for (const candidate of group) for (const entry of candidate.targets) {
    const target = currentTargets.get(entry.id), source = target && currentSources.get(String(target.sourceResumeId));
    entry.approved = entry.approved && Boolean(target && source && target.studentId === candidate.studentId && source.userId === candidate.studentId && String(target.jobId) === String(job._id) && target.revision === entry.revision && target.approvedRevision === entry.revision && target.jobRevision && new Date(target.jobRevision).getTime() === new Date(currentJob.updatedAt).getTime() && new Date(source.lastModified).getTime() === new Date(target.sourceRevision).getTime());
  }
  // Recheck every grant at response time; removed students never remain in an earlier group.
  const live = new Set((await CampusGrant.find({ teacherId: req.user.uid, studentId: { $in: studentIds } }).select('studentId').lean()).map((grant) => grant.studentId));
  for (const key of Object.keys(data)) data[key] = data[key].filter((candidate) => live.has(candidate.studentId));
  res.json({ success: true, data });
}));

export async function authorizedExportTarget(targetId, job, teacherId, revision) {
  const target = await CampusTarget.findOne({ _id: targetId, jobId: job._id }).lean();
  if (!target || target.approvedRevision !== target.revision || (revision !== undefined && target.revision !== revision)) return null;
  if (!target.jobRevision || new Date(target.jobRevision).getTime() !== new Date(job.updatedAt).getTime()) return null;
  if (!await CampusGrant.exists({ studentId: target.studentId, teacherId })) return null;
  if (!await Resume.exists({ _id: target.sourceResumeId, userId: target.studentId, lastModified: target.sourceRevision })) return null;
  const student = await CampusStudent.findOne({ uid: target.studentId }).lean();
  if (matchStudent(student || {}, job).timeStatus !== 'covered') return null;
  return target;
}
router.post('/teacher/jobs/:id/export', requireTeacher, validate(exportSchema), asyncHandler(async (req, res) => {
  if (exportActive) throw campusError(429, 'EXPORT_BUSY', '已有批量导出正在进行，请稍后重试。');
  exportActive = true;
  const controller = new AbortController();
  const cancel = () => { if (!res.writableEnded) controller.abort(); };
  res.once('close', cancel);
  try {
    const job = await visibleJob(req.params.id, req.user.uid);
    const files = {}, manifest = [], included = [];
    let totalBytes = 0;
    logEvent('export.started', { count: req.body.targetIds.length });
    for (let index = 0; index < req.body.targetIds.length; index++) {
      if (controller.signal.aborted) return;
      const targetId = req.body.targetIds[index];
      const target = await authorizedExportTarget(targetId, job, req.user.uid);
      const item = { item: index + 1, status: 'unavailable' };
      manifest.push(item);
      if (!target) continue;
      try {
        const bytes = await generatePDF(target.draft, { title: target.title, signal: controller.signal, requestId: req.requestId });
        if (!await authorizedExportTarget(targetId, job, req.user.uid, target.revision)) continue;
        if (totalBytes + bytes.length > MAX_ARCHIVE_BYTES) { item.status = 'size_limit'; continue; }
        const filename = `resume-${String(index + 1).padStart(2, '0')}-r${target.revision}.pdf`;
        files[filename] = bytes;
        totalBytes += bytes.length;
        item.status = 'included'; item.file = filename; item.revision = target.revision;
        included.push({ targetId, revision: target.revision });
      } catch (error) {
        item.status = error.code === 'RESUME_TOO_LONG' ? 'too_long' : error.code === 'PDF_BUSY' ? 'busy' : 'failed';
      }
    }
    files['manifest.json'] = strToU8(JSON.stringify({ items: manifest }, null, 2));
    const archive = await zipAsync(files, { level: 0 });
    if (archive.byteLength > MAX_ARCHIVE_BYTES + 128 * 1024) throw campusError(422, 'ARCHIVE_TOO_LARGE', '文件总量超过单次导出上限，请减少选择。');
    // Do not release a stale archive if a grant, job, time assessment or revision changed while rendering/packing.
    const currentJob = await visibleJob(req.params.id, req.user.uid);
    if (new Date(currentJob.updatedAt).getTime() !== new Date(job.updatedAt).getTime()) throw campusError(409, 'EXPORT_CHANGED', '岗位要求已更新，请重新查看候选人后导出。');
    for (const item of included) if (!await authorizedExportTarget(item.targetId, currentJob, req.user.uid, item.revision)) throw campusError(409, 'EXPORT_CHANGED', '导出期间授权或简历发生变化，请重新选择后导出。');
    if (controller.signal.aborted) return;
    logEvent('export.completed', { bytes: archive.byteLength, count: included.length });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="careersprout-resumes.zip"');
    res.send(Buffer.from(archive.buffer, archive.byteOffset, archive.byteLength));
  } finally {
    res.removeListener('close', cancel);
    exportActive = false;
  }
}));
export default router;
