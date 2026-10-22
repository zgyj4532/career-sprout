import { randomUUID } from 'node:crypto'
import UserProfile from '../models/UserProfile.model.js'
import Resume from '../models/Resume.model.js'
import { invalidateProfileCache } from '../services/profileCache.js'
import { CampusConfirmLedger, CampusImportDraft, CampusImportSaveLock, CampusResumeTombstone, CampusStudent } from './models.js'
import { applyImportStep, assertImportBaseline, finishWithCache, isOwnImportWrite, matchesFields, revisionCondition } from './confirmLedger.js'
import { duplicateCandidates, freezeImport, reviewedMaterial } from './importSave.js'
import { deleteResumeOwned, withResumeLock } from './resumeDelete.js'
import { accountImport, importQuotaBook } from './importStorage.js'
import { campusError } from './errors.js'

const models = { profile: UserProfile, student: CampusStudent, resume: Resume }
const LEASE_MS = 300000

async function withOwnerSave(uid, operation) {
  await CampusImportSaveLock.updateOne({ _id: uid }, { $setOnInsert: { until: new Date(0) } }, { upsert: true }).catch((error) => { if (error.code !== 11000) throw error })
  const token = randomUUID()
  const lock = await CampusImportSaveLock.findOneAndUpdate({ _id: uid, until: { $lte: new Date() } }, { $set: { token, until: new Date(Date.now() + LEASE_MS) } }, { new: true })
  if (!lock) throw campusError(409, 'IMPORT_SAVE_BUSY', '另一份材料正在保存或恢复，请稍后继续。')
  try { return await operation() } finally {
    await CampusImportSaveLock.updateOne({ _id: uid, token }, { $set: { until: new Date(0) } })
  }
}

export function confirmImport(draft, body = {}) {
  return withOwnerSave(draft.userId, () => saveImport(draft, body))
}

export function restoreImport(draft) {
  return withOwnerSave(draft.userId, () => reverseImport(draft))
}

export async function importDestinations(uid) {
  const [profile, student, resumes] = await Promise.all([
    UserProfile.findOne({ uid }).select('+phone').lean(),
    CampusStudent.findOne({ uid }).lean(),
    Resume.find({ userId: uid, deleting: { $ne: true } }).sort({ lastModified: -1 }).lean(),
  ])
  return { profile, student, resumes }
}

export async function previewConfirmation(draft) {
  const { profile, student, resumes } = await importDestinations(draft.userId)
  const selected = draft.resumeId ? resumes.find((item) => String(item._id) === String(draft.resumeId)) : resumes.length === 1 ? resumes[0] : null
  return {
    candidates: draft.result ? duplicateCandidates(reviewedMaterial(draft.result, undefined, String(draft._id)), profile, student, String(draft._id)) : [],
    resumeChoices: resumes.map((item) => ({ id: String(item._id), title: item.title })),
    resumeId: selected ? String(selected._id) : null,
    resumeTitle: selected?.title || (resumes.length ? '' : draft.filename?.replace(/\.[^.]+$/, '') || '导入的简历'),
  }
}

