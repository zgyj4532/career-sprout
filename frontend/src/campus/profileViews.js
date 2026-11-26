export const PROFILE_VIEWS = {
  personal: { label: '个人档案', description: '填写基本档案、教育经历和可实习时间。' },
  experiences: { label: '经历与想法', description: '分开记录想法、正在做的事和已完成的经历。' },
  skills: { label: '技能与其他材料', description: '记录技能证据和其他材料；未自评的技能保持未知。' },
  materials: { label: '导入与授权', description: '导入已有简历、查看班级辅导，并管理教师授权。' },
}

export function parseProfileView(params) {
  const views = params.getAll('view')
  if (views.length === 0) return 'personal'
  return views.length === 1 && views[0] !== 'personal' && Object.hasOwn(PROFILE_VIEWS, views[0]) ? views[0] : null
}

export function profileViewDestination({ pathname, search, hash }, view, { clearPanel = false } = {}) {
  const params = new URLSearchParams(search)
  if (view === 'personal') params.delete('view')
  else params.set('view', view)
  if (clearPanel) params.delete('panel')
  return { pathname, search: params.toString(), hash }
}
