export const STUDY_STAGES = ['大一', '大二', '大三', '大四', '已毕业']
export const SKILL_LEVELS = ['没接触', '学过', '做过', '能独立完成']
export const EXPERIENCE_KINDS = { course: '课程', club: '社团', project: '项目', internship: '实习', other: '其他' }
export const EMPTY_STUDENT = { interests: [], experiences: [], skillAssessments: [], availability: { startDate: null, endDate: null, daysPerWeek: null }, targetJobId: null }
export function materialText({ profile = {}, student = EMPTY_STUDENT } = {}) {
  return [profile.displayName, profile.studyStage, profile.bio,
    ...(profile.education || []).map((item) => [item.institution, item.degree, item.field].filter(Boolean).join(' · ')),
    student.interests?.length ? `感兴趣的方向：${student.interests.join('、')}` : '',
    ...(student.experiences || []).map((item) => [item.title, item.context, item.actions, item.result].filter(Boolean).join('\n')),
    ...(student.skillAssessments || []).map((item) => `${item.name}（自评：${SKILL_LEVELS[item.level]}）${item.evidence ? `：${item.evidence}` : ''}`),
  ].filter(Boolean).join('\n\n')
}
export const TIME_LABELS = { covered: '时间符合要求', conflict: '时间存在冲突', unknown: '时间待确认' }
