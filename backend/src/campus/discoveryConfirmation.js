import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import UserProfile from '../models/UserProfile.model.js';
import Interview from '../models/Interview.model.js';
import { CampusStudent, CampusDiscoveryConfirmation } from './models.js';
import { campusError } from './errors.js';
import { matchesFields, stableImportId } from './confirmLedger.js';
import { invalidateProfileCache } from '../services/profileCache.js';
import { withAccountWrite } from './accountWrites.js';
import { profileJson, privateProfileFields } from './profileWrite.js';

const reviewedCandidate = z.object({ id: z.string().max(80), value: z.union([z.boolean(), z.string().trim().min(1).max(4000)]), state: z.enum(['idea', 'in_progress', 'completed']).optional() }).strict();
export const confirmationSchema = z.object({
  candidates: z.array(reviewedCandidate).max(30).refine((items) => new Set(items.map((item) => item.id)).size === items.length),
  expected: z.object({ collegeStudent: z.boolean().nullable(), major: z.string().max(100) }).strict(),
  resolutions: z.object({ collegeStudent: z.enum(['keep', 'replace']).optional(), major: z.enum(['keep', 'replace']).optional() }).strict().default({}),
}).strict();
export function profileTargets(profile) {
  return { collegeStudent: profileJson(profile)?.collegeStudent ?? null, major: profile?.education?.find((entry) => entry.current)?.field || profile?.education?.[0]?.field || '' };
}
async function targets(uid) {
  const [profile, student] = await Promise.all([UserProfile.findOne({ uid }).lean(), CampusStudent.findOne({ uid }).lean()]);
  return { profile, student };
}
function assertDiscovery(session) {
  if (session.purpose !== 'discovery' || session.status !== 'completed') throw campusError(409, 'DISCOVERY_NOT_READY', '请先结束交流并查看整理结果。');
}
export async function confirmationView(session) {
  assertDiscovery(session);
  const [ledger, current] = await Promise.all([CampusDiscoveryConfirmation.findOne({ interviewId: session._id, userId: session.userId }).lean(), targets(session.userId)]);
  return {
    status: ledger?.status || 'unconfirmed', candidates: session.discovery?.candidates || [], expected: profileTargets(current.profile),
    frozen: ledger ? { candidates: ledger.frozen.candidates, expected: ledger.frozen.expected, resolutions: ledger.frozen.resolutions } : null,
    steps: ledger?.steps || {}, cachePending: ledger?.cachePending || false,
    result: ledger?.status === 'completed' ? { saved: true } : null,
  };
}
function reviewed(session, body) {
  return body.candidates.map((input) => {
    const original = session.discovery?.candidates?.find((item) => item.id === input.id);
    if (!original) throw campusError(400, 'CANDIDATE_INVALID', '资料来源不属于这次交流。');
    const item = { ...original, ...input };
    if (item.kind === 'collegeStudent' ? typeof item.value !== 'boolean' : typeof item.value !== 'string') throw campusError(400, 'CANDIDATE_INVALID', '资料字段类型不正确。');
    if ((item.kind === 'major' && item.value.length > 100) || (item.kind === 'interest' && item.value.length > 80) || (item.kind === 'experience' && !item.state)) throw campusError(422, 'CANDIDATE_INVALID', '专业、兴趣或经历状态超出保存范围。');
    return item;
  });
}
function comparison(record, fields) {
  return Object.fromEntries(fields.map((key) => [key, record?.[key] === undefined ? { $exists: false } : record[key]]));
}
function buildPlans(session, body, current, candidates) {
  const desired = {};
  const expected = profileTargets(current.profile);
  for (const item of candidates.filter((candidate) => ['collegeStudent', 'major'].includes(candidate.kind))) {
    const kind = item.kind;
    if (body.resolutions[kind] === 'keep') continue;
    if (body.expected[kind] !== expected[kind] || (expected[kind] !== null && expected[kind] !== '' && expected[kind] !== item.value && body.resolutions[kind] !== 'replace')) throw campusError(409, 'PROFILE_CONFLICT', '已有资料与这次确认不同，请重新查看并选择保留或替换；没有覆盖。');
    if (kind === 'collegeStudent') { desired.collegeStudent = item.value; desired.collegeStudentKnown = true; }
    else {
      desired.education = (current.profile?.education || []).map((entry) => ({ ...entry }));
      const index = Math.max(0, desired.education.findIndex((entry) => entry.current));
      if (desired.education.length) desired.education[index].field = item.value;
      else desired.education.push({ _id: stableImportId(String(session._id), 'education'), id: stableImportId(String(session._id), 'education'), field: item.value });
    }
  }
  const privateFields = ['collegeStudent', 'collegeStudentKnown', 'education'].filter((key) => Object.hasOwn(desired, key));
  if (privateFields.length) desired.discoveryPrivateFields = [...new Set([...privateProfileFields(current.profile), ...privateFields])];
  const studentAfter = {};
  const interests = candidates.filter((item) => item.kind === 'interest');
  if (interests.length) studentAfter.interests = [...new Set([...(current.student?.interests || []), ...interests.map((item) => item.value)])];
  const experiences = candidates.filter((item) => item.kind === 'experience');
  if (experiences.length) studentAfter.experiences = [...(current.student?.experiences || []), ...experiences.filter((item) => !current.student?.experiences?.some((old) => old.id === item.id)).map((item) => ({
    id: item.id, kind: 'other', title: item.value.slice(0, 150), fullText: item.value, state: item.state,
    context: '', actions: '', result: '', sourceConversationId: String(session._id), sourceQuestionId: item.source.questionId,
  }))];
  if (studentAfter.interests?.length > 20 || studentAfter.experiences?.length > 30 || desired.education?.length > 20) throw campusError(422, 'PROFILE_CAPACITY', '资料数量超过编辑容量，请减少本次新增内容，不会截断已有资料。');
  return [['profile', UserProfile, desired], ['student', CampusStudent, studentAfter]].map(([kind, model, after]) => {
    const record = current[kind];
    const id = String(record?._id || stableImportId(String(session._id), kind));
    const cast = new model({ _id: id, uid: session.userId, ...after }).toObject();
    const fields = Object.fromEntries(Object.keys(after).map((key) => [key, cast[key]]));
    const considered = candidates.some((item) => kind === 'profile' ? ['collegeStudent', 'major'].includes(item.kind) : ['interest', 'experience'].includes(item.kind));
    return { kind, id, after: fields, before: comparison(record, Object.keys(fields)), exists: Boolean(record), considered };
  });
}

