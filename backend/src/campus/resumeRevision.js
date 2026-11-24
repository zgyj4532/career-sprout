import { isDeepStrictEqual } from 'node:util'

export const BODY_FIELDS = ['originalText', 'enhancedText', 'jobRole', 'atsScore', 'preferences', 'pdfUrl', 'sectionOrder', 'customSections']

export function revisionOf(source) {
  const value = Number(source?.revision ?? 1)
  return Number.isInteger(value) && value > 0 ? value : 1
}

export function contentRevisionOf(source) {
  const value = Number(source?.contentRevision ?? 1)
  return Number.isInteger(value) && value > 0 ? value : 1
}

export function sourceContentMatches(source, target) {
  return contentRevisionOf(source) === Number(target?.sourceRevision)
}

export function planResumeUpdate(current, request) {
  if (!current || current.deleting) return { error: 'deleting' }
  const expectedRevision = revisionOf(current)
  if (typeof request?.revision !== 'number' || request.revision !== expectedRevision) return { error: 'conflict' }
  const bodyKeys = BODY_FIELDS.filter((key) => request[key] !== undefined)
  const titleOnly = request.title !== undefined && bodyKeys.length === 0
  if (!titleOnly && bodyKeys.length === 0) return { error: 'empty' }
  const legacyRevision = current.revision === undefined || current.revision === null
  const legacyContentRevision = current.contentRevision === undefined || current.contentRevision === null
  const filter = {
    _id: current._id,
    userId: current.userId,
    ...(legacyRevision ? { $or: [{ revision: { $exists: false } }, { revision: null }, { revision: expectedRevision }] } : { revision: current.revision }),
    deleting: { $ne: true },
  }
  if (titleOnly) {
    if (legacyRevision || legacyContentRevision) {
      return {
        filter,
        update: {
          $set: {
            title: request.title,
            ...(legacyRevision ? { revision: expectedRevision + 1 } : {}),
            ...(legacyContentRevision ? { contentRevision: contentRevisionOf(current) } : {}),
          },
          ...(!legacyRevision ? { $inc: { revision: 1 } } : {}),
        },
        bumpsContent: false,
      }
    }
    return { filter, update: { $set: { title: request.title }, $inc: { revision: 1 } }, bumpsContent: false }
  }
  const set = {}
  for (const key of bodyKeys) set[key] = request[key]
  const value = typeof current.toObject === 'function' ? current.toObject() : current
  const bumpsContent = bodyKeys.some((key) => key !== 'atsScore' && key !== 'pdfUrl' && !isDeepStrictEqual(value[key], request[key]))
  if (legacyRevision || legacyContentRevision) {
    const inc = {
      ...(!legacyRevision ? { revision: 1 } : {}),
      ...(!legacyContentRevision && bumpsContent ? { contentRevision: 1 } : {}),
    }
    return {
      filter,
      update: {
        $set: {
          ...set,
          ...(legacyRevision ? { revision: expectedRevision + 1 } : {}),
          ...(legacyContentRevision ? { contentRevision: contentRevisionOf(current) + (bumpsContent ? 1 : 0) } : {}),
        },
        ...(Object.keys(inc).length ? { $inc: inc } : {}),
      },
      bumpsContent,
    }
  }
  return { filter, update: { $set: set, $inc: { revision: 1, ...(bumpsContent ? { contentRevision: 1 } : {}) } }, bumpsContent }
}
