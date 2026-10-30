import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import UserProfile from '../models/UserProfile.model.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireTeacher } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { CampusClass, CampusMembership, CampusGuidance, CampusStudent, CampusJob } from './models.js';
import { objectId } from './schemas.js';
import { matchStudent } from './matching.js';
import { campusError } from './errors.js';

const router = express.Router();
const consentVersion = 'class-recommendation-v1';
// Match against a one-to-one full-width ASCII shadow, but copy untouched text
// from the original so redaction never normalizes the student's other content.
function replaceContact(text, pattern, replacement) {
  const shadow = text.replace(/[\uFF01-\uFF5E\u3000]/g, (char) => char === '\u3000' ? ' ' : String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  let output = '', last = 0;
  for (const match of shadow.matchAll(pattern)) {
    output += text.slice(last, match.index) + replacement;
    last = match.index + match[0].length;
  }
  return output + text.slice(last);
}
export function redactClassText(value) {
  let text = String(value || '');
  const rules = [
    [/(?:https?:\/\/|www\.)[A-Z0-9][A-Z0-9._~:/?#\x5b\x5d@!$&'()*+,;=%+-]*/gi, '[链接已隐藏]'],
    [/(?:mailto:|tel:|weixin:\/\/|wechat:\/\/|whatsapp:\/\/|tg:\/\/|mqq:\/\/|skype:)[^\s，。；！？、<>"']+/gi, '[联系方式已隐藏]'],
    [/[A-Z0-9._%+-]+(?:[ \t]*(?:@|\[at\]|\(at\)|艾特)[ \t]*|[ \t]+at[ \t]+)[A-Z0-9-]+(?:(?:[ \t]*(?:\.|\[dot\]|\(dot\)|点)[ \t]*|[ \t]+dot[ \t]+)[A-Z0-9-]+)+/gi, '[邮箱已隐藏]'],
    [/(?<!\d)(?:(?:\+86|86|\(86\))[ \t.-]*)?1[ \t.-]*[3-9](?:[ \t.-]*\d){9}(?!\d)/g, '[电话已隐藏]'],
    [/(?<!\d)(?:(?:\+86|86|\(86\))[ \t.-]*)?(?:0\d{2,3}|\(0\d{2,3}\))[ \t.-]*\d{7,8}(?:[ \t]*(?:转|分机|ext\.?)[ \t]*\d{1,6})?(?!\d)/gi, '[电话已隐藏]'],
    [/(?<![0-9零〇一二两三四五六七八九幺])(?:1|一|幺)[ \t.-]*(?:[3-9三四五六七八九])(?:[ \t.-]*[0-9零〇一二两三四五六七八九幺]){9}(?![0-9零〇一二两三四五六七八九幺])/g, '[电话已隐藏]'],
    [/(?<![A-Z])one[ \t-]+(?:three|four|five|six|seven|eight|nine)(?:[ \t-]+(?:zero|one|two|three|four|five|six|seven|eight|nine)){9}(?![A-Z])/gi, '[电话已隐藏]'],
    [/(?:微信(?:号|ID)?|WeChat(?:[ \t]*ID)?|微讯|QQ(?:号)?)(?![A-Z])[ \t]*(?:[:：=][ \t]*|[ \t]+)[A-Z0-9_@][A-Z0-9_.@+-]*/gi, '[联系方式已隐藏]'],
    [/(?:WhatsApp|Telegram|Signal|Skype|Discord)(?:[ \t]*(?:ID|号))?[ \t]*[:=][ \t]*[A-Z0-9_@][A-Z0-9_.@+-]*/gi, '[联系方式已隐藏]'],
  ];
  for (const [pattern, replacement] of rules) text = replaceContact(text, pattern, replacement);
  return text;
}
export function redactClassMatch(match) {
  return { ...match, ...Object.fromEntries(['matchedSkills', 'missingSkills', 'unknownSkills'].map((key) => [key, match[key].map((item) => ({ ...item, name: redactClassText(item.name), evidence: redactClassText(item.evidence) }))])) };
}
const hash = (token) => createHash('sha256').update(token).digest('hex');
const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const joinSchema = tokenSchema.extend({ consent: z.literal(true), consentVersion: z.literal(consentVersion) });
const nameSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
const textSchema = z.object({ text: z.string().trim().min(1).max(4000) }).strict();
const feedbackSchema = z.object({ feedback: z.string().trim().max(4000) }).strict();
const idValid = (id) => objectId.safeParse(String(id)).success;
const classJson = (record) => ({ id: String(record._id), name: record.name, teacherName: record.teacherName });
async function ownedClass(id, teacherId) {
  if (!idValid(id)) throw campusError(404, 'CLASS_NOT_FOUND', '班级不存在或不可访问。');
  const record = await CampusClass.findOne({ _id: id, teacherId }).lean();
  if (!record) throw campusError(404, 'CLASS_NOT_FOUND', '班级不存在或不可访问。');
  return record;
}
async function invitedClass(token) {
  const record = await CampusClass.findOne({ inviteHash: hash(token), inviteRevoked: false, inviteExpiresAt: { $gt: new Date() } }).lean();
  if (!record) throw campusError(404, 'INVITE_INVALID', '邀请不存在、已撤销或已过期，请联系教师获取新邀请。');
  return record;
}
export async function classConsent(studentId, teacherId) {
  return Boolean(await CampusMembership.exists({ studentId, teacherId, active: true, consentVersion }));
}
async function activeMember(classId, teacherId, studentId) {
  return Boolean(await CampusMembership.exists({ classId, teacherId, studentId, active: true, consentVersion }));
}
function invitation() { return { token: randomBytes(32).toString('hex'), expires: new Date(Date.now() + 7 * 86400000) }; }
router.get('/teacher/classes', requireTeacher, asyncHandler(async (req, res) => {
  const rows = await CampusClass.find({ teacherId: req.user.uid }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ success: true, data: rows.map(classJson) });
}));
router.post('/teacher/classes', requireTeacher, validate(nameSchema), asyncHandler(async (req, res) => {
  const invite = invitation();
  const record = await CampusClass.create({ name: req.body.name, teacherId: req.user.uid, teacherName: req.user.name || '教师', inviteHash: hash(invite.token), inviteExpiresAt: invite.expires });
  res.status(201).json({ success: true, data: { ...classJson(record), token: invite.token, expiresAt: invite.expires } });
}));
router.post('/teacher/classes/:id/invite', requireTeacher, asyncHandler(async (req, res) => {
  await ownedClass(req.params.id, req.user.uid);
  const invite = invitation();
  await CampusClass.updateOne({ _id: req.params.id, teacherId: req.user.uid }, { $set: { inviteHash: hash(invite.token), inviteExpiresAt: invite.expires, inviteRevoked: false } });
  res.json({ success: true, data: { token: invite.token, expiresAt: invite.expires } });
}));
router.delete('/teacher/classes/:id/invite', requireTeacher, asyncHandler(async (req, res) => {
  await ownedClass(req.params.id, req.user.uid);
  await CampusClass.updateOne({ _id: req.params.id, teacherId: req.user.uid }, { $set: { inviteRevoked: true } });
  res.json({ success: true, data: { revoked: true } });
}));
router.post('/classes/invitation', validate(tokenSchema), asyncHandler(async (req, res) => {
  const record = await invitedClass(req.body.token);
  res.json({ success: true, data: { ...classJson(record), consentVersion } });
}));
router.post('/classes/join', validate(joinSchema), asyncHandler(async (req, res) => {
  const record = await invitedClass(req.body.token);
  await CampusMembership.findOneAndUpdate({ classId: record._id, studentId: req.user.uid }, { $set: { teacherId: record.teacherId, active: true, consentVersion, joinedAt: new Date(), leftAt: null } }, { upsert: true, new: true });
  res.json({ success: true, data: classJson(record) });
}));
router.get('/me/classes', asyncHandler(async (req, res) => {
  const memberships = await CampusMembership.find({ studentId: req.user.uid, active: true, consentVersion }).lean();
  const records = await CampusClass.find({ _id: { $in: memberships.map((row) => row.classId) } }).lean();
  res.json({ success: true, data: records.map(classJson) });
}));
router.delete('/me/classes/:id', asyncHandler(async (req, res) => {
  if (!idValid(req.params.id)) throw campusError(404, 'CLASS_NOT_FOUND', '班级不存在。');
  await CampusMembership.updateOne({ classId: req.params.id, studentId: req.user.uid, active: true }, { $set: { active: false, leftAt: new Date() } });
  res.json({ success: true, data: { left: true } });
}));
router.get('/teacher/classes/:id', requireTeacher, asyncHandler(async (req, res) => {
  const record = await ownedClass(req.params.id, req.user.uid);
  const memberships = await CampusMembership.find({ classId: record._id, teacherId: req.user.uid, active: true, consentVersion }).limit(501).lean();
  if (memberships.length > 500) throw campusError(422, 'CANDIDATE_LIMIT', '班级人数超过单次查询上限。');
  const ids = memberships.map((row) => row.studentId);
  const [profiles, students] = await Promise.all([
    UserProfile.find({ uid: { $in: ids } }).select('uid displayName studyStage jobRole').lean(),
    CampusStudent.find({ uid: { $in: ids } }).select('uid interests experiences skillAssessments targetJobId availability').lean(),
  ]);
  const jobs = await CampusJob.find({ _id: { $in: students.map((row) => row.targetJobId).filter(Boolean) } }).select('title company requirements availability status creatorUid').lean();
  const byProfile = new Map(profiles.map((row) => [row.uid, row]));
  const byStudent = new Map(students.map((row) => [row.uid, row]));
  const byJob = new Map(jobs.map((row) => [String(row._id), row]));
  const live = new Set((await CampusMembership.find({ classId: record._id, teacherId: req.user.uid, studentId: { $in: ids }, active: true, consentVersion }).select('studentId').lean()).map((row) => row.studentId));
  const members = ids.filter((id) => live.has(id)).map((id) => {
    const profile = byProfile.get(id) || {}, student = byStudent.get(id) || {}, candidateJob = byJob.get(String(student.targetJobId));
    const job = candidateJob && (candidateJob.status === 'published' || candidateJob.creatorUid === id) ? candidateJob : null;
    return { studentId: id, displayName: redactClassText(profile.displayName) || '未填写姓名', studyStage: profile.studyStage || '', target: redactClassText(job ? `${job.title} · ${job.company}` : (profile.jobRole || '')), interests: (student.interests || []).map(redactClassText), skills: (student.skillAssessments || []).map(({ name, level, evidence }) => ({ name: redactClassText(name), level, evidence: redactClassText(evidence) })), experiences: (student.experiences || []).filter((row) => row.kind === 'project').map(({ title, context, actions, result, fullText, state }) => ({ title: redactClassText(title), context: redactClassText(context), actions: redactClassText(actions), result: redactClassText(result), fullText: redactClassText(fullText), state })), gap: job ? redactClassMatch(matchStudent(student, job)) : null };
  });
  const counts = new Map();
  for (const member of members) for (const skill of member.gap?.missingSkills || []) counts.set(skill.name, (counts.get(skill.name) || 0) + 1);
  res.json({ success: true, data: { ...classJson(record), members, gaps: [...counts].map(([name, count]) => ({ name, count })), sampleSize: members.length } });
}));
router.get('/teacher/classes/:id/students/:studentId/guidance', requireTeacher, asyncHandler(async (req, res) => {
  await ownedClass(req.params.id, req.user.uid);
  if (!await activeMember(req.params.id, req.user.uid, req.params.studentId)) throw campusError(404, 'MEMBER_NOT_FOUND', '学生不在班级中。');
  const rows = await CampusGuidance.find({ classId: req.params.id, teacherId: req.user.uid, studentId: req.params.studentId }).sort({ createdAt: -1 }).limit(100).lean();
  if (!await activeMember(req.params.id, req.user.uid, req.params.studentId)) throw campusError(404, 'MEMBER_NOT_FOUND', '学生不在班级中。');
  res.json({ success: true, data: rows.map((row) => ({ id: String(row._id), text: row.text, feedback: redactClassText(row.feedback), createdAt: row.createdAt })) });
}));
router.post('/teacher/classes/:id/students/:studentId/guidance', requireTeacher, validate(textSchema), asyncHandler(async (req, res) => {
  await ownedClass(req.params.id, req.user.uid);
  if (!await activeMember(req.params.id, req.user.uid, req.params.studentId)) throw campusError(404, 'MEMBER_NOT_FOUND', '学生不在班级中。');
  const row = await CampusGuidance.create({ classId: req.params.id, teacherId: req.user.uid, studentId: req.params.studentId, text: req.body.text });
  if (!await activeMember(req.params.id, req.user.uid, req.params.studentId)) throw campusError(409, 'MEMBER_LEFT', '学生已退出班级，建议未向教师显示。');
  res.status(201).json({ success: true, data: { id: String(row._id), text: row.text, feedback: redactClassText(row.feedback), createdAt: row.createdAt } });
}));
router.get('/me/guidance', asyncHandler(async (req, res) => {
  const rows = await CampusGuidance.find({ studentId: req.user.uid }).sort({ createdAt: -1 }).limit(200).lean();
  const classes = await CampusClass.find({ _id: { $in: rows.map((row) => row.classId) } }).lean();
  const names = new Map(classes.map((row) => [String(row._id), classJson(row)]));
  res.json({ success: true, data: rows.map((row) => ({ id: String(row._id), class: names.get(String(row.classId)), text: row.text, feedback: row.feedback, createdAt: row.createdAt })) });
}));
router.patch('/me/guidance/:id', validate(feedbackSchema), asyncHandler(async (req, res) => {
  if (!idValid(req.params.id)) throw campusError(404, 'GUIDANCE_NOT_FOUND', '建议不存在。');
  const row = await CampusGuidance.findOneAndUpdate({ _id: req.params.id, studentId: req.user.uid }, { $set: { feedback: req.body.feedback } }, { new: true });
  if (!row) throw campusError(404, 'GUIDANCE_NOT_FOUND', '建议不存在。');
  res.json({ success: true, data: { id: String(row._id), feedback: row.feedback } });
}));
export default router;
