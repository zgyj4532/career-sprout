import express from 'express'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import mongoose from 'mongoose'
import { asyncHandler } from '../middleware/errorHandler.js'
import { parseInChild, readImportImage } from './importParse.js'
import { runImportModels } from './importAi.js'
import { campusError } from './errors.js'
import { LIMITS } from './importLimits.js'
import { importModelQuota } from './importModelQuota.js'
import { IMPORT_ROOT, IMPORT_WORK_BYTES, accountImport, importQuotaBook, removeImportFiles } from './importStorage.js'
import { confirmImport, previewConfirmation, restoreImport, retryImportCache } from './importConfirm.js'
import { stableImportId } from './confirmLedger.js'
import { CampusConfirmLedger, CampusImportDraft } from './models.js'

const TYPES = new Map([
  ['application/pdf', 'pdf'], ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['image/png', 'png'], ['image/jpeg', 'jpeg'], ['image/webp', 'webp'],
])
const LEASE_MS = 300000
const router = express.Router()
const ownFilter = (id, uid) => ({ _id: id, userId: uid, purpose: { $ne: 'job' } })

async function ownedDraft(id, uid) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw campusError(404, 'IMPORT_NOT_FOUND', '没有找到这份导入。')
  const draft = await CampusImportDraft.findOne(ownFilter(id, uid))
  if (!draft) throw campusError(404, 'IMPORT_NOT_FOUND', '没有找到这份导入。')
  return draft
}

function issueIds(issues, draftId) {
  return issues.map((issue, index) => ({ ...issue, id: stableImportId(draftId, `issue:${issue.code}:${issue.blockId || issue.sourceBlockId || ''}:${issue.field || ''}:${index}`) }))
}

async function hasOriginal(draft) {
  if (!draft.filePath) return false
  try { return (await fs.stat(draft.filePath)).isFile() } catch (error) { if (error.code === 'ENOENT') return false; throw error }
}

async function draftView(draft, { detail = true, ledger: suppliedLedger } = {}) {
  const ledger = suppliedLedger || await CampusConfirmLedger.findOne({ draftId: draft._id, userId: draft.userId }).lean()
  const conflicted = ledger?.status === 'conflicted'
  const now = Date.now()
  const active = draft.leaseUntil && new Date(draft.leaseUntil).getTime() > now
  const saving = ledger && ['pending', 'saving', 'unknown'].includes(ledger.status)
  const saveActive = saving && new Date(ledger.leaseUntil).getTime() > now
  const status = ['saved', 'restored', 'restoring'].includes(ledger?.status) ? ledger.status : saving ? saveActive ? 'saving' : 'save_unknown' : draft.status
  const result = ledger?.frozen?.material || draft.result
  const kept = await hasOriginal(draft)
  const terminal = ['IMPORT_RESULT_UNKNOWN', 'IMPORT_VALIDATION', 'MODEL_BUDGET_EXCEEDED', 'NO_TEXT_LAYER', 'FILE_LIMIT', 'TEXT_TOO_LONG', 'UNZIP_LIMIT', 'PAGE_LIMIT', 'PIXEL_LIMIT', 'FRAME_LIMIT', 'IMAGE_HEADER', 'DOCX_INVALID', 'IMPORT_TYPE'].includes(draft.errorCode)
  const canContinue = !active && (saving || (!['ready', 'review', 'saved', 'restored', 'restoring', 'discarding'].includes(status) && kept && !terminal))
  const view = {
    id: String(draft._id), status, phase: status === 'save_unknown' ? '保存结果未知' : status === 'restoring' ? '恢复结果未知，可以继续恢复' : draft.phase,
    kept, canContinue: Boolean(canContinue), busy: Boolean(active || status === 'busy' || saveActive),
    failed: ['failed', 'save_unknown'].includes(status), code: ledger?.errorCode || draft.errorCode || null,
    filename: draft.filename || '', mime: draft.mime, createdAt: draft.createdAt,
    summary: result?.summary || '', experiences: result?.experiences?.length || 0, skills: result?.skills?.length || 0,
    decisions: (draft.issues || []).length, resumeId: ledger?.frozen?.resumeId || (draft.resumeId ? String(draft.resumeId) : null),
    resumeTitle: ledger?.frozen?.resumeTitle || '', saved: ['saved', 'restoring'].includes(status), cachePending: Boolean(ledger?.cachePending),
    canRestore: ['saved', 'restoring'].includes(ledger?.status), frozen: Boolean(ledger && !conflicted),
  }
  if (detail) {
    const destination = ledger && !conflicted ? { candidates: ledger.frozen.candidates || [], resumeChoices: [] } : await previewConfirmation(draft)
    Object.assign(view, destination, { result, blocks: draft.blocks || [], issues: draft.issues || [] })
    view.decisions += destination.candidates.length
    if (ledger && !conflicted) {
      view.resumeId = ledger.frozen.resumeId
      view.resumeTitle = ledger.frozen.resumeTitle
      view.changes = ledger.frozen.plans.map((plan) => ({ kind: plan.kind, changed: plan.changed, created: !plan.before }))
    }
  }
  return view
}

