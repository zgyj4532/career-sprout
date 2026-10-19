import Interview from '../models/Interview.model.js';
import { campusError } from '../campus/errors.js';

export async function persistInterviewAnswer({ id, userId, questionId, answerCount, update }) {
  const saved = await Interview.findOneAndUpdate(
    { _id: id, userId, status: 'in_progress', 'answers.questionId': { $ne: questionId }, answers: { $size: answerCount } },
    update, { new: true, runValidators: true });
  if (!saved) throw campusError(409, 'ANSWER_ALREADY_SUBMITTED', '回答或面试状态已更新，请刷新后继续。');
  return saved;
}