export function resolveIssues(draft, material, decisions, skipIssues) {
  const skippedBlocks = new Set()
  const skippedItems = new Set()
  const resolved = structuredClone(material)
  for (const issue of draft.issues || []) {
    const choice = decisions[issue.id]
    if (choice === 'confirmed') continue
    if (choice !== 'skip' && !skipIssues) throw campusError(409, 'IMPORT_ISSUES_REQUIRED', '还有未确认的读取问题，请核对或明确跳过。')
    if (issue.code === 'UNGROUNDED_ENTRY') continue
    if (issue.code === 'UNGROUNDED_FIELD') {
      // Unsupported assertions were removed during extraction. Skipping keeps
      // the safe value, not a reviewed replacement or a page-wide deletion.
      const target = /^(education|experiences|skills)\.(\d+)\.([A-Za-z]+)$/.exec(issue.field || '')
      if (target) {
        const [, category, index, key] = target
        const item = resolved[category]?.[Number(index)]
        const original = draft.result[category]?.[Number(index)]
        if (item && Object.hasOwn(item, key)) item[key] = original?.[key] ?? ''
      } else if (['name', 'email', 'phone'].includes(issue.field)) {
        resolved[issue.field] = draft.result[issue.field] || ''
      }
      continue
    }
    const field = /^(education|experiences|skills)\.(\d+)(?:\.(dateText))?$/.exec(issue.field || '')
    if (field) {
      const item = resolved[field[1]]?.[Number(field[2])]
      if (item && field[3] === 'dateText') {
        item.dateText = ''
        item.precision = 'unknown'
        item.current = false
        delete item.startYear
        delete item.endYear
      } else skippedItems.add(`${field[1]}:${field[2]}`)
    } else if (issue.code === 'SUSPECTED_MISS') {
      // Unclassified original material is not a verified structured fact.
      // Skipping its review does not remove unrelated fields on the same page.
      resolved.otherMaterials = ''
    } else if (issue.blockId || issue.sourceBlockId) skippedBlocks.add(issue.blockId || issue.sourceBlockId)
    else throw campusError(409, 'IMPORT_REVIEW_REQUIRED', '整份材料还有未确认的问题，请核对结果后再保存。')
  }
  for (const kind of ['education', 'experiences', 'skills']) {
    resolved[kind] = resolved[kind].filter((_, index) => {
      const source = draft.result[kind]?.[index]
      const sources = source?.sourceBlockIds || [source?.sourceBlockId]
      return !skippedItems.has(`${kind}:${index}`) && !sources.some((id) => skippedBlocks.has(id))
    })
  }
  if (skippedBlocks.size) resolved.otherMaterials = ''
  return resolved
}

async function targetAlive(plan, uid) {
  if (await CampusResumeTombstone.exists({ resumeId: plan.id, userId: uid })) throw campusError(409, 'RESUME_DELETED', '这份简历已删除，不会因重试重新创建。')
  const resume = await Resume.findOne({ _id: plan.id, userId: uid }).lean()
  if (resume?.deleting || (!resume && plan.before)) throw campusError(409, 'RESUME_DELETED', '这份简历正在删除或已经删除。')
  if (!resume && !plan.before && await Resume.exists({ userId: uid, _id: { $ne: plan.id }, deleting: { $ne: true } })) throw campusError(409, 'CONFIRM_CONFLICT', '保存期间已建立另一份简历，不会重复新建。')
}

async function freeze(draft, body) {
  if (!draft.result || !['ready', 'review'].includes(draft.status)) throw campusError(409, 'IMPORT_NOT_READY', '整理尚未完成，原件仍在。')
  const { profile, student, resumes } = await importDestinations(draft.userId)
  const selectedId = body.resumeId || draft.resumeId
  const resume = selectedId ? resumes.find((item) => String(item._id) === String(selectedId)) : resumes.length === 1 ? resumes[0] : null
  if (selectedId && !resume) throw campusError(409, 'RESUME_UNAVAILABLE', '选中的简历不存在、已删除或不可访问。')
  if (!resume && resumes.length) throw campusError(409, 'IMPORT_RESUME_REQUIRED', '请选择这次要补充的简历，不会另建一份。')
  const decisions = body.decisions && typeof body.decisions === 'object' && !Array.isArray(body.decisions) ? body.decisions : {}
  const material = resolveIssues(draft, reviewedMaterial(draft.result, body.result, String(draft._id)), decisions, body.skipIssues === true)
  return freezeImport({ models, draft, profile, student, resume, material, decisions, skipIssues: body.skipIssues === true, resumeTitle: body.resumeTitle })
}