async function claimDraft(draft) {
  const token = randomUUID()
  const claimed = await CampusImportDraft.findOneAndUpdate({ ...ownFilter(draft._id, draft.userId), $or: [{ leaseUntil: { $lte: new Date() } }, { leaseUntil: null }] }, { $set: { leaseToken: token, leaseUntil: new Date(Date.now() + LEASE_MS) } }, { new: true })
  if (!claimed) throw campusError(409, 'IMPORT_BUSY', '这份材料正在处理，请稍后查看。')
  return claimed
}

async function persistDraft(draft, values, { processing = true } = {}) {
  Object.assign(draft, values)
  await accountImport(draft, null, { processing })
  const written = await CampusImportDraft.updateOne({ _id: draft._id, userId: draft.userId, leaseToken: draft.leaseToken }, { $set: { ...values, reservedBytes: draft.reservedBytes, leaseUntil: new Date(Date.now() + LEASE_MS) } })
  if (!written.matchedCount) throw campusError(409, 'IMPORT_LEASE_EXPIRED', '另一次操作已接管这份材料，请刷新查看。')
}

async function releaseDraft(draft) {
  await CampusImportDraft.updateOne({ _id: draft._id, leaseToken: draft.leaseToken }, { $set: { leaseUntil: null } })
}

async function processDraft(draft) {
  if (await CampusConfirmLedger.exists({ draftId: draft._id })) return confirmImport(draft)
  if (['saved', 'restored', 'ready', 'review'].includes(draft.status)) return null
  if (!await hasOriginal(draft)) throw campusError(409, 'IMPORT_FILE_MISSING', '上传没有完成或原件已丢失，请丢弃后更换文件。')
  if (!draft.uploadComplete) {
    const size = (await fs.stat(draft.filePath)).size
    if (size !== draft.expectedBytes) throw campusError(409, 'IMPORT_UPLOAD_INCOMPLETE', '上次上传没有完成，请更换文件。')
    await persistDraft(draft, { uploadComplete: true, bytes: size })
  }
  try {
    if (!draft.parseComplete) {
      await persistDraft(draft, { status: 'processing', phase: '正在读取材料', errorCode: null })
      const parsed = await parseInChild(draft.filePath, {
        mode: draft.kind, previousBlocks: draft.toObject().blocks || [],
        onBlock: async (block) => {
          const blocks = [...(draft.blocks || [])]
          const index = blocks.findIndex((old) => old.id === block.id)
          if (index < 0) blocks.push(block); else blocks[index] = block
          await persistDraft(draft, { blocks })
        },
      })
      if (parsed.busy) {
        await persistDraft(draft, { status: 'busy', phase: '文件已收好', errorCode: 'IMPORT_BUSY' }, { processing: false })
        return null
      }
      const readFailed = (parsed.blocks || []).some((block) => block.status === 'failed')
      await persistDraft(draft, { blocks: parsed.blocks || draft.blocks || [], issues: issueIds(parsed.issues || [], String(draft._id)), parseComplete: Boolean(parsed.ok && !readFailed), status: parsed.ok && !readFailed ? 'parsed' : 'failed', errorCode: readFailed ? 'PAGE_READ_FAILED' : parsed.code || null })
      // Do not spend the model budget on a truncated source. Completed pages
      // are durable and the parser retries only failed blocks on Continue.
      if (!parsed.ok || readFailed) return null
    }
    await persistDraft(draft, { status: 'processing', phase: '正在整理经历', errorCode: null })
    const imageDataUrl = ['png', 'jpeg', 'webp'].includes(draft.kind) ? await readImportImage(draft.filePath, draft.kind) : undefined
    // Mongoose arrays are proxies and cannot cross structuredClone/worker
    // boundaries. Snapshot once so checkpoint persistence cannot rehydrate the
    // pipeline's in-flight source blocks or previously received model output.
    const material = draft.toObject()
    const organized = await runImportModels({
      blocks: material.blocks, issues: material.issues,
      sourceText: (material.blocks || []).map((block) => block.text || '').join('\n'), imageDataUrl,
      quota: importModelQuota, operationId: String(draft._id), userId: draft.userId, state: material.modelState || {},
      onCheckpoint: async (modelState) => persistDraft(draft, { modelState }),
    })
    const issues = issueIds(organized.issues || organized.result?.issues || [], String(draft._id))
    await persistDraft(draft, { result: organized.result, blocks: organized.blocks || draft.blocks, issues, status: issues.length ? 'review' : 'ready', phase: issues.length ? '有几处需要确认' : '整理完成', errorCode: null }, { processing: false })
    return null
  } catch (error) {
    await persistDraft(draft, { status: 'failed', phase: '材料已保留，整理未完成', errorCode: error.code || 'IMPORT_FAILED' }, { processing: false })
    return null
  }
}

