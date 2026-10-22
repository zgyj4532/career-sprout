export const STUDY_STAGES = ['大一', '大二', '大三', '大四', '已毕业']
export const SKILL_LEVELS = ['没接触', '学过', '做过', '能独立完成']
export const EXPERIENCE_KINDS = { course: '课程', club: '社团', project: '项目', internship: '实习', other: '其他' }
export const EMPTY_STUDENT = { interests: [], experiences: [], skillAssessments: [], availability: { startDate: null, endDate: null, daysPerWeek: null }, targetJobId: null }

function renderEntry(body = '', facts = []) {
  let represented = body.replace(/\s+/gu, '')
  const missing = []
  for (const fact of facts) {
    const normalized = (fact || '').replace(/\s+/gu, '')
    if (!normalized || represented.includes(normalized)) continue
    missing.push(fact)
    represented += `\n${normalized}`
  }
  return [...missing, body].filter(Boolean).join('\n')
}

function renderOtherMaterial(value = '') {
  return value.split(/\r?\n/).filter((line) => !/^\s*(?:#{1,6}\s*)?(?:教育经历|教育背景|实习经历|项目经历|工作经历|工作经验|技能|专业技能)[：:\s]*$/.test(line)).join('\n').trim()
}

export function materialText({ profile = {}, student = EMPTY_STUDENT } = {}, { includeIdeas = false } = {}) {
  return [profile.displayName, profile.studyStage, profile.bio,
    ...(profile.education || student.importedEducation || []).map((item) => renderEntry(item.fullText, [item.institution, item.degree, item.field, item.dateText, item.current ? '至今' : ''])),
    profile.skills?.length ? `技能标签：${profile.skills.join('、')}` : '',
    ...[...new Set([profile.otherMaterials, student.otherMaterials].filter(Boolean).map(renderOtherMaterial))],
    student.interests?.length ? `感兴趣的方向：${student.interests.join('、')}` : '',
    ...(student.experiences || []).filter((item) => includeIdeas || item.state !== 'idea').map((item) => renderEntry(item.useConcise && item.brief ? item.brief : item.fullText || [item.context, item.actions, item.result].filter(Boolean).join('\n'), [item.state === 'idea' ? '想法，尚未开始；不是已完成经历或技能证据' : item.state === 'in_progress' ? '正在进行，尚未完成' : '', item.title, item.organization, item.dateText, item.current ? '至今' : ''])),
    ...(student.skillAssessments || []).map((item) => `${item.name}（自评：${SKILL_LEVELS[item.level] ?? '未自评'}）${item.evidence ? `：${item.evidence}` : ''}`),
  ].filter(Boolean).join('\n\n')
}
export const TIME_LABELS = { covered: '时间符合要求', conflict: '时间存在冲突', unknown: '时间待确认' }
