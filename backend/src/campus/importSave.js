import { campusError } from './errors.js'
import { matchesFields, mergeResumeBlanks, stableImportId } from './confirmLedger.js'
import { normalizeSkill } from './schemas.js'

const text = (value) => typeof value === 'string' ? value : ''
const precision = (value) => ['day', 'month', 'year', 'unknown'].includes(value) ? value : ''

export function preserveEducation(education) {
  if (!Array.isArray(education)) return []
  return education.map((item) => ({
    ...(item._id ? { _id: item._id } : {}),
    ...(item.id ? { id: text(item.id) } : {}),
    institution: text(item.institution), degree: text(item.degree), field: text(item.field),
    dateText: text(item.dateText), precision: precision(item.precision), current: item.current === true,
    fullText: text(item.fullText),
    ...(Number.isInteger(item.startYear) ? { startYear: item.startYear } : {}),
    ...(Number.isInteger(item.endYear) ? { endYear: item.endYear } : {}),
  }))
}

export function preserveExperience(item) {
  const fullText = text(item.fullText) || [item.context, item.actions, item.result].filter(Boolean).join('\n')
  return {
    id: text(item.id), kind: ['course', 'club', 'project', 'internship', 'other'].includes(item.kind) ? item.kind : 'other',
    title: text(item.title), organization: text(item.organization), sourceBlockId: text(item.sourceBlockId),
    context: text(item.context).slice(0, 2000), actions: text(item.actions).slice(0, 3000), result: text(item.result).slice(0, 2000),
    fullText, brief: text(item.brief).slice(0, 3000), dateText: text(item.dateText), precision: precision(item.precision), current: item.current === true,
    useConcise: item.useConcise === true,
    titleIsSourceExcerpt: item.titleIsSourceExcerpt === true,
    ...(item.state ? { state: item.state } : {}),
    ...(item.sourceConversationId ? { sourceConversationId: text(item.sourceConversationId), sourceQuestionId: text(item.sourceQuestionId) } : {}),
  }
}

export function reviewedMaterial(extracted, reviewed, draftId) {
  const input = reviewed === undefined ? extracted : reviewed
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw campusError(400, 'IMPORT_RESULT_INVALID', '整理结果格式不正确。')
  for (const key of ['education', 'experiences', 'skills']) {
    if (!Array.isArray(input[key]) || input[key].length > 100 || input[key].some((item) => item == null || (typeof item !== 'object' && !(key === 'skills' && typeof item === 'string')))) throw campusError(400, 'IMPORT_RESULT_INVALID', '教育、经历或技能格式不正确。')
  }
  const material = {
    name: text(input.name), email: text(input.email), phone: text(input.phone), bio: text(input.bio), summary: text(extracted.summary),
    education: preserveEducation(input.education).map((item, index) => ({ ...item, _id: stableImportId(draftId, `education:${extracted.education?.[index]?.sourceBlockId || 'reviewed'}:${index}`), id: stableImportId(draftId, `education:${extracted.education?.[index]?.sourceBlockId || 'reviewed'}:${index}`) })),
    experiences: input.experiences.map((item, index) => ({ ...preserveExperience(item), id: stableImportId(draftId, `experience:${extracted.experiences?.[index]?.sourceBlockId || 'reviewed'}:${index}`), sourceBlockId: extracted.experiences?.[index]?.sourceBlockId || '', titleIsSourceExcerpt: extracted.experiences?.[index]?.titleIsSourceExcerpt === true && item.title === extracted.experiences[index].title })),
    skills: input.skills.map((item) => ({ name: typeof item === 'string' ? item.trim() : text(item.name).trim(), evidence: typeof item === 'string' ? '' : text(item.evidence) })).filter((item) => item.name),
    otherMaterials: text(input.otherMaterials),
  }
  if (material.bio.length > 500 || material.experiences.some((item) => !item.title || item.organization.length > 150) || material.skills.some((item) => item.evidence.length > 1000)) throw campusError(422, 'IMPORT_FIELD_LIMIT', '简介、经历标题或技能依据超过编辑范围，请调整后保存。')
  if (material.name.length > 100 || material.phone.length > 30 || material.skills.some((item) => item.name.length > 50) || material.education.some((item) => item.institution.length > 150 || item.degree.length > 100 || item.field.length > 100 || item.dateText.length > 80) || material.experiences.some((item) => item.title.length > 150 || item.dateText.length > 80) || JSON.stringify(material).length > 100000) throw campusError(422, 'IMPORT_RESULT_TOO_LONG', '内容超过可保存范围，请缩短字段名称；经历全文可以保留。')
  return material
}

