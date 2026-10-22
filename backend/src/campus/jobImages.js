import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, stat } from 'node:fs/promises';
import { asyncHandler } from '../middleware/errorHandler.js';
import { campusError } from './errors.js';
import { CampusImportDraft, CampusImportQuota, CampusJob } from './models.js';
import { createQuotaBook } from './importQuota.js';
import { parseInChild, readImportImage } from './importParse.js';
import { importModelQuota } from './importModelQuota.js';
import { runJobImageModels } from './importJobAi.js';
import { IMPORT_ROOT, accountImport } from './importStorage.js';

const MAX_BYTES = 10 * 1024 * 1024;
const RESULT_ALLOWANCE = 1024 * 1024;
const root = path.join(IMPORT_ROOT, 'jobs');
const kinds = new Map([['image/png', 'png'], ['image/jpeg', 'jpeg'], ['image/webp', 'webp']]);
const quota = createQuotaBook(CampusImportQuota);
const router = express.Router();
const idPattern = /^[a-f\d]{24}$/i;

function publicDraft(draft) {
  const files = draft.files || [];
  const terminal = ['IMPORT_RESULT_UNKNOWN', 'IMPORT_VALIDATION', 'FILE_LIMIT', 'PIXEL_LIMIT', 'FRAME_LIMIT', 'IMAGE_HEADER', 'IMPORT_TYPE'].includes(draft.errorCode) || draft.modelState?.calls?.some(call => ['started', 'failed'].includes(call.status));
  return {
    id: String(draft._id), status: draft.status, phase: draft.phase,
    kept: files.length > 0, busy: draft.status === 'busy' || (draft.status === 'processing' && draft.leaseUntil > new Date()),
    failed: draft.status === 'failed', canContinue: files.length > 0 && !terminal && (['busy', 'failed', 'received'].includes(draft.status) || (draft.status === 'processing' && draft.leaseUntil <= new Date())),
    code: draft.errorCode || null, candidates: draft.result?.candidates || [],
    blocks: draft.blocks || [], issues: draft.result?.issues || draft.issues || [],
    sourcePages: files.map((file, index) => ({ id: file.id, page: index + 1, index, mime: file.mime })),
    files: files.map((file, index) => ({ id: file.id, index, mime: file.mime })),
  };
}

async function owned(id, uid) {
  if (!idPattern.test(id)) throw campusError(404, 'IMPORT_NOT_FOUND', '没有找到这组岗位截图。');
  const draft = await CampusImportDraft.findOne({ _id: id, userId: uid, purpose: 'job' });
  if (!draft) throw campusError(404, 'IMPORT_NOT_FOUND', '没有找到这组岗位截图。');
  return draft;
}

async function removeFiles(draft) {
  for (const file of draft.files || []) await rm(file.filePath, { force: true });
  await rm(path.join(root, String(draft._id)), { recursive: true, force: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, done) => done(null, req.jobImageDirectory),
    filename: (_req, _file, done) => done(null, randomUUID()),
  }),
  limits: { files: 5, fileSize: MAX_BYTES, fields: 0, parts: 6 },
  fileFilter: (_req, file, done) => done(kinds.has(file.mimetype) ? null : campusError(415, 'IMPORT_TYPE', '岗位截图只接受 PNG、JPEG 或 WEBP。'), kinds.has(file.mimetype)),
}).array('images', 5);

async function receive(req, res, draft) {
  let renewal = Promise.resolve();
  let failure;
  const timer = setInterval(() => {
    renewal = renewal.then(async () => {
      const updated = await CampusImportDraft.updateOne({ _id: draft._id, leaseToken: draft.leaseToken, status: 'received' }, { $set: { leaseUntil: new Date(Date.now() + 300000) } });
      if (!updated.matchedCount) throw campusError(409, 'IMPORT_LEASE_EXPIRED', '上传已停止，请重新查看截图记录。');
    }).catch(error => { failure = error; req.destroy(error); });
  }, 30000);
  timer.unref();
  try {
    await new Promise((resolve, reject) => upload(req, res, error => error ? reject(error) : resolve()));
    await renewal;
    if (failure) throw failure;
  } finally { clearInterval(timer); await renewal; }
}

