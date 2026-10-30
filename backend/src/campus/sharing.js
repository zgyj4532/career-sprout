import express from 'express';
import { zip, strToU8 } from 'fflate';
import { promisify } from 'node:util';
import Resume from '../models/Resume.model.js';
import UserProfile from '../models/UserProfile.model.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { requireTeacher, trustedTeacherIds, getClerkClient } from '../middleware/auth.js';
import { CampusGrant, CampusMembership, CampusStudent, CampusTarget } from './models.js';
import { grantSchema, exportSchema, objectId } from './schemas.js';
import { visibleJob } from './growth.js';
import { matchStudent } from './matching.js';
import { campusError } from './errors.js';
import { generateResumePDF, selectedResumeParagraphs } from '../services/resumePdfExport.js';
import { generatePDF } from '../services/pdfGenerator.js';
import { logEvent } from '../utils/diagnostics.js';
import { sourceContentMatches, contentRevisionOf } from './resumeRevision.js';
import { classConsent, redactClassMatch, redactClassText } from './classes.js';
import { polishResume } from './ai.js';
import { withResumeAssociation } from './resumeDelete.js';
import { z } from 'zod';

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
  const [grants, memberships] = await Promise.all([
    CampusGrant.find({ teacherId: req.user.uid }).sort({ studentId: 1 }).limit(501).lean(),
    CampusMembership.find({ teacherId: req.user.uid, active: true, consentVersion: 'class-recommendation-v1' }).sort({ studentId: 1 }).limit(501).lean(),
  ]);
  const studentIds = [...new Set([...grants, ...memberships].map((row) => row.studentId))];
  if (studentIds.length > 500) throw campusError(422, 'CANDIDATE_LIMIT', '授权候选人数超过单次查询上限。');
  const data = { eligible: [], conflict: [], unknown: [] };
  const students = new Map((await CampusStudent.find({ uid: { $in: studentIds } }).select('uid skillAssessments availability').lean()).map((student) => [student.uid, student]));
  const profiles = new Map((await UserProfile.find({ uid: { $in: studentIds } }).select('uid displayName').lean()).map((profile) => [profile.uid, profile]));
  const allTargets = await CampusTarget.find({ studentId: { $in: studentIds }, jobId: job._id }).select('studentId sourceResumeId sourceRevision jobRevision revision approvedRevision classGeneratedBy classGeneratedRevision title').limit(2001).lean();
  if (allTargets.length > 2000) throw campusError(422, 'CANDIDATE_LIMIT', '定向简历数量超过单次查询上限。');
  const sources = new Map((await Resume.find({ _id: { $in: allTargets.map((target) => target.sourceResumeId) }, userId: { $in: studentIds }, deleting: { $ne: true } }).select('userId contentRevision').lean()).map((source) => [String(source._id), source]));
  const targetsByStudent = new Map();
  for (const target of allTargets) {
    const source = sources.get(String(target.sourceResumeId));
    if (!source || source.userId !== target.studentId) continue;
    const entries = targetsByStudent.get(target.studentId) || [];
    entries.push({ id: String(target._id), revision: target.revision, approved: target.approvedRevision === target.revision && sourceContentMatches(source, target) && Boolean(target.jobRevision) && new Date(target.jobRevision).getTime() === new Date(job.updatedAt).getTime(), classExportable: target.classGeneratedBy === req.user.uid && target.classGeneratedRevision === target.revision && sourceContentMatches(source, target) && Boolean(target.jobRevision) && new Date(target.jobRevision).getTime() === new Date(job.updatedAt).getTime(), title: redactClassText(target.title) });
    targetsByStudent.set(target.studentId, entries);
  }
  for (const studentId of studentIds) {
    const match = redactClassMatch(matchStudent(students.get(studentId) || {}, job));
    const candidate = { studentId, displayName: redactClassText(profiles.get(studentId)?.displayName) || '未填写姓名', ...match, classConsent: memberships.some((row) => row.studentId === studentId), targets: targetsByStudent.get(studentId) || [] };
    data[match.timeStatus === 'covered' ? 'eligible' : match.timeStatus === 'conflict' ? 'conflict' : 'unknown'].push(candidate);
  }
  for (const group of Object.values(data)) group.sort((a, b) => (b.coverage ?? -1) - (a.coverage ?? -1) || a.studentId.localeCompare(b.studentId));
  const currentJob = await visibleJob(req.params.id, req.user.uid);
  if (new Date(currentJob.updatedAt).getTime() !== new Date(job.updatedAt).getTime()) throw campusError(409, 'JOB_CHANGED', '岗位已更新，请刷新候选人列表。');
  const currentTargets = new Map((await CampusTarget.find({ _id: { $in: allTargets.map((target) => target._id) } }).select('studentId jobId jobRevision sourceResumeId sourceRevision revision approvedRevision classGeneratedBy classGeneratedRevision').lean()).map((target) => [String(target._id), target]));
  const currentSources = new Map((await Resume.find({ _id: { $in: allTargets.map((target) => target.sourceResumeId) }, deleting: { $ne: true } }).select('userId contentRevision').lean()).map((source) => [String(source._id), source]));
  for (const group of Object.values(data)) for (const candidate of group) for (const entry of candidate.targets) {
    const target = currentTargets.get(entry.id), source = target && currentSources.get(String(target.sourceResumeId));
    entry.approved = entry.approved && Boolean(target && source && target.studentId === candidate.studentId && source.userId === candidate.studentId && String(target.jobId) === String(job._id) && target.revision === entry.revision && target.approvedRevision === entry.revision && target.jobRevision && new Date(target.jobRevision).getTime() === new Date(currentJob.updatedAt).getTime() && sourceContentMatches(source, target));
    entry.classExportable = entry.classExportable && Boolean(target && source && target.studentId === candidate.studentId && source.userId === candidate.studentId && String(target.jobId) === String(job._id) && target.revision === entry.revision && target.classGeneratedBy === req.user.uid && target.classGeneratedRevision === entry.revision && target.jobRevision && new Date(target.jobRevision).getTime() === new Date(currentJob.updatedAt).getTime() && sourceContentMatches(source, target));
  }
  const [liveGrants, liveMemberships] = await Promise.all([
    CampusGrant.find({ teacherId: req.user.uid, studentId: { $in: studentIds } }).select('studentId').lean(),
    CampusMembership.find({ teacherId: req.user.uid, studentId: { $in: studentIds }, active: true, consentVersion: 'class-recommendation-v1' }).select('studentId').lean(),
  ]);
  const live = new Set([...liveGrants, ...liveMemberships].map((row) => row.studentId));
  const liveClass = new Set(liveMemberships.map((row) => row.studentId));
  const liveLegacy = new Set(liveGrants.map((row) => row.studentId));
  for (const group of Object.values(data)) for (const candidate of group) { candidate.classConsent = liveClass.has(candidate.studentId); candidate.legacyConsent = liveLegacy.has(candidate.studentId); }
  for (const key of Object.keys(data)) data[key] = data[key].filter((candidate) => live.has(candidate.studentId));
  res.json({ success: true, data });
}));

