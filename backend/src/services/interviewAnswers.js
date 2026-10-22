import Interview from '../models/Interview.model.js';
import { campusError } from '../campus/errors.js';
import { withAccountWrite } from '../campus/accountWrites.js';

export async function cancelExpiredGeneration(id, userId) {
  return Interview.updateOne({ _id: id, userId, 'generation.status': 'pending', 'generation.leaseUntil': { $lte: new Date() } }, {
    $set: { 'generation.status': 'failed', 'generation.errorCode': 'GENERATION_EXPIRED', 'generation.leaseUntil': null },
    $unset: { 'generation.token': '' },
  });
}

export function persistInterviewAnswer(options) {
  return withAccountWrite(options.userId, () => saveAnswer(options));
}
async function saveAnswer({ id, userId, questionId, answerCount, update }) {
  await cancelExpiredGeneration(id, userId);
  const saved = await Interview.findOneAndUpdate(
    { _id: id, userId, status: 'in_progress', 'generation.status': { $ne: 'pending' }, 'answers.questionId': { $ne: questionId }, answers: { $size: answerCount } },
    update, { new: true, runValidators: true });
  if (!saved) throw campusError(409, 'ANSWER_ALREADY_SUBMITTED', '回答或面试状态已更新，请刷新后继续。');
  return saved;
}
