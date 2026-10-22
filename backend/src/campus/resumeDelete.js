import Resume from '../models/Resume.model.js'
import ResumeVersion from '../models/ResumeVersion.model.js'
import ResumeAtsHistory from '../models/ResumeAtsHistory.model.js'
import ResumeShare from '../models/ResumeShare.model.js'
import ResumeComment from '../models/ResumeComment.model.js'
import { CampusResumeTombstone, CampusTarget, CampusSaveOperation } from './models.js'
import { campusError } from './errors.js'
import { withAccountWrite } from './accountWrites.js'

// All association writers and deletion share admission in the single campus
// server. The durable deleting flag still blocks writers after a restart.
const pending = new Map()
export async function withResumeLock(resumeId, operation) {
  const key = String(resumeId).toLowerCase()
  const previous = pending.get(key) || Promise.resolve()
  let release
  const settled = new Promise((resolve) => { release = resolve })
  pending.set(key, settled)
  await previous
  try { return await operation() } finally {
    release()
    if (pending.get(key) === settled) pending.delete(key)
  }
}

export async function withResumeAssociation(resumeId, userId, kind, operation) {
  return withResumeLock(resumeId, async () => {
    const resume = await Resume.findOne({ _id: resumeId, userId })
    const gate = associationAllowed(resume, kind)
    if (!gate.ok) throw campusError(gate.code === 'RESUME_NOT_FOUND' ? 404 : 409, gate.code, gate.message)
    // Persist the default baseline for records created before revision fields.
    for (const field of ['revision', 'contentRevision']) {
      if (resume.$isDefault(field)) await Resume.updateOne({ _id: resume._id, [field]: { $exists: false } }, { $set: { [field]: 1 } }, { timestamps: false })
    }
    return operation(resume)
  })
}

export function deleteResumeOwned(resumeId, userId, options = {}) {
  return withAccountWrite(userId, () => deleteOwned(resumeId, userId, options))
}
async function deleteOwned(resumeId, userId, { expectedRevision } = {}) {
  return withResumeLock(resumeId, async () => {
    if (expectedRevision !== undefined) {
      const current = await Resume.findOne({ _id: resumeId, userId }).lean()
      if (current && !current.deleting && current.revision !== expectedRevision) throw campusError(409, 'RESTORE_CONFLICT', '简历已在导入后修改，不能覆盖这些修改。')
    }
    const resume = await Resume.findOneAndUpdate(
      { _id: resumeId, userId, deleting: { $ne: true } },
      { $set: { deleting: true }, $inc: { revision: 1 } }, { new: true })
      || await Resume.findOne({ _id: resumeId, userId })
    const tombstone = await CampusResumeTombstone.findOne({ resumeId, userId })
    if (!resume && !tombstone) throw campusError(404, 'RESUME_NOT_FOUND', '简历不存在或不可访问。')
    return cleanupDeletedResume({ versions: ResumeVersion, ats: ResumeAtsHistory,
      shares: ResumeShare, comments: ResumeComment, targets: CampusTarget,
      resumes: Resume, tombstones: CampusResumeTombstone, saveOperations: CampusSaveOperation }, resumeId, userId)
  })
}

export const DELETE_CLEANUP_COLLECTIONS = ['versions', 'ats', 'shares', 'comments', 'targets']

const BLOCKED = {
  version: '不能为正在删除的简历新建版本。',
  ats: '不能为正在删除的简历记录评分历史。',
  share: '不能为正在删除的简历创建分享。',
  comment: '不能为正在删除的简历添加评论。',
  target: '不能为正在删除的简历新建定向草稿。',
}

export function associationAllowed(resume, kind) {
  if (!resume) return { ok: false, code: 'RESUME_NOT_FOUND', message: '简历不存在。' }
  if (resume.deleting) return { ok: false, code: 'RESUME_DELETING', message: BLOCKED[kind] || '这份简历正在删除，不能新建关联内容。' }
  return { ok: true }
}

export function importMayRecreate({ tombstone, resume }) {
  if (tombstone || resume?.deleting) return { stop: true, message: '原简历已删除或正在删除，导入不会重建它。' }
  return { stop: false }
}

export async function cleanupDeletedResume(deps, resumeId, userId) {
  // Persist the recovery/anti-resurrection record before removing anything.
  await deps.tombstones.updateOne({ resumeId, userId }, { $setOnInsert: { userId, deletedAt: new Date() } }, { upsert: true })
  if (deps.saveOperations) await deps.saveOperations.updateMany({ kind: 'resume', resourceId: resumeId, userId }, {
    $set: { status: 'cancelled' }, $unset: { frozen: '', result: '', leaseToken: '', leaseUntil: '' },
  })
  await deps.versions.deleteMany({ resumeId })
  await deps.ats.deleteMany({ resumeId })
  await deps.shares.deleteMany({ resumeId })
  await deps.comments.deleteMany({ resumeId })
  await deps.targets.deleteMany({ sourceResumeId: resumeId })
  await deps.resumes.deleteOne({ _id: resumeId, userId })
  return { cleaned: true, collections: DELETE_CLEANUP_COLLECTIONS }
}