async function processDraft(draft) {
  const now = new Date();
  const token = randomUUID();
  const locked = await CampusImportDraft.findOneAndUpdate({
    _id: draft._id, userId: draft.userId, purpose: 'job', status: { $nin: ['deleting', 'ready', 'saved'] },
    $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }],
  }, { $set: { leaseUntil: new Date(Date.now() + 300000), leaseToken: token, status: 'processing', phase: '正在识别岗位截图' } }, { new: true });
  if (!locked) throw campusError(409, 'IMPORT_PROCESSING', '这组截图仍在处理，原图已保留。请稍后查看。');
  try {
    await accountImport(locked, null, { processing: true });
    const images = [];
    for (const file of locked.files) {
      const parsed = await parseInChild(file.filePath, { mode: file.kind });
      if (parsed.busy) {
        locked.status = 'busy'; locked.phase = '截图已收好';
        return locked;
      }
      if (!parsed.ok) throw campusError(422, parsed.code || 'IMPORT_IMAGE_INVALID', '截图无法读取，请查看原图或更换这张图片。');
      const imageDataUrl = await readImportImage(file.filePath, file.kind);
      images.push({ id: file.id, imageDataUrl });
    }
    const result = await runJobImageModels({
      images, quota: importModelQuota, userId: locked.userId, operationId: String(locked._id), state: locked.modelState || {},
      onCheckpoint: async state => {
        locked.modelState = state;
        await accountImport(locked, null, { processing: true });
        const updated = await CampusImportDraft.updateOne({ _id: locked._id, leaseToken: token }, { $set: { modelState: state, reservedBytes: locked.reservedBytes, leaseUntil: new Date(Date.now() + 300000) } });
        if (!updated.matchedCount) throw campusError(409, 'IMPORT_LEASE_EXPIRED', '处理权已转移，请重新打开这组截图。');
      },
    });
    locked.result = { candidates: result.candidates, issues: result.issues, sourcePages: result.sourcePages };
    locked.blocks = result.blocks;
    locked.modelState = result.state;
    locked.status = 'ready'; locked.phase = '岗位已整理，请确认'; locked.errorCode = null;
    return locked;
  } catch (error) {
    locked.status = 'failed'; locked.phase = '截图已收好';
    locked.errorCode = typeof error.code === 'string' && /^[A-Z_\d]{1,60}$/.test(error.code) ? error.code : 'JOB_IMAGE_FAILED';
    return locked;
  } finally {
    await accountImport(locked);
    locked.leaseUntil = null; locked.leaseToken = null;
    await locked.save();
  }
}

router.get('/jobs/images', asyncHandler(async (req, res) => {
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  const filter = { userId: req.user.uid, purpose: 'job' };
  const [drafts, total] = await Promise.all([CampusImportDraft.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * 20).limit(20), CampusImportDraft.countDocuments(filter)]);
  res.json({ success: true, data: { items: drafts.map(publicDraft), total, page, limit: 20 } });
}));

router.post('/jobs/images', asyncHandler(async (req, res) => {
  const length = Number(req.headers['content-length']);
  if (!Number.isSafeInteger(length) || length < 1) throw campusError(411, 'IMPORT_LENGTH', '请重新选择截图后上传。');
  if (length > MAX_BYTES + 65536) throw campusError(413, 'IMPORT_TOO_LARGE', '一组截图最多 5 张，合计不能超过 10MB。');
  const id = new mongoose.Types.ObjectId();
  const draft = new CampusImportDraft({ _id: id, userId: req.user.uid, purpose: 'job', status: 'received', phase: '正在接收截图', files: [], reservedBytes: MAX_BYTES + RESULT_ALLOWANCE, leaseToken: randomUUID(), leaseUntil: new Date(Date.now() + 300000) });
  req.jobImageDirectory = path.join(root, String(id));
  try {
    await draft.save();
    const reserved = await quota.reserve({ uid: req.user.uid, bytes: MAX_BYTES + RESULT_ALLOWANCE, draftId: String(id) });
    if (!reserved.ok) throw campusError(409, reserved.code, '暂存空间不足，请丢弃自己的旧导入或稍后再试。');
    await mkdir(req.jobImageDirectory, { recursive: true, mode: 0o700 });
    await receive(req, res, draft);
    if (!req.files?.length) throw campusError(400, 'IMPORT_EMPTY', '请选择至少一张岗位截图。');
    draft.files = req.files.map((file, index) => ({ id: `image-${index + 1}`, filePath: file.path, mime: file.mimetype, kind: kinds.get(file.mimetype), bytes: file.size }));
    draft.bytes = draft.files.reduce((sum, file) => sum + file.bytes, 0);
    if (draft.bytes > MAX_BYTES) throw campusError(413, 'IMPORT_TOO_LARGE', '这组截图合计超过 10MB，请减少图片或压缩后再试。');
    draft.phase = '截图已收好'; draft.uploadComplete = true; draft.leaseUntil = null;
    await draft.save();
  } catch (error) {
    await removeFiles(draft);
    await quota.release(String(id));
    await CampusImportDraft.deleteOne({ _id: id, userId: req.user.uid });
    if (error instanceof multer.MulterError) throw campusError(413, 'IMPORT_TOO_LARGE', '一组截图最多 5 张，合计不能超过 10MB。');
    throw error;
  }
  const processed = await processDraft(draft);
  res.status(processed.status === 'ready' ? 201 : 202).json({ success: true, data: publicDraft(processed) });
}));