router.get('/imports', asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1), limit = Number(req.query.limit || 20)
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw campusError(400, 'INVALID_PAGINATION', '分页参数不正确。')
  const filter = { userId: req.user.uid, purpose: { $ne: 'job' } }
  const drafts = await CampusImportDraft.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
  res.json({ success: true, data: { items: await Promise.all(drafts.map((draft) => draftView(draft, { detail: false }))), page, limit, total: await CampusImportDraft.countDocuments(filter) } })
}))

router.get('/imports/:id', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await draftView(await ownedDraft(req.params.id, req.user.uid)) })
}))

router.get('/imports/:id/source', asyncHandler(async (req, res, next) => {
  const draft = await ownedDraft(req.params.id, req.user.uid)
  if (!await hasOriginal(draft)) throw campusError(404, 'IMPORT_FILE_MISSING', '没有找到原件，可能上次上传没有完成。')
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': draft.mime || 'application/octet-stream', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(draft.filename || `source.${draft.kind}`)}` })
  res.sendFile(path.resolve(draft.filePath), (error) => { if (error) next(error) })
}))

router.post('/imports', asyncHandler(async (req, res) => {
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim()
  const kind = TYPES.get(mime)
  const expectedBytes = Number(req.headers['content-length'])
  if (!kind) throw campusError(415, 'IMPORT_TYPE', '只接受文字型 PDF、DOCX、PNG、JPEG 或 WEBP。')
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1) throw campusError(411, 'IMPORT_LENGTH', '上传需要声明文件长度。')
  if (expectedBytes > LIMITS.fileBytes) throw campusError(413, 'FILE_TOO_LARGE', '每份材料最多 10MB。')
  const id = new mongoose.Types.ObjectId()
  const filePath = path.join(IMPORT_ROOT, `${id}.${kind}`)
  let filename
  try { filename = decodeURIComponent(String(req.headers['x-file-name'] || `材料.${kind}`)) } catch { filename = `材料.${kind}` }
  filename = Array.from(path.basename(filename), character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? '' : character).join('').slice(0, 200)
  // The owner-visible record precedes capacity reservation and disk creation.
  // A crash anywhere after this point leaves a discoverable, discardable draft.
  let draft = await CampusImportDraft.create({ _id: id, userId: req.user.uid, purpose: 'resume', status: 'uploading', phase: '正在接收文件', filePath, filename, mime, kind, expectedBytes, leaseToken: randomUUID(), leaseUntil: new Date(Date.now() + LEASE_MS) })
  const reserved = await importQuotaBook.reserve({ uid: req.user.uid, draftId: String(id), bytes: expectedBytes + IMPORT_WORK_BYTES })
  if (!reserved.ok) {
    await CampusImportDraft.deleteOne({ _id: id, userId: req.user.uid })
    throw campusError(409, reserved.code, reserved.code === 'GLOBAL_FULL' ? '暂存空间已满，可以丢弃自己的材料或稍后再试。' : '个人暂存已达上限，请先丢弃不再需要的导入。')
  }
  try {
    await fs.mkdir(IMPORT_ROOT, { recursive: true, mode: 0o700 })
    let bytes = 0
    let renewedAt = Date.now()
    const counter = new Transform({
      transform(chunk, encoding, callback) {
        bytes += chunk.length
        if (bytes > expectedBytes || bytes > LIMITS.fileBytes) return callback(campusError(413, 'FILE_TOO_LARGE', '上传超过声明大小。'))
        if (Date.now() - renewedAt > 30000) {
          renewedAt = Date.now()
          CampusImportDraft.updateOne({ _id: id, leaseToken: draft.leaseToken }, { $set: { leaseUntil: new Date(Date.now() + LEASE_MS) } }).then((updated) => callback(updated.matchedCount ? null : campusError(409, 'IMPORT_LEASE_EXPIRED', '上传已停止。'), chunk), callback)
        } else callback(null, chunk)
      },
    })
    await pipeline(req, counter, createWriteStream(`${filePath}.partial`, { flags: 'wx', mode: 0o600 }))
    if (bytes !== expectedBytes) throw campusError(400, 'IMPORT_LENGTH_MISMATCH', '文件上传没有完成。')
    await fs.rename(`${filePath}.partial`, filePath)
    await persistDraft(draft, { bytes, uploadComplete: true, status: 'received', phase: '文件已收好' })
  } catch (error) {
    await removeImportFiles(draft)
    await importQuotaBook.release(String(id))
    await CampusImportDraft.deleteOne({ _id: id, leaseToken: draft.leaseToken })
    throw error
  }
  try { await processDraft(draft) } finally { await releaseDraft(draft) }
  draft = await ownedDraft(String(id), req.user.uid)
  res.status(['ready', 'review'].includes(draft.status) ? 201 : 202).json({ success: true, data: await draftView(draft) })
}))