export function duplicateCandidates(material, profile, student, draftId) {
  const candidates = []
  for (const [kind, incoming, existing] of [['education', material.education, profile?.education || []], ['experience', material.experiences, student?.experiences || []]]) {
    incoming.forEach((item, index) => {
      const name = text(kind === 'education' ? item.institution : item.title).trim().toLowerCase()
      const matches = existing.filter((old) => name && text(kind === 'education' ? old.institution : old.title).trim().toLowerCase() === name)
      if (matches.length) candidates.push({ id: stableImportId(draftId, `candidate:${kind}:${item.id || index}`), kind, index, title: kind === 'education' ? item.institution : item.title, existingIds: matches.map((old) => String(old.id || old._id || '')) })
    })
  }
  return candidates
}

function appendMaterial(old, addition) {
  if (!addition || text(old).includes(addition)) return text(old)
  return [text(old), addition].filter(Boolean).join('\n\n')
}

function renderOriginalEntry(body, facts) {
  const normalize = (value) => text(value).replace(/\s+/gu, '')
  let represented = normalize(body)
  const missing = []
  for (const fact of facts) {
    const value = normalize(fact)
    if (!value || represented.includes(value)) continue
    missing.push(fact)
    represented += `\n${value}`
  }
  return [...missing, body].filter(Boolean).join('\n')
}