async function acquireLedger(draft, body, restoring) {
  let ledger = await CampusConfirmLedger.findOne({ draftId: draft._id, userId: draft.userId }).lean()
  if (!ledger) {
    if (restoring) throw campusError(404, 'LEDGER_NOT_FOUND', '没有找到可以恢复的保存记录。')
    const frozen = await freeze(draft, body)
    await accountImport(draft, { frozen }, { processing: true })
    try { ledger = (await CampusConfirmLedger.create({ draftId: draft._id, userId: draft.userId, frozen, status: 'pending', steps: {} })).toObject() }
    catch (error) {
      if (error.code !== 11000) throw error
      ledger = await CampusConfirmLedger.findOne({ draftId: draft._id, userId: draft.userId }).lean()
    }
  }
  if (!restoring && ledger.status === 'conflicted') {
    if (!body.result) throw campusError(409, 'IMPORT_REVIEW_REQUIRED', '资料已在其他页面修改，请重新核对结果后保存，也可以丢弃这次导入。')
    const frozen = await freeze({ ...draft.toObject(), status: 'review' }, body)
    await accountImport(draft, { frozen }, { processing: true })
    ledger = await CampusConfirmLedger.findOneAndUpdate({ _id: ledger._id, status: 'conflicted', writeStarted: { $ne: true } }, {
      $set: { frozen, status: 'pending', steps: {}, errorCode: null, leaseUntil: null, writeStarted: false },
    }, { new: true }).lean()
    if (!ledger) throw campusError(409, 'IMPORT_SAVE_BUSY', '另一处已开始保存，请刷新查看。')
  }
  if (!restoring && ['restoring', 'restored'].includes(ledger.status)) throw campusError(409, 'IMPORT_RESTORED', '这次导入已恢复或正在恢复，不会再次写入。')
  if (restoring && !['saved', 'restoring', 'restored'].includes(ledger.status)) throw campusError(409, 'IMPORT_NOT_SAVED', '请先继续完成保存，再恢复保存前的版本。')
  if ((!restoring && ledger.status === 'saved') || (restoring && ledger.status === 'restored')) return ledger
  const token = randomUUID()
  const acquired = await CampusConfirmLedger.findOneAndUpdate({ _id: ledger._id, $or: [{ leaseUntil: { $lte: new Date() } }, { leaseUntil: null }] }, { $set: { leaseToken: token, leaseUntil: new Date(Date.now() + LEASE_MS), status: restoring ? 'restoring' : 'saving' } }, { new: true }).lean()
  if (!acquired) throw campusError(409, 'IMPORT_SAVE_BUSY', '这份材料正在保存，请稍后查看结果。')
  return acquired
}

async function renew(ledger) {
  const result = await CampusConfirmLedger.updateOne({ _id: ledger._id, leaseToken: ledger.leaseToken }, { $set: { leaseUntil: new Date(Date.now() + LEASE_MS) } })
  if (!result.matchedCount) throw campusError(409, 'IMPORT_SAVE_LEASE', '保存已由另一次继续操作接管，请刷新查看结果。')
}

async function cacheResult(ledger) {
  if (!ledger.cachePending) return ledger
  await finishWithCache(ledger, () => invalidateProfileCache(ledger.userId))
  await CampusConfirmLedger.updateOne({ _id: ledger._id, status: ledger.status }, { $set: { cachePending: ledger.cachePending } })
  return ledger
}