router.post('/imports/:id/continue', asyncHandler(async (req, res) => {
  const draft = await claimDraft(await ownedDraft(req.params.id, req.user.uid))
  try { await processDraft(draft) } finally { await releaseDraft(draft) }
  const updated = await ownedDraft(req.params.id, req.user.uid)
  res.json({ success: true, data: await draftView(updated) })
}))

router.post('/imports/:id/confirm', asyncHandler(async (req, res) => {
  const draft = await claimDraft(await ownedDraft(req.params.id, req.user.uid))
  let ledger
  try { ledger = await confirmImport(draft, req.body || {}) } finally { await releaseDraft(draft) }
  res.json({ success: true, saved: true, cachePending: ledger.cachePending, data: await draftView(await ownedDraft(req.params.id, req.user.uid), { ledger }) })
}))

router.post('/imports/:id/restore', asyncHandler(async (req, res) => {
  const draft = await claimDraft(await ownedDraft(req.params.id, req.user.uid))
  let ledger
  try { ledger = await restoreImport(draft) } finally { await releaseDraft(draft) }
  res.json({ success: true, restored: true, cachePending: ledger.cachePending, data: await draftView(await ownedDraft(req.params.id, req.user.uid), { ledger }) })
}))

router.post('/imports/:id/cache', asyncHandler(async (req, res) => {
  const draft = await ownedDraft(req.params.id, req.user.uid)
  const ledger = await retryImportCache(draft)
  res.json({ success: true, saved: ledger.status === 'saved', cachePending: ledger.cachePending, data: await draftView(draft, { ledger }) })
}))

router.delete('/imports/:id', asyncHandler(async (req, res) => {
  const draft = await claimDraft(await ownedDraft(req.params.id, req.user.uid))
  try {
    const ledger = await CampusConfirmLedger.findOne({ draftId: draft._id, userId: req.user.uid }).lean()
    if (ledger && !['saved', 'restored', 'conflicted'].includes(ledger.status)) throw campusError(409, 'IMPORT_SAVE_INCOMPLETE', '保存结果尚未确定，请先继续保存，避免丢失恢复记录。')
    await CampusImportDraft.updateOne({ _id: draft._id, leaseToken: draft.leaseToken }, { $set: { status: 'discarding' } })
    await removeImportFiles(draft)
    await CampusConfirmLedger.deleteOne({ draftId: draft._id, userId: req.user.uid })
    // Clear material before releasing its accounting; failure is retryable.
    await CampusImportDraft.updateOne({ _id: draft._id, leaseToken: draft.leaseToken }, { $set: { blocks: [], modelState: {}, result: null, issues: [], bytes: 0 } })
    await importQuotaBook.release(String(draft._id))
    await CampusImportDraft.deleteOne({ _id: draft._id, leaseToken: draft.leaseToken })
    res.json({ success: true, data: { id: String(draft._id), discarded: true } })
  } finally { await releaseDraft(draft) }
}))

export default router
