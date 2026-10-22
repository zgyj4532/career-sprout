import { randomUUID } from 'node:crypto';
import Interview from '../models/Interview.model.js';
import { campusError } from '../campus/errors.js';
import { generateDiscoveryQuestion, generateDiscoverySummary } from './discoveryService.js';
import { generateOverallFeedback } from './interviewService.js';
import { withAccountWrite } from '../campus/accountWrites.js';
import { cancelExpiredGeneration } from './interviewAnswers.js';

const LEASE_MS = 300000;
export async function ownedInterview(id, userId) {
  const session = await Interview.findOne({ _id: id, userId }).lean();
  if (!session) throw campusError(404, 'INTERVIEW_NOT_FOUND', '找不到这次交流或练习。');
  return session;
}

async function generateOnce(session, kind, generate, apply) {
  const token = randomUUID();
  const filter = { _id: session._id, userId: session.userId, status: 'in_progress', updatedAt: session.updatedAt, answers: { $size: session.answers.length }, questions: { $size: session.questions.length } };
  const admitted = await Interview.findOneAndUpdate({ ...filter, $or: [
    { 'generation.status': { $ne: 'pending' } }, { 'generation.leaseUntil': { $lte: new Date() } },
  ] }, { $set: { generation: { kind, status: 'pending', token, leaseUntil: new Date(Date.now() + LEASE_MS), answerCount: session.answers.length } } }, { new: true }).lean();
  if (!admitted) throw campusError(409, 'GENERATION_PENDING', '内容正在生成或进度已更新，请先恢复进度。');
  const guard = { _id: session._id, userId: session.userId, status: 'in_progress', answers: { $size: session.answers.length }, questions: { $size: session.questions.length }, 'generation.token': token, 'generation.status': 'pending' };
  const heartbeat = setInterval(() => {
    Interview.updateOne(guard, { $set: { 'generation.leaseUntil': new Date(Date.now() + LEASE_MS) } }).catch(() => {});
  }, 30000);
  heartbeat.unref?.();
  try {
    const result = await generate(admitted);
    const update = apply(result);
    update.$set = { ...update.$set, generation: { kind, status: 'idle', answerCount: session.answers.length } };
    const saved = await Interview.findOneAndUpdate(guard, update, { new: true, runValidators: true }).lean();
    if (!saved) throw campusError(409, 'INTERVIEW_CHANGED', '进度已经更新，请恢复进度查看已保存结果。');
    return saved;
  } catch (error) {
    await Interview.updateOne(guard, { $set: { 'generation.status': 'failed', 'generation.errorCode': 'GENERATION_FAILED', 'generation.leaseUntil': null } });
    throw error;
  } finally { clearInterval(heartbeat); }
}

export function continueDiscovery(id, userId, provider) {
  return withAccountWrite(userId, () => continueSession(id, userId, provider));
}
async function continueSession(id, userId, provider) {
  await cancelExpiredGeneration(id, userId);
  const session = await ownedInterview(id, userId);
  if (session.purpose !== 'discovery') throw campusError(400, 'DISCOVERY_REQUIRED', '只有首次交流使用这个继续入口。');
  if (session.status === 'completed') return session;
  if (session.status !== 'in_progress') throw campusError(409, 'INTERVIEW_CLOSED', '这次交流已结束。');
  if (session.questions.some((question) => !session.answers.some((answer) => answer.questionId === question.questionId)) || session.answers.length >= session.totalQuestionCount) return session;
  return generateOnce(session, 'next', (current) => generateDiscoveryQuestion(current, provider), (question) => ({ $push: { questions: question } }));
}

export function completeInterview(id, userId, provider) {
  return withAccountWrite(userId, () => completeSession(id, userId, provider));
}
async function completeSession(id, userId, provider) {
  const session = await ownedInterview(id, userId);
  if (session.status === 'completed') return session;
  if (session.status !== 'in_progress') throw campusError(409, 'INTERVIEW_CLOSED', '这次交流或练习已结束。');
  if (session.purpose !== 'discovery' && !session.answers.length) throw campusError(400, 'NO_ANSWERS', '请至少保存一道回答后再生成反馈。');
  return generateOnce(session, 'complete', async (current) => current.purpose === 'discovery'
    ? { discovery: await generateDiscoverySummary(current, provider), overallScore: null, scoring: null }
    : generateOverallFeedback(current, provider), (result) => ({ $set: {
    ...result, status: 'completed', completedAt: new Date(), duration: Math.max(0, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000)),
  } }));
}
