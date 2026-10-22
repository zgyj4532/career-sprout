const list = (value) => typeof value === 'string' ? value.split(/[，,]/).map((item) => item.trim()).filter(Boolean) : value || []

export function profileFields(profile, skills = profile.skills) {
  return { displayName: profile.displayName || '', location: profile.location || '', bio: profile.bio || '', studyStage: profile.studyStage || '', collegeStudent: profile.collegeStudentKnown ? profile.collegeStudent ?? null : null, skills: list(skills), ...(profile.education ? { education: profile.education.map(withoutIds) } : {}), ...(profile.otherMaterials !== undefined ? { otherMaterials: profile.otherMaterials } : {}) }
}
export function studentFields(student, interests = student.interests) {
  return { interests: list(interests), experiences: (student.experiences || []).map((row) => ({ current: false, useConcise: false, titleIsSourceExcerpt: false, ...withoutIds(row) })), skillAssessments: (student.skillAssessments || []).map(withoutIds), availability: { startDate: null, endDate: null, daysPerWeek: null, ...student.availability }, targetJobId: student.targetJobId ?? null, otherMaterials: student.otherMaterials || '', ...(student.importedEducation ? { importedEducation: student.importedEducation.map(withoutIds) } : {}) }
}
function withoutIds(value) {
  const { _id, ...fields } = value
  return fields
}
function comparable(value) {
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => key !== '_id' && value[key] !== undefined && value[key] !== '').map((key) => [key, comparable(value[key])]))
  return value ?? ''
}
export const sameProfileField = (left, right) => JSON.stringify(comparable(left)) === JSON.stringify(comparable(right))

// Keep unrelated canonical changes. A same-field concurrent edit requires explicit choice.
export function reconcileProfileFields(baseline, local, canonical) {
  const merged = { ...canonical }
  const conflicts = []
  for (const [key, value] of Object.entries(local)) {
    if (sameProfileField(value, baseline[key])) continue
    if (!sameProfileField(canonical[key], baseline[key]) && !sameProfileField(canonical[key], value)) conflicts.push(key)
    merged[key] = value
  }
  return { fields: merged, conflicts, changed: !sameProfileField(merged, canonical) }
}

export function rebaseConfirmedFields(baseline, local, canonical) {
  const next = { ...baseline }
  for (const [key, value] of Object.entries(local)) {
    if (sameProfileField(value, canonical[key])) next[key] = canonical[key]
  }
  return next
}
