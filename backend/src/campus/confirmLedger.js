import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { campusError } from './errors.js'

export function stableImportId(draftId, key) {
  return createHash('sha256').update(`${draftId}:${key}`).digest('hex').slice(0, 24)
}

export function mergeResumeBlanks(currentText, incomingText) {
  // Free-form Markdown has no reliable field boundaries: nonempty prose is
  // never an empty slot, even if the imported wording is different.
  return String(currentText || '').trim() ? currentText : String(incomingText || '')
}

function comparable(value) {
  return JSON.parse(JSON.stringify(value ?? null))
}

export function matchesFields(record, fields) {
  return Object.entries(fields).every(([key, value]) => isDeepStrictEqual(comparable(record?.[key]), comparable(value)))
}

export function revisionCondition(record, field = 'updatedAt') {
  return { ...(record?.[field] == null ? { [field]: { $exists: false } } : { [field]: record[field] }), ...(field === 'updatedAt' ? { confirmationReceipts: record?.confirmationReceipts === undefined ? { $exists: false } : record.confirmationReceipts } : {}) };
}

export function isOwnImportWrite(record, plan, importId) {
  return record?.lastImportId === importId && matchesFields(record, plan.after)
    && (plan.kind === 'resume' ? record.revision === plan.writtenRevision : new Date(record.updatedAt).getTime() === new Date(plan.writtenAt).getTime())
}

export function assertImportBaseline(current, plan, importId) {
  if (isOwnImportWrite(current, plan, importId)) return
  if (current && (!plan.before || !matchesFields(current, plan.before.fields) || (plan.kind === 'resume'
    ? (current.revision ?? 1) !== plan.before.revision
    : new Date(current.updatedAt).getTime() !== new Date(plan.before.updatedAt).getTime()))) {
    throw campusError(409, 'CONFIRM_CONFLICT', '档案或简历已被其他页面修改，这次没有覆盖。')
  }
  if (!current && plan.kind === 'resume' && plan.before) throw campusError(409, 'RESUME_DELETED', '选中的简历已删除，不会重新创建。')
}

// Always inspect the actual record. A persisted target ID or completed ledger
// flag alone is not proof that the preceding database write committed.
export async function applyImportStep(model, plan, importId, guard = async () => {}) {
  await guard()
  const query = model.findOne({ _id: plan.id, ...plan.owner })
  const current = await (plan.kind === 'profile' ? query.select('+phone') : query).lean()
  if (isOwnImportWrite(current, plan, importId)) return { targetId: plan.id, recordExists: true, writtenRevision: plan.writtenRevision, writtenAt: plan.writtenAt }
  assertImportBaseline(current, plan, importId)
  if (current && !plan.changed) return { targetId: plan.id, recordExists: true, unchanged: true, writtenRevision: plan.before.revision }
  const timestamps = plan.kind === 'resume' ? { lastModified: new Date(plan.writtenAt), revision: plan.writtenRevision, contentRevision: plan.writtenContentRevision } : { updatedAt: new Date(plan.writtenAt) }
  const values = { ...plan.after, lastImportId: importId, ...timestamps }
  if (current) {
    const condition = plan.kind === 'resume' ? revisionCondition(current, 'revision') : revisionCondition(current)
    const written = await model.updateOne({ _id: plan.id, ...plan.owner, ...condition, ...(plan.kind === 'resume' ? { deleting: { $ne: true } } : {}) }, { $set: values }, { runValidators: true, timestamps: false })
    if (!written.matchedCount) throw campusError(409, 'CONFIRM_CONFLICT', '保存时资料发生了变化，请重新查看。')
  } else {
    try {
      await new model({ ...(plan.before?.snapshot || {}), _id: plan.id, ...plan.owner, ...values, createdAt: plan.before?.snapshot?.createdAt || new Date(plan.writtenAt) }).save({ timestamps: false })
    } catch (error) {
      if (error.code !== 11000) throw error
      const lookup = model.findOne({ _id: plan.id, ...plan.owner })
      const raced = await (plan.kind === 'profile' ? lookup.select('+phone') : lookup).lean()
      if (!isOwnImportWrite(raced, plan, importId)) throw campusError(409, 'CONFIRM_CONFLICT', '资料已经在另一处建立，请重新查看。')
    }
  }
  const lookup = model.findOne({ _id: plan.id, ...plan.owner })
  const actual = await (plan.kind === 'profile' ? lookup.select('+phone') : lookup).lean()
  if (!isOwnImportWrite(actual, plan, importId)) throw campusError(409, 'CONFIRM_CONFLICT', '写入后资料发生变化，保存结果需要核对。')
  return { targetId: plan.id, recordExists: true, writtenRevision: plan.writtenRevision, writtenAt: plan.writtenAt }
}

export async function finishWithCache(ledger, invalidate) {
  try {
    const result = await invalidate()
    ledger.cachePending = result?.bypassed === true
  } catch {
    ledger.cachePending = true
  }
  return { saved: ledger.status === 'saved', cachePending: ledger.cachePending }
}
