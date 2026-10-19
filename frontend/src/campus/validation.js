const FIELD_LABELS = {
  root: '填写内容', interests: '兴趣方向', experiences: '经历', id: '记录', kind: '经历类型', title: '名称', context: '经历背景', actions: '具体行动', result: '实际结果',
  skillAssessments: '技能自评', name: '技能名称', level: '熟练程度', evidence: '证据', availability: '可用时间', startDate: '开始日期', endDate: '结束日期', daysPerWeek: '每周天数',
  targetJobId: '目标岗位', company: '企业', description: '岗位描述', source: '来源', authorKind: '录入身份', requirements: '岗位技能要求', required: '必需技能', status: '发布状态',
  sourceText: '原始材料', jobId: '岗位', draft: '简历草稿', revision: '版本', teacherId: '教师', targetIds: '导出版本', displayName: '姓名', studyStage: '年级',
  education: '教育经历', institution: '学校', degree: '学历', field: '专业', startYear: '开始年份', endYear: '结束年份', skills: '技能标签', bio: '简介', jobRole: '岗位方向', location: '所在地',
  originalText: '简历正文', enhancedText: '润色正文', preferences: '偏好', industry: '行业', questionId: '题目', transcript: '回答文字', duration: '录音时长', mode: '练习类型', language: '语言', questionCount: '题数',
}
const CODES = new Set(['invalid_type', 'invalid_value', 'invalid_format', 'too_small', 'too_big', 'not_multiple_of', 'unrecognized_keys', 'invalid_union', 'invalid_key', 'invalid_element', 'custom'])

export function safeValidationDetails(details) {
  if (!Array.isArray(details)) return []
  return details.slice(0, 12).flatMap((detail) => {
    if (typeof detail?.field !== 'string' || detail.field.length > 120 || !CODES.has(detail.code)) return []
    const parts = detail.field.split('.')
    if (parts.length > 6 || !parts.every((part) => Object.hasOwn(FIELD_LABELS, part) || /^\d{1,3}$/.test(part))) return []
    return [{ field: detail.field, code: detail.code }]
  })
}

export function validationCorrection(detail) {
  const parts = detail.field.split('.')
  const label = parts.map((part) => Object.hasOwn(FIELD_LABELS, part) ? FIELD_LABELS[part] : `第 ${Number(part) + 1} 项`).join(' · ')
  let correction = '请检查填写格式与可选范围。'
  if (detail.code === 'too_small') correction = '请补充必填内容，或检查最小值。'
  if (detail.code === 'too_big') correction = '请缩短内容，或减少数量至允许范围。'
  if (detail.code === 'custom' && ['skillAssessments', 'requirements'].includes(detail.field)) correction = '技能名称不能重复，请合并重复项。'
  else if (detail.code === 'custom' && parts[0] === 'availability') correction = '请检查日期是否有效，开始日期不能晚于结束日期。'
  if (detail.code === 'unrecognized_keys') correction = '表单包含不支持的字段，请保留输入并联系维护者。'
  return `${label}：${correction}`
}