async function applyPlan(plan, uid, receipt) {
  const model = plan.kind === 'profile' ? UserProfile : CampusStudent;
  let current = await model.findOne({ uid }).lean();
  if (current?.confirmationReceipts?.includes(receipt)) return;
  if (!plan.considered) return;
  if (current) {
    if (!plan.exists || String(current._id) !== plan.id) throw campusError(409, 'PROFILE_CONFLICT', '资料已在其他页面建立，请重新核对。');
    // Mongoose query-casts document-array equality, adding defaults/_id to
    // legacy BSON. Validate the new values, but keep the persisted baseline
    // byte-for-byte for the atomic comparison (including absent fields).
    await new model({ _id: current._id, uid, ...plan.after }).validate();
    const result = await model.collection.updateOne({ _id: current._id, uid, ...plan.before, confirmationReceipts: { $ne: receipt } }, { $set: { ...plan.after, updatedAt: new Date(Math.max(Date.now(), new Date(current.updatedAt || 0).getTime() + 1)) }, $addToSet: { confirmationReceipts: receipt } });
    if (!result.matchedCount) throw campusError(409, 'PROFILE_CONFLICT', '资料刚被其他页面修改，请核对后继续，不会覆盖。');
  } else {
    if (plan.exists) throw campusError(409, 'PROFILE_CONFLICT', '资料已被删除，不会重新建立。');
    try { await model.create({ _id: plan.id, uid, ...plan.after, confirmationReceipts: [receipt] }); }
    catch (error) { if (error.code !== 11000) throw error; }
  }
  current = await model.findOne({ uid }).lean();
  if (!current?.confirmationReceipts?.includes(receipt)) throw campusError(409, 'PROFILE_CONFLICT', '资料已经变化，请核对后继续。');
}

