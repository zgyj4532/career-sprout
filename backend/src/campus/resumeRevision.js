import { isDeepStrictEqual } from 'node:util'

export const BODY_FIELDS = ['originalText', 'enhancedText', 'jobRole', 'atsScore', 'preferences', 'pdfUrl', 'sectionOrder', 'customSections']

export function contentRevisionOf(source) {
  const value = Number(source?.contentRevision ?? 1)
  return Number.isInteger(value) && value > 0 ? value : 1
}

export function sourceContentMatches(source, target) {
  return contentRevisionOf(source) === Number(target?.sourceRevision)
}

export function planResumeUpdate(current, request) {
  if (!current || current.deleting) return { error: 'deleting' }
  if (typeof request?.revision !== 'number' || request.revision !== current.revision) return { error: 'conflict' }
  const bodyKeys = BODY_FIELDS.filter((key) => request[key] !== undefined)
  const titleOnly = request.title !== undefined && bodyKeys.length === 0
  if (!titleOnly && bodyKeys.length === 0) return { error: 'empty' }
  const filter = { _id: current._id, userId: current.userId, revision: current.revision, deleting: { $ne: true } }
  if (titleOnly) {
    return { filter, update: { $set: { title: request.title }, $inc: { revision: 1 } }, bumpsContent: false }
  }
  const set = {}
  for (const key of bodyKeys) set[key] = request[key]
  const value = typeof current.toObject === 'function' ? current.toObject() : current
  const bumpsContent = bodyKeys.some((key) => key !== 'atsScore' && key !== 'pdfUrl' && !isDeepStrictEqual(value[key], request[key]))
  return { filter, update: { $set: set, $inc: { revision: 1, ...(bumpsContent ? { contentRevision: 1 } : {}) } }, bumpsContent }
}
