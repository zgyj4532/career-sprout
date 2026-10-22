import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import ResumeShare from '../models/ResumeShare.model.js';
import ResumeComment from '../models/ResumeComment.model.js';
import Resume from '../models/Resume.model.js';
import { verifyToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { campusError } from '../campus/errors.js';
import { withResumeAssociation } from '../campus/resumeDelete.js';

const router = express.Router();
for (const name of ['resumeId', 'commentId']) router.param(name, (req, res, next, value) => {
  if (!/^[a-fA-F0-9]{24}$/.test(value)) return next(campusError(400, 'INVALID_ID', '编号格式不正确。'));
  next();
});
const shareSchema = z.object({ expiresInDays: z.number().int().min(1).max(365).nullable().optional() });
const commentSchema = z.object({ section: z.string().min(1).max(100).default('summary'), text: z.string().trim().min(1).max(5000), authorEmail: z.string().email().max(254), authorName: z.string().trim().min(1).max(100) });
async function activeShare(token) {
  if (!/^[a-f0-9]{48}$/.test(token)) throw campusError(404, 'SHARE_NOT_FOUND', '分享链接不存在或已失效。');
  const share = await ResumeShare.findOne({ shareToken: token, isActive: true });
  if (!share || (share.expiresAt && share.expiresAt <= new Date())) throw campusError(404, 'SHARE_NOT_FOUND', '分享链接不存在或已失效。');
  return share;
}
async function ownedResume(id, uid) {
  const resume = await Resume.findOne({ _id: id, userId: uid, deleting: { $ne: true } });
  if (!resume) throw campusError(404, 'RESUME_NOT_FOUND', '简历不存在或不可访问。');
  return resume;
}
router.post('/resumes/:resumeId/share', verifyToken, validate(shareSchema), asyncHandler(async (req, res) => {
  const share = await withResumeAssociation(req.params.resumeId, req.user.uid, 'share', () => ResumeShare.findOneAndUpdate(
    { resumeId: req.params.resumeId, ownerId: req.user.uid },
    { shareToken: crypto.randomBytes(24).toString('hex'), isActive: true, expiresAt: req.body.expiresInDays ? new Date(Date.now() + req.body.expiresInDays * 86400000) : null },
    { upsert: true, new: true }));
  res.json({ shareToken: share.shareToken, expiresAt: share.expiresAt });
}));
router.get('/shared/:shareToken', asyncHandler(async (req, res) => {
  const share = await activeShare(req.params.shareToken);
  const resume = await ownedResume(share.resumeId, share.ownerId);
  // A public link exposes resume content, never internal owner/import metadata.
  res.json({ resume: { _id: resume._id, title: resume.title, originalText: resume.originalText, enhancedText: resume.enhancedText, sectionOrder: resume.sectionOrder, customSections: resume.customSections }, role: 'commenter' });
}));
router.post('/shared/:shareToken/comments', validate(commentSchema), asyncHandler(async (req, res) => {
  const share = await activeShare(req.params.shareToken);
  const comment = await withResumeAssociation(share.resumeId, share.ownerId, 'comment', async () => {
    await activeShare(req.params.shareToken);
    return ResumeComment.create({ resumeId: share.resumeId, shareToken: req.params.shareToken, ...req.body });
  });
  res.status(201).json(comment);
}));
router.get('/shared/:shareToken/comments', asyncHandler(async (req, res) => {
  const share = await activeShare(req.params.shareToken);
  await ownedResume(share.resumeId, share.ownerId);
  res.json(await ResumeComment.find({ shareToken: req.params.shareToken }).sort({ createdAt: -1 }));
}));
router.get('/resumes/:resumeId/comments', verifyToken, asyncHandler(async (req, res) => {
  await ownedResume(req.params.resumeId, req.user.uid);
  res.json(await ResumeComment.find({ resumeId: req.params.resumeId }).sort({ createdAt: -1 }));
}));
router.patch('/comments/:commentId/resolve', verifyToken, validate(z.object({ resolved: z.boolean() })), asyncHandler(async (req, res) => {
  const existing = await ResumeComment.findById(req.params.commentId);
  if (!existing) throw campusError(404, 'COMMENT_NOT_FOUND', '评论不存在或不可访问。');
  const comment = await withResumeAssociation(existing.resumeId, req.user.uid, 'comment', () => ResumeComment.findOneAndUpdate(
    { _id: existing._id, resumeId: existing.resumeId },
    { resolved: req.body.resolved, resolvedBy: req.body.resolved ? req.user.email : null, resolvedAt: req.body.resolved ? new Date() : null }, { new: true }));
  res.json(comment);
}));
router.delete('/resumes/:resumeId/share', verifyToken, asyncHandler(async (req, res) => {
  await withResumeAssociation(req.params.resumeId, req.user.uid, 'share', () => ResumeShare.updateOne({ resumeId: req.params.resumeId, ownerId: req.user.uid }, { isActive: false }));
  res.json({ message: 'Share link revoked' });
}));
export default router;