function renderOtherMaterial(value) {
  // Only drop standalone labels already represented by our generated sections.
  // Keep every substantive line and leave the stored original material intact.
  return text(value).split(/\r?\n/).filter((line) => !/^\s*(?:#{1,6}\s*)?(?:教育经历|教育背景|实习经历|项目经历|工作经历|工作经验|技能|专业技能)[：:\s]*$/.test(line)).join('\n').trim()
}

export function renderImportedResume(material) {
  const otherMaterials = renderOtherMaterial(material.otherMaterials)
  return [
    material.name ? `# ${material.name}` : '',
    [material.email, material.phone].filter(Boolean).join(' · '),
    material.bio,
    material.education.length ? `## 教育经历\n${material.education.map((item) => renderOriginalEntry(item.fullText, [item.institution, item.degree, item.field, item.dateText])).join('\n\n')}` : '',
    material.experiences.some((item) => item.state !== 'idea') ? `## 经历\n${material.experiences.filter((item) => item.state !== 'idea').map((item) => renderOriginalEntry(item.useConcise && item.brief ? item.brief : item.fullText || [item.context, item.actions, item.result].filter(Boolean).join('\n'), [item.state === 'in_progress' ? '进行中（未完成）' : '', item.title, item.organization, item.dateText])).join('\n\n')}` : '',
    material.skills.length ? `## 技能\n${material.skills.map((item) => item.name).join('、')}` : '',
    otherMaterials ? `## 其他原文材料\n${otherMaterials}` : '',
  ].filter(Boolean).join('\n\n')
}

function planFor(model, kind, record, owner, after, draftId, writtenAt) {
  const id = String(record?._id || stableImportId(draftId, kind))
  // Apply exactly the same defaults/casts as persistence before freezing, so
  // retry compares actual stored subdocuments rather than model response JSON.
  const cast = new model({ _id: id, ...owner, ...after }).toObject()
  const fields = Object.fromEntries(Object.keys(after).map((key) => [key, cast[key]]))
  const before = record ? { snapshot: record, fields: Object.fromEntries(Object.keys(after).map((key) => [key, record[key] ?? null])), absent: Object.keys(after).filter((key) => record[key] === undefined), updatedAt: record.updatedAt, revision: record.revision ?? 1, contentRevision: record.contentRevision ?? 1 } : null
  return {
    kind, id, owner, after: fields, before, writtenAt,
    changed: !record || !matchesFields(record, fields),
    writtenRevision: (record ? record.revision ?? 1 : 0) + 1,
    writtenContentRevision: (record ? record.contentRevision ?? 1 : 0) + 1,
  }
}

export function freezeImport({ models, draft, profile, student, resume, material, decisions = {}, skipIssues = false, resumeTitle }) {
  const draftId = String(draft._id)
  const candidates = duplicateCandidates(material, profile, student, draftId)
  const skipped = new Set()
  for (const candidate of candidates) {
    const choice = decisions[candidate.id]
    if (!['keep-existing', 'add'].includes(choice) && !skipIssues) throw campusError(409, 'IMPORT_DECISIONS_REQUIRED', '有疑似重复的材料，请选择保留原有内容或另存。')
    if (choice !== 'add') skipped.add(`${candidate.kind}:${candidate.index}`)
  }
  const education = material.education.filter((_, index) => !skipped.has(`education:${index}`))
  const experiences = material.experiences.filter((_, index) => !skipped.has(`experience:${index}`))
  const labels = new Map((profile?.skills || []).map((name) => [normalizeSkill(name), name]))
  const knownNames = new Map(labels)
  for (const item of student?.skillAssessments || []) {
    const key = normalizeSkill(item.name)
    if (!knownNames.has(key)) knownNames.set(key, item.name)
  }
  const importedSkills = new Map()
  for (const skill of material.skills) {
    const key = normalizeSkill(skill.name)
    if (!key || importedSkills.has(key)) continue
    const name = knownNames.get(key) || skill.name
    importedSkills.set(key, { ...skill, name })
    if (!labels.has(key)) labels.set(key, name)
  }
  const skills = [...labels.values()]
  const newMaterial = { ...material, education, experiences, skills: [...importedSkills.values()] }
  const contactMaterial = [material.otherMaterials, material.email ? `邮箱：${material.email}` : ''].filter(Boolean).join('\n')
  const profileAfter = {
    displayName: profile?.displayName || material.name,
    bio: profile?.bio || material.bio,
    phone: profile?.phone || material.phone,
    education: [...(profile?.education || []), ...education], skills,
    otherMaterials: appendMaterial(profile?.otherMaterials, contactMaterial),
  }
  if (profileAfter.otherMaterials.length > 20000) throw campusError(422, 'IMPORT_MATERIAL_LIMIT', '其他原文材料超过档案容量，请先整理现有材料。')
  const assessments = [...(student?.skillAssessments || [])]
  for (const skill of importedSkills.values()) if (!assessments.some((existing) => normalizeSkill(existing.name) === normalizeSkill(skill.name))) assessments.push({ name: skill.name, evidence: skill.evidence })
  const studentAfter = {
    experiences: [...(student?.experiences || []), ...experiences],
    importedEducation: [...(student?.importedEducation || []), ...education.map((entry) => { const item = { ...entry }; delete item._id; return item })],
    otherMaterials: appendMaterial(student?.otherMaterials, contactMaterial), skillAssessments: assessments,
  }
  if (profileAfter.education.length > 20 || skills.length > 100 || studentAfter.experiences.length > 30 || studentAfter.importedEducation.length > 20 || assessments.length > 50 || studentAfter.otherMaterials.length > 20000) throw campusError(422, 'IMPORT_MATERIAL_LIMIT', '合并后超过档案编辑容量，请保留原有条目或减少本次新增内容，不会截断已有材料。')
  const resumeText = renderImportedResume(newMaterial)
  if (!resumeText.trim() && !resume) throw campusError(422, 'IMPORT_EMPTY', '没有可保存的材料，请继续读取或补充内容。')
  const resumeAfter = {
    originalText: mergeResumeBlanks(resume?.originalText, resumeText),
    preferences: { ...(resume?.preferences || {}), skills: resume?.preferences?.skills?.length ? resume.preferences.skills : skills },
    ...(!resume ? { title: text(resumeTitle).trim() || draft.filename?.replace(/\.[^.]+$/, '') || '导入的简历', enhancedText: null } : {}),
  }
  const writtenAt = new Date()
  return {
    draftId, material: newMaterial, decisions, candidates, resumeId: String(resume?._id || stableImportId(draftId, 'resume')),
    resumeTitle: resume?.title || resumeAfter.title,
    plans: [
      planFor(models.profile, 'profile', profile, { uid: draft.userId }, profileAfter, draftId, writtenAt),
      planFor(models.student, 'student', student, { uid: draft.userId }, studentAfter, draftId, writtenAt),
      planFor(models.resume, 'resume', resume, { userId: draft.userId }, resumeAfter, draftId, writtenAt),
    ],
  }
}