router.get('/jobs/images/:id', asyncHandler(async (req, res) => {
  res.json({ success: true, data: publicDraft(await owned(req.params.id, req.user.uid)) });
}));

router.get('/jobs/images/:id/source/:index', asyncHandler(async (req, res) => {
  const draft = await owned(req.params.id, req.user.uid);
  if (!/^\d$/.test(req.params.index)) throw campusError(404, 'IMPORT_FILE_MISSING', '没有找到这张原图。');
  const file = draft.files[Number(req.params.index)];
  if (!file) throw campusError(404, 'IMPORT_FILE_MISSING', '没有找到这张原图。');
  try { await stat(file.filePath); } catch { throw campusError(404, 'IMPORT_FILE_MISSING', '这张原图已不可用，请更换图片。'); }
  res.set({ 'Content-Type': file.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  await new Promise((resolve, reject) => res.sendFile(file.filePath, error => error ? reject(error) : resolve()));
}));

router.post('/jobs/images/:id/continue', asyncHandler(async (req, res) => {
  const draft = await owned(req.params.id, req.user.uid);
  const order = req.body?.order;
  if (draft.leaseUntil && draft.leaseUntil > new Date()) throw campusError(409, 'IMPORT_PROCESSING', '这组截图仍在处理，原图已保留。');
  if (!draft.files.length) throw campusError(409, 'IMPORT_UPLOAD_INTERRUPTED', '上次上传没有完成，请丢弃这组记录后重新选择图片。');
  if (order !== undefined) {
    if (!Array.isArray(order) || !order.length || order.length > draft.files.length || new Set(order).size !== order.length || order.some(id => !draft.files.some(file => file.id === id))) {
      throw campusError(400, 'IMPORT_ORDER', '截图顺序无效，请重新打开这组截图。');
    }
    if (order.join(',') !== draft.files.map(file => file.id).join(',')) {
      throw campusError(409, 'IMPORT_INPUT_CHANGED', '服务器已收好这组截图，继续读取使用原来的顺序。请在上传前调整或删除图片。');
    }
  }
  if (['ready', 'saved'].includes(draft.status)) return res.json({ success: true, data: publicDraft(draft) });
  const processed = await processDraft(draft);
  res.status(processed.status === 'ready' ? 200 : 202).json({ success: true, data: publicDraft(processed) });
}));

router.post('/jobs/images/:id/saved', asyncHandler(async (req, res) => {
  const draft = await owned(req.params.id, req.user.uid);
  if (!idPattern.test(String(req.body?.jobId || '')) || !await CampusJob.exists({ _id: req.body.jobId, creatorUid: req.user.uid })) {
    throw campusError(404, 'JOB_NOT_FOUND', '岗位尚未保存，原图仍保留。');
  }
  if (draft.status !== 'ready' && draft.status !== 'saved') throw campusError(409, 'IMPORT_NOT_READY', '截图尚未整理完成。');
  const updated = await CampusImportDraft.findOneAndUpdate({ _id: draft._id, userId: req.user.uid, status: { $in: ['ready', 'saved'] } }, { $set: { status: 'saved' } }, { new: true });
  if (!updated) throw campusError(409, 'IMPORT_NOT_READY', '截图状态已更新，请重新查看。');
  await quota.complete(String(draft._id));
  res.json({ success: true, data: publicDraft(updated) });
}));

router.delete('/jobs/images/:id', asyncHandler(async (req, res) => {
  await owned(req.params.id, req.user.uid);
  const draft = await CampusImportDraft.findOneAndUpdate({
    _id: req.params.id, userId: req.user.uid, purpose: 'job',
    $or: [{ leaseUntil: null }, { leaseUntil: { $lte: new Date() } }],
  }, { $set: { status: 'deleting' } }, { new: true });
  if (!draft) throw campusError(409, 'IMPORT_PROCESSING', '截图正在识别，结束后可以丢弃。');
  await removeFiles(draft);
  await CampusImportDraft.updateOne({ _id: draft._id, userId: req.user.uid, status: 'deleting' }, { $set: { files: [], blocks: [], result: null, modelState: {}, bytes: 0 } });
  await quota.release(String(draft._id));
  await CampusImportDraft.deleteOne({ _id: draft._id, userId: req.user.uid, status: 'deleting' });
  res.json({ success: true });
}));

export default router;