async function saveImport(draft, body) {
  const ledger = await acquireLedger(draft, body, false)
  ledger.steps ||= {}
  if (ledger.status === 'saved') {
    const target = ledger.frozen.plans.find((plan) => plan.kind === 'resume')
    await targetAlive(target, draft.userId)
    if (!await Resume.exists({ _id: target.id, userId: draft.userId })) throw campusError(409, 'RESUME_DELETED', '之前保存的简历已删除，不会因重试重新创建。')
    await cacheResult(ledger)
    await CampusImportDraft.updateOne({ _id: draft._id }, { $set: { status: 'saved', resumeId: ledger.frozen.resumeId, phase: '资料已保存' } })
    await importQuotaBook.complete(String(draft._id))
    return ledger
  }
  const importId = String(draft._id)
  const resumePlan = ledger.frozen.plans.find((plan) => plan.kind === 'resume')
  let writesPossible = Boolean(ledger.writeStarted || Object.values(ledger.steps).some((step) => step.recordExists && !step.unchanged))
  try {
    const existing = await Promise.all(ledger.frozen.plans.map(async (plan) => {
      const query = models[plan.kind].findOne({ _id: plan.id, ...plan.owner })
      return { plan, current: await (plan.kind === 'profile' ? query.select('+phone') : query).lean() }
    }))
    writesPossible ||= existing.some(({ current }) => current?.lastImportId === importId)
    await targetAlive(resumePlan, draft.userId)
    for (const { plan, current } of existing) assertImportBaseline(current, plan, importId)
    // Resume first: a deleted/changed destination must not partially add profile
    // content before we discover that the selected save target is unavailable.
    for (const plan of [...ledger.frozen.plans].reverse()) {
      await renew(ledger)
      if (plan.changed && !writesPossible) {
        // Persist intent before dispatch. A crash after this line cannot be
        // mistaken for a safe-to-refreeze preflight rejection.
        const started = await CampusConfirmLedger.updateOne({ _id: ledger._id, leaseToken: ledger.leaseToken }, { $set: { writeStarted: true } })
        if (!started.matchedCount) throw campusError(409, 'IMPORT_SAVE_LEASE', '保存已由另一次操作接管。')
        writesPossible = true
      }
      const apply = () => applyImportStep(models[plan.kind], plan, importId, async () => { if (plan.kind === 'resume') await targetAlive(plan, draft.userId) })
      const step = plan.kind === 'resume' ? await withResumeLock(plan.id, apply) : await apply()
      ledger.steps[plan.kind] = step
      const marked = await CampusConfirmLedger.updateOne({ _id: ledger._id, leaseToken: ledger.leaseToken }, { $set: { [`steps.${plan.kind}`]: step } })
      if (!marked.matchedCount) throw campusError(409, 'IMPORT_SAVE_LEASE', '保存已由另一次操作接管。')
    }
    const finished = await CampusConfirmLedger.updateOne({ _id: ledger._id, leaseToken: ledger.leaseToken }, { $set: { status: 'saved', cachePending: true, leaseUntil: null, errorCode: null } })
    if (!finished.matchedCount) throw campusError(409, 'IMPORT_SAVE_LEASE', '保存已由另一次操作接管。')
    ledger.status = 'saved'
    ledger.cachePending = true
    draft.status = 'saved'
    draft.resumeId = ledger.frozen.resumeId
    draft.phase = '资料已保存'
    await CampusImportDraft.updateOne({ _id: draft._id }, { $set: { status: draft.status, resumeId: draft.resumeId, phase: draft.phase } })
    await importQuotaBook.complete(importId)
    await cacheResult(ledger)
    await accountImport(draft, ledger)
    return ledger
  } catch (error) {
    if (ledger.status !== 'saved') {
      const cleanConflict = !writesPossible && ['CONFIRM_CONFLICT', 'RESUME_DELETED'].includes(error.code)
      await CampusConfirmLedger.updateOne({ _id: ledger._id, leaseToken: ledger.leaseToken }, { $set: { status: cleanConflict ? 'conflicted' : 'unknown', errorCode: error.code || 'IMPORT_SAVE_UNKNOWN', leaseUntil: null } })
      await CampusImportDraft.updateOne({ _id: draft._id }, { $set: { status: cleanConflict ? 'review' : 'save_unknown', phase: cleanConflict ? '资料已变化，请重新核对后保存' : '保存结果未知', errorCode: error.code || 'IMPORT_SAVE_UNKNOWN' } })
    }
    throw error
  }
}

export async function retryImportCache(draft) {
  const ledger = await CampusConfirmLedger.findOne({ draftId: draft._id, userId: draft.userId }).lean()
  if (!ledger || !['saved', 'restored'].includes(ledger.status)) throw campusError(409, 'IMPORT_NOT_SAVED', '资料保存还没有完成。')
  return cacheResult(ledger)
}

function restoredOwn(record, plan, ledger) {
  return record?.lastImportId === `restore:${ledger.draftId}` && matchesFields(record, plan.before.fields)
    && (plan.kind === 'resume' ? record.revision === plan.writtenRevision + 1 : new Date(record.updatedAt).getTime() === new Date(ledger.restoredAt).getTime())
}