const activeConfirmations = new Set();
export function confirmDiscovery(session, body) {
  return withAccountWrite(session.userId, async () => {
    const key = String(session._id);
    if (activeConfirmations.has(key)) throw campusError(409, 'CONFIRMATION_PENDING', '这次确认仍在保存，请等待当前写入结束。');
    activeConfirmations.add(key);
    try { return await persistConfirmation(session, body); } finally { activeConfirmations.delete(key); }
  });
}
async function persistConfirmation(session, body) {
  assertDiscovery(session);
  const receipt = String(session._id);
  let ledger = await CampusDiscoveryConfirmation.findOne({ interviewId: session._id, userId: session.userId }).lean();
  if (ledger?.status === 'completed') {
    await Interview.updateOne({ _id: session._id, userId: session.userId }, { $set: { confirmationPending: false } });
    return confirmationView(session);
  }
  if (!ledger) {
    const candidates = reviewed(session, body);
    const plans = buildPlans(session, body, await targets(session.userId), candidates);
    const protectedSession = await Interview.updateOne({ _id: session._id, userId: session.userId, status: 'completed' }, { $set: { confirmationPending: true } });
    if (!protectedSession.matchedCount) throw campusError(404, 'INTERVIEW_NOT_FOUND', '这次交流已删除，不能再保存资料。');
    try { ledger = (await CampusDiscoveryConfirmation.create({ interviewId: session._id, userId: session.userId, frozen: { ...body, plans }, status: 'pending' })).toObject(); }
    catch (error) {
      if (error.code !== 11000) throw error;
      ledger = await CampusDiscoveryConfirmation.findOne({ interviewId: session._id, userId: session.userId }).lean();
    }
  }
  if (!matchesFields(body, { candidates: ledger.frozen.candidates })) throw campusError(409, 'CONFIRMATION_FROZEN', '已开始保存的摘要不能更换，请继续完成保存后到个人资料编辑。');
  const token = randomUUID();
  ledger = await CampusDiscoveryConfirmation.findOneAndUpdate({ _id: ledger._id, status: { $ne: 'completed' }, $or: [{ leaseUntil: null }, { leaseUntil: { $lte: new Date() } }] }, { $set: { leaseToken: token, leaseUntil: new Date(Date.now() + 300000), status: 'saving' } }, { new: true }).lean();
  if (!ledger) throw campusError(409, 'CONFIRMATION_PENDING', '资料正在保存，请稍后恢复进度。');
  const guard = { _id: ledger._id, leaseToken: token };
  const checkpoint = async (set) => {
    const written = await CampusDiscoveryConfirmation.updateOne(guard, { $set: set });
    if (!written.matchedCount) throw campusError(409, 'CONFIRMATION_PENDING', '另一次恢复已接管保存，请刷新进度。');
  };
  try {
    const current = await targets(session.userId);
    ledger.steps ||= {};
    // Receipt is written atomically with target values. Even after a crash or
    // later user editing, a completed target must never be replayed.
    for (const kind of ['profile', 'student']) if (current[kind]?.confirmationReceipts?.includes(receipt)) ledger.steps[kind] = true;
    const candidates = reviewed(session, { ...ledger.frozen, candidates: ledger.frozen.candidates });
    const remainingCandidates = ledger.steps.profile ? candidates.filter((item) => !['collegeStudent', 'major'].includes(item.kind)) : candidates;
    const plans = buildPlans(session, body, current, remainingCandidates);
    await checkpoint({ 'frozen.expected': body.expected, 'frozen.resolutions': body.resolutions, 'frozen.plans': plans, steps: ledger.steps });
    for (const plan of plans) {
      if (ledger.steps[plan.kind] || !plan.considered) continue;
      await checkpoint({ leaseUntil: new Date(Date.now() + 300000) });
      await applyPlan(plan, session.userId, receipt);
      ledger.steps[plan.kind] = true;
      await checkpoint({ [`steps.${plan.kind}`]: true, leaseUntil: new Date(Date.now() + 300000) });
    }
    await checkpoint({ status: 'completed', leaseUntil: null, cachePending: true, errorCode: null });
    ledger.status = 'completed';
    await Interview.updateOne({ _id: session._id, userId: session.userId }, { $set: { confirmationPending: false } });
    try {
      await invalidateProfileCache(session.userId);
      await CampusDiscoveryConfirmation.updateOne(guard, { $set: { cachePending: false } });
    } catch { /* Persistence succeeded; cache refresh is not an unsaved result. */ }
    return confirmationView(session);
  } catch (error) {
    if (ledger.status === 'completed') throw error;
    const actual = await targets(session.userId);
    const partial = Object.values(actual).some((record) => record?.confirmationReceipts?.includes(receipt));
    if (!partial && ['PROFILE_CONFLICT', 'PROFILE_CAPACITY', 'CANDIDATE_INVALID'].includes(error.code)) {
      await CampusDiscoveryConfirmation.deleteOne(guard);
      await Interview.updateOne({ _id: session._id, userId: session.userId }, { $set: { confirmationPending: false } });
    }
    else await CampusDiscoveryConfirmation.updateOne(guard, { $set: { status: 'partial', leaseUntil: null, errorCode: error.code || 'CONFIRMATION_UNKNOWN' } });
    throw error;
  }
}