async function authorizationSnapshot(studentId, teacherId) {
  const [memberships, grant] = await Promise.all([
    CampusMembership.find({ studentId, teacherId, active: true, consentVersion: 'class-recommendation-v1' }).select('_id joinedAt').lean(),
    CampusGrant.findOne({ studentId, teacherId }).select('_id').lean(),
  ]);
  return JSON.stringify({ classes: memberships.map((row) => `${row._id}:${new Date(row.joinedAt).getTime()}`).sort(), grant: grant ? String(grant._id) : null });
}
export async function authorizedExportTarget(targetId, job, teacherId, revision) {
  const target = await CampusTarget.findOne({ _id: targetId, jobId: job._id }).lean();
  if (!target || (revision !== undefined && target.revision !== revision)) return null;
  if (!target.jobRevision || new Date(target.jobRevision).getTime() !== new Date(job.updatedAt).getTime()) return null;
  const classAllowed = target.classGeneratedBy === teacherId && target.classGeneratedRevision === target.revision && await classConsent(target.studentId, teacherId);
  const legacyAllowed = target.approvedRevision === target.revision && await CampusGrant.exists({ studentId: target.studentId, teacherId });
  if (!classAllowed && !legacyAllowed) return null;
  const source = await Resume.findOne({ _id: target.sourceResumeId, userId: target.studentId, deleting: { $ne: true } }).select('contentRevision').lean();
  if (!source || !sourceContentMatches(source, target)) return null;
  const student = await CampusStudent.findOne({ uid: target.studentId }).lean();
  if (!classAllowed && matchStudent(student || {}, job).timeStatus !== 'covered') return null;
  return target;
}
const generateSchema = z.object({ studentIds: z.array(z.string().min(1).max(150)).min(1).max(20).refine((ids) => new Set(ids).size === ids.length) }).strict();
async function boundedPolish(text, job, signal) {
  const controller = new AbortController();
  let timer, cancel;
  try {
    return await Promise.race([
      polishResume(text, job, { signal: controller.signal, timeout: 45000, maxRetries: 0, verbatimLines: true }),
      new Promise((_, reject) => {
        cancel = () => { controller.abort(); reject(campusError(499, 'REQUEST_ABORTED', '生成已取消。')); };
        if (signal.aborted) cancel(); else signal.addEventListener('abort', cancel, { once: true });
        timer = setTimeout(() => { reject(campusError(504, 'AI_TIMEOUT', '生成超时，请稍后重试。')); controller.abort(); }, 45000);
      }),
    ]);
  } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
}
router.post('/teacher/jobs/:id/generate', requireTeacher, validate(generateSchema), asyncHandler(async (req, res) => {
  const controller = new AbortController();
  res.once('close', () => { if (!res.writableEnded) controller.abort(); });
  const job = await visibleJob(req.params.id, req.user.uid);
  const results = [], snapshots = new Map();
  for (const studentId of req.body.studentIds) {
    if (controller.signal.aborted) return;
    try {
      if (!await classConsent(studentId, req.user.uid)) throw campusError(403, 'CONSENT_REQUIRED', '班级授权已撤回。');
      const authorization = await authorizationSnapshot(studentId, req.user.uid);
      const source = await Resume.findOne({ userId: studentId, deleting: { $ne: true } }).sort({ updatedAt: -1 }).lean();
      if (!source?.originalText?.trim()) throw campusError(422, 'SOURCE_MISSING', '学生尚未保存可用简历。');
      if (source.originalText.length > 20000) throw campusError(422, 'SOURCE_TOO_LONG', '已保存简历过长，请先精简后重试。');
      const sourceText = redactClassText(source.originalText);
      const result = await boundedPolish(sourceText, job, controller.signal);
      // Unverifiable paraphrases are rejected rather than treated as grounded.
      const lines = result.draft.split('\n').map((line) => line.replace(/^\s*(?:#{1,6}\s*|[-*+]\s+|\d+[.)]\s*)/, '').replace(/\*\*/g, '').trim()).filter(Boolean);
      const sourceLines = new Set(sourceText.split('\n').map((line) => line.replace(/^\s*(?:#{1,6}\s*|[-*+]\s+|\d+[.)]\s*)/, '').replace(/\*\*/g, '').trim()).filter(Boolean));
      if (!lines.length || lines.some((line) => !sourceLines.has(line))) throw campusError(502, 'AI_UNGROUNDED', '生成内容无法逐句对应原文，请重试。');
      const target = await withResumeAssociation(source._id, studentId, 'target', async (current) => {
        if (controller.signal.aborted) throw campusError(499, 'REQUEST_ABORTED', '生成已取消。');
        if (contentRevisionOf(current) !== contentRevisionOf(source)) throw campusError(409, 'SOURCE_CHANGED', '原始简历已变化。');
        if (!await classConsent(studentId, req.user.uid) || await authorizationSnapshot(studentId, req.user.uid) !== authorization) throw campusError(403, 'CONSENT_REQUIRED', '班级授权已变化。');
        const currentJob = await visibleJob(job._id, req.user.uid);
        if (new Date(currentJob.updatedAt).getTime() !== new Date(job.updatedAt).getTime()) throw campusError(409, 'JOB_CHANGED', '岗位已变化。');
        return CampusTarget.create({ studentId, sourceResumeId: source._id, sourceRevision: contentRevisionOf(source), jobId: job._id, jobRevision: job.updatedAt, title: job.title, company: job.company, ...result, classGeneratedBy: req.user.uid, classGeneratedRevision: 1 });
      });
      const currentJob = await visibleJob(job._id, req.user.uid);
      if (new Date(currentJob.updatedAt).getTime() !== new Date(job.updatedAt).getTime() || await authorizationSnapshot(studentId, req.user.uid) !== authorization || !await authorizedExportTarget(target._id, currentJob, req.user.uid, target.revision)) throw campusError(409, 'GENERATION_CHANGED', '生成期间授权、岗位或简历已变化，请重试。');
      snapshots.set(studentId, authorization);
      results.push({ studentId, status: 'generated', target: { id: String(target._id), title: target.title, revision: target.revision, classExportable: true, draft: target.draft, changes: target.changes, questions: target.questions } });
    } catch (error) {
      results.push({ studentId, status: 'failed', code: /^[A-Z_0-9]{1,60}$/.test(error.code || '') ? error.code : 'GENERATION_FAILED', message: error.safeMessage || '生成未完成，请检查资料后重试。' });
    }
  }
  if (controller.signal.aborted) return;
  const currentJob = await visibleJob(job._id, req.user.uid);
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    if (result.status !== 'generated') continue;
    if (new Date(currentJob.updatedAt).getTime() !== new Date(job.updatedAt).getTime() || await authorizationSnapshot(result.studentId, req.user.uid) !== snapshots.get(result.studentId) || !await authorizedExportTarget(result.target.id, currentJob, req.user.uid, result.target.revision)) {
      results[index] = { studentId: result.studentId, status: 'failed', code: 'GENERATION_CHANGED', message: '生成期间授权、岗位或简历已变化，请重试。' };
    }
  }
  res.json({ success: true, data: results });
}));
const reviewExportSchema = z.object({ revision: z.number().int().positive(), selected: z.array(z.number().int().nonnegative()).min(1).max(300) }).strict();
router.post('/teacher/jobs/:id/targets/:targetId/review-export', requireTeacher, validate(reviewExportSchema), asyncHandler(async (req, res) => {
  const controller = new AbortController();
  const cancel = () => { if (!res.writableEnded) controller.abort(); };
  res.once('close', cancel);
  try {
    if (!objectId.safeParse(req.params.targetId).success) throw campusError(400, 'INVALID_TARGET', '简历标识无效，请重新查看候选人。');
    const job = await visibleJob(req.params.id, req.user.uid);
    const target = await authorizedExportTarget(req.params.targetId, job, req.user.uid, req.body.revision);
    if (!target) throw campusError(409, 'EXPORT_CHANGED', '授权或简历版本已变化，请重新查看候选人。');
    const authorization = await authorizationSnapshot(target.studentId, req.user.uid);
    const { draft } = selectedResumeParagraphs(target.draft, req.body.selected);
    const bytes = await generatePDF(draft, { title: target.title, signal: controller.signal, requestId: req.requestId });
    const currentJob = await visibleJob(req.params.id, req.user.uid);
    if (new Date(currentJob.updatedAt).getTime() !== new Date(job.updatedAt).getTime() ||
        !await authorizedExportTarget(target._id, currentJob, req.user.uid, target.revision) ||
        await authorizationSnapshot(target.studentId, req.user.uid) !== authorization) {
      throw campusError(409, 'EXPORT_CHANGED', '导出期间授权、岗位或简历发生变化，请重新查看候选人。');
    }
    if (controller.signal.aborted) return;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="careersprout-reviewed-resume.pdf"');
    res.send(bytes);
  } finally { res.removeListener('close', cancel); }
}));
router.post('/teacher/jobs/:id/export', requireTeacher, validate(exportSchema), asyncHandler(async (req, res) => {
  if (exportActive) throw campusError(429, 'EXPORT_BUSY', '已有批量导出正在进行，请稍后重试。');
  exportActive = true;
  const controller = new AbortController();
  const cancel = () => { if (!res.writableEnded) controller.abort(); };
  res.once('close', cancel);
  try {
    const job = await visibleJob(req.params.id, req.user.uid);
    const files = {}, manifest = [], included = [], reviews = [];
    let totalBytes = 0;
    logEvent('export.started', { count: req.body.targetIds.length });
    for (let index = 0; index < req.body.targetIds.length; index++) {
      if (controller.signal.aborted) return;
      const targetId = req.body.targetIds[index];
      const target = await authorizedExportTarget(targetId, job, req.user.uid);
      const item = { item: index + 1, status: 'unavailable' };
      manifest.push(item);
      if (!target) continue;
      const authorization = await authorizationSnapshot(target.studentId, req.user.uid);
      try {
        const { bytes, compression } = await generateResumePDF(target.draft, { title: target.title, signal: controller.signal, requestId: req.requestId });
        if (!await authorizedExportTarget(targetId, job, req.user.uid, target.revision) || await authorizationSnapshot(target.studentId, req.user.uid) !== authorization) continue;
        const review = compression ? strToU8(JSON.stringify(compression, null, 2)) : null;
        if (totalBytes + bytes.length + (review?.length || 0) > MAX_ARCHIVE_BYTES) { item.status = 'size_limit'; continue; }
        const filename = `resume-${String(index + 1).padStart(2, '0')}-r${target.revision}.pdf`;
        files[filename] = bytes;
        if (review) { item.review = `${filename}.review.json`; files[item.review] = review; }
        totalBytes += bytes.length + (review?.length || 0);
        item.status = 'included'; item.file = filename; item.revision = target.revision;
        if (compression) reviews.push({ targetId, revision: target.revision, ...compression });
        included.push({ targetId, studentId: target.studentId, revision: target.revision, authorization });
      } catch (error) {
        item.status = error.code === 'RESUME_TOO_LONG' ? 'too_long' : error.code === 'PDF_BUSY' ? 'busy' : 'failed';
        item.code = /^[A-Z_0-9]{1,60}$/.test(error.code || '') ? error.code : 'EXPORT_FAILED';
      }
    }
    files['manifest.json'] = strToU8(JSON.stringify({ items: manifest }, null, 2));
    const archive = await zipAsync(files, { level: 0 });
    if (archive.byteLength > MAX_ARCHIVE_BYTES + 128 * 1024) throw campusError(422, 'ARCHIVE_TOO_LARGE', '文件总量超过单次导出上限，请减少选择。');
    // Do not release a stale archive if a grant, job, time assessment or revision changed while rendering/packing.
    const currentJob = await visibleJob(req.params.id, req.user.uid);
    if (new Date(currentJob.updatedAt).getTime() !== new Date(job.updatedAt).getTime()) throw campusError(409, 'EXPORT_CHANGED', '岗位要求已更新，请重新查看候选人后导出。');
    for (const item of included) if (!await authorizedExportTarget(item.targetId, currentJob, req.user.uid, item.revision) || await authorizationSnapshot(item.studentId, req.user.uid) !== item.authorization) throw campusError(409, 'EXPORT_CHANGED', '导出期间授权或简历发生变化，请重新选择后导出。');
    res.setHeader('Cache-Control', 'no-store');
    if (req.get('X-Export-Review') === '1') {
      if (controller.signal.aborted) return;
      logEvent('export.completed', { bytes: archive.byteLength, count: included.length });
      return res.json({ success: true, data: { archive: Buffer.from(archive.buffer, archive.byteOffset, archive.byteLength).toString('base64'), manifest, reviews } });
    }
    res.setHeader('X-Export-Manifest', Buffer.from(JSON.stringify(manifest)).toString('base64'));
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