async function reverseImport(draft) {
  const ledger = await acquireLedger(draft, {}, true)
  if (ledger.status === 'restored') return cacheResult(ledger)
  if (!ledger.restoredAt) {
    ledger.restoredAt = new Date()
    await CampusConfirmLedger.updateOne({ _id: ledger._id, leaseToken: ledger.leaseToken }, { $set: { restoredAt: ledger.restoredAt } })
  }
  const changed = ledger.frozen.plans.filter((plan) => plan.changed)
  let reversePossible = Boolean(ledger.restoreStarted)
  try {
    // Preflight every affected record before the first reverse write. Each write
    // still has its own CAS because standalone Mongo has no cross-collection txn.
    const existing = await Promise.all(changed.map(async (plan) => {
      const query = models[plan.kind].findOne({ _id: plan.id, ...plan.owner })
      return { plan, current: await (plan.kind === 'profile' ? query.select('+phone') : query).lean() }
    }))
    reversePossible ||= existing.some(({ plan, current }) => (!current && !plan.before)
      || current?.lastImportId === `restore:${draft._id}` || current?.deleting)
    for (const { plan, current } of existing) {
      if (!current && !plan.before) continue
      if (plan.before && restoredOwn(current, plan, ledger)) continue
      if (!plan.before && plan.kind === 'resume' && current?.deleting && current.lastImportId === String(draft._id) && current.revision === plan.writtenRevision + 1) continue
      if (!isOwnImportWrite(current, plan, String(draft._id))) throw campusError(409, 'RESTORE_CONFLICT', '保存之后已有人工修改，恢复不会覆盖这些修改。')
    }
    for (const plan of [...changed].reverse()) {
      await renew(ledger)
      if (!reversePossible) {
        const started = await CampusConfirmLedger.updateOne({ _id: ledger._id, leaseToken: ledger.leaseToken }, { $set: { restoreStarted: true } })
        if (!started.matchedCount) throw campusError(409, 'IMPORT_SAVE_LEASE', '恢复已由另一次操作接管。')
        reversePossible = true
      }
      if (!plan.before && plan.kind === 'resume') {
        await deleteResumeOwned(plan.id, draft.userId, { expectedRevision: plan.writtenRevision })
        continue
      }
      const reverse = async () => {
        const query = models[plan.kind].findOne({ _id: plan.id, ...plan.owner })
        const current = await (plan.kind === 'profile' ? query.select('+phone') : query).lean()
        if (!current && !plan.before) return
        if (plan.before && restoredOwn(current, plan, ledger)) return
        if (!isOwnImportWrite(current, plan, String(draft._id))) throw campusError(409, 'RESTORE_CONFLICT', '保存之后已有修改，没有覆盖。')
        const filter = { _id: plan.id, ...plan.owner, lastImportId: String(draft._id), ...revisionCondition(current, plan.kind === 'resume' ? 'revision' : 'updatedAt') }
        if (!plan.before) {
          const removed = await models[plan.kind].deleteOne(filter)
          if (!removed.deletedCount) throw campusError(409, 'RESTORE_CONFLICT', '恢复时资料发生了变化。')
        } else {
          const metadata = plan.kind === 'resume'
            ? { revision: plan.writtenRevision + 1, contentRevision: plan.writtenContentRevision + 1, lastModified: ledger.restoredAt }
            : { updatedAt: ledger.restoredAt }
          const previous = { ...plan.before.fields }
          const absent = Object.fromEntries((plan.before.absent || []).map((key) => { delete previous[key]; return [key, 1] }))
          const restored = await models[plan.kind].updateOne(filter, { $set: { ...previous, ...metadata, lastImportId: `restore:${draft._id}` }, ...(Object.keys(absent).length ? { $unset: absent } : {}) }, { timestamps: false, runValidators: true })
          if (!restored.matchedCount) throw campusError(409, 'RESTORE_CONFLICT', '恢复时资料发生了变化。')
        }
      }
      if (plan.kind === 'resume') await withResumeLock(plan.id, reverse)
      else await reverse()
    }
    ledger.status = 'restored'
    ledger.cachePending = true
    await CampusConfirmLedger.updateOne({ _id: ledger._id, leaseToken: ledger.leaseToken }, { $set: { status: 'restored', cachePending: true, leaseUntil: null } })
    await CampusImportDraft.updateOne({ _id: draft._id }, { $set: { status: 'restored', phase: '已恢复保存前的版本' } })
    return cacheResult(ledger)
  } catch (error) {
    const cleanConflict = !reversePossible && error.code === 'RESTORE_CONFLICT'
    await CampusConfirmLedger.updateOne({ _id: ledger._id, leaseToken: ledger.leaseToken }, { $set: { leaseUntil: null, errorCode: error.code || 'RESTORE_UNKNOWN', ...(cleanConflict ? { status: 'saved', restoredAt: null } : {}) } })
    if (cleanConflict) await CampusImportDraft.updateOne({ _id: draft._id }, { $set: { status: 'saved', phase: '资料已保存；后续修改阻止了恢复' } })
    throw error
  }
}
