import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import ProfilePage from '../ProfilePage'
import { campusData, campusFetch } from '../../api'
import UnsavedWorkProvider from '../../components/UnsavedWorkProvider'
import { materialText } from '../../material'

vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), downloadDiagnostics: vi.fn(), errorText: () => '请求未完成' }))
vi.mock('../../components/SharingControls', () => ({ default: () => null }))
vi.mock('../../components/ImportPanel', () => ({ default: () => null }))
let router
afterEach(() => { cleanup(); router?.dispose(); router = undefined; vi.clearAllMocks(); vi.unstubAllGlobals() })

function renderGuardedProfile(initialEntry = '/profile') {
  router = createMemoryRouter([
    { path: '/profile', element: <UnsavedWorkProvider><ProfilePage /></UnsavedWorkProvider> },
  ], { initialEntries: [initialEntry] })
  return render(<RouterProvider router={router} />)
}

it('sends an explicit blank stage when clearing a previously saved year and reloads it', async () => {
  let profile = { displayName: '测试学生', studyStage: '大三', location: '', bio: '', skills: [] }
  const student = { interests: [], experiences: [], skillAssessments: [], availability: {}, targetJobId: null }
  campusData.mockImplementation(async () => ({ profile, student }))
  campusFetch.mockImplementation(async (path, options) => {
    expect(path).toBe('/api/user-profiles/me')
    profile = { ...profile, ...JSON.parse(options.body) }
    return { profile }
  })
  const view = render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  const stage = await screen.findByLabelText('年级')
  expect(stage).toHaveValue('大三')
  fireEvent.change(stage, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await waitFor(() => expect(campusFetch).toHaveBeenCalledOnce())
  expect(JSON.parse(campusFetch.mock.calls[0][1].body).studyStage).toBe('')
  await screen.findByText(/档案与成长材料已保存/)
  view.unmount()
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  expect(await screen.findByLabelText('年级')).toHaveValue('')
})

it('keeps imported skill proficiency unknown until explicitly assessed', async () => {
  const profile = { displayName: '', studyStage: '', location: '', bio: '', skills: ['写作'] }
  let student = { interests: [], experiences: [], skillAssessments: [{ name: '写作', evidence: '参与课程写作' }], availability: {}, targetJobId: null }
  campusFetch.mockResolvedValue({ success: true })
  campusData.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') student = JSON.parse(options.body)
    return { profile, student }
  })
  render(<MemoryRouter initialEntries={['/profile?view=skills']}><ProfilePage /></MemoryRouter>)
  const level = await screen.findByLabelText('目前程度')
  fireEvent.click(screen.getByText(/技能自评与证据（1 项）/))
  expect(level).toHaveValue('')
  expect(materialText({ profile, student })).toContain('写作（自评：未自评）')
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(student.skillAssessments[0]).not.toHaveProperty('level')
  fireEvent.change(level, { target: { value: '2' } })
  fireEvent.change(level, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await waitFor(() => expect(student.skillAssessments[0].level).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: '添加一项自评' }))
  expect(screen.getAllByLabelText('目前程度')[1]).toHaveValue('')
})

it.each([{ importedEducation: [] }, { importedEducation: [{ id: 'imported', institution: '导入学校' }] }])('preserves all canonical education when the imported extension is only a subset', async ({ importedEducation }) => {
  const profile = { displayName: '', skills: [], education: [{ id: 'old', institution: '原有学校' }, { id: 'imported', institution: '导入学校' }] }
  let student = { interests: [], experiences: [], skillAssessments: [], availability: {}, importedEducation }
  campusFetch.mockResolvedValue({ success: true })
  campusData.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') student = JSON.parse(options.body)
    return { profile, student }
  })
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  expect(await screen.findByDisplayValue('原有学校')).toBeInTheDocument()
  fireEvent.change(screen.getByDisplayValue('导入学校'), { target: { value: '核对后的学校' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(student.importedEducation.map((row) => row.institution)).toEqual(['原有学校', '核对后的学校'])
  expect(JSON.parse(campusFetch.mock.calls[0][1].body).education.map((row) => row.institution)).toEqual(['原有学校', '核对后的学校'])
})

it('explicitly adopts a polished brief while retaining full text for later editing', async () => {
  const profile = { displayName: '', skills: [] }
  let student = { interests: [], experiences: [{ id: 'exp', kind: 'project', title: '真实项目', context: '', actions: '', result: '', fullText: '完整经历原文' }], skillAssessments: [], availability: {} }
  campusFetch.mockResolvedValue({ success: true })
  campusData.mockImplementation(async (path, options) => {
    if (path === '/resumes/polish') return { draft: '精简后的真实经历', changes: [], questions: [] }
    if (options?.method === 'PUT') student = JSON.parse(options.body)
    return { profile, student }
  })
  render(<MemoryRouter initialEntries={['/profile?view=experiences']}><ProfilePage /></MemoryRouter>)
  await screen.findByDisplayValue('完整经历原文')
  fireEvent.click(screen.getByRole('button', { name: '整理这段' }))
  fireEvent.click(await screen.findByRole('button', { name: '确认事实，采纳到输入框' }))
  fireEvent.click(screen.getByText('精简稿 · 简历和面试采用此稿', { selector: 'summary' }))
  expect(screen.getByLabelText('在简历与面试中使用精简稿（完整经历仍保留）')).toBeChecked()
  expect(screen.getByLabelText('完整经历（不会被精简稿替换）')).toHaveValue('完整经历原文')
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(student.experiences[0]).toMatchObject({ fullText: '完整经历原文', brief: '精简后的真实经历', useConcise: true })
  expect(materialText({ profile, student })).toContain('精简后的真实经历')
  expect(materialText({ profile, student })).not.toContain('完整经历原文')
  student.experiences[0].useConcise = false
  expect(materialText({ profile, student })).toContain('完整经历原文')
})

it('preserves confirmed idea provenance and uses both loaded comparison tokens', async () => {
  const profile = { displayName: '', skills: [], collegeStudentKnown: false, collegeStudent: null, updatedAt: '2026-10-21T01:00:00.000Z' }
  let student = { interests: ['校园工具'], experiences: [{ id: 'idea', kind: 'project', title: '工具设想', state: 'idea', fullText: '想做一款工具', sourceConversationId: 'conversation', sourceQuestionId: 'question', dateText: '尚未开始' }], skillAssessments: [], availability: {}, updatedAt: '2026-10-21T02:00:00.000Z' }
  campusData.mockImplementation(async (_path, options) => { if (options?.method === 'PUT') student = JSON.parse(options.body); return { profile, student } })
  campusFetch.mockResolvedValue({ profile: { ...profile, updatedAt: '2026-10-21T03:00:00.000Z' } })
  renderGuardedProfile()
  fireEvent.click(screen.getByRole('link', { name: '经历与想法' }))
  fireEvent.change(await screen.findByLabelText('想法原文'), { target: { value: '想尝试为同学做一个工具' } })
  fireEvent.click(screen.getByRole('link', { name: '个人档案' }))
  fireEvent.change(screen.getByLabelText('简介'), { target: { value: '补充简介' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(JSON.parse(campusFetch.mock.calls[0][1].body).expectedUpdatedAt).toBe(profile.updatedAt)
  expect(student.expectedUpdatedAt).toBe('2026-10-21T02:00:00.000Z')
  expect(student).not.toHaveProperty('updatedAt')
  expect(student.experiences[0]).toMatchObject({ state: 'idea', fullText: '想尝试为同学做一个工具', sourceConversationId: 'conversation', sourceQuestionId: 'question', dateText: '尚未开始' })
  expect(materialText({ profile, student })).not.toContain('想尝试为同学做一个工具')
})

it('keeps persisted structured experiences editable when the model supplies empty fullText', async () => {
  const profile = { displayName: '', skills: [] }
  let student = { interests: [], experiences: [{ id: 'manual', kind: 'course', title: '课堂任务', fullText: '', context: '分组调研', actions: '访谈同学', result: '整理报告' }], skillAssessments: [], availability: {} }
  campusData.mockImplementation(async (_path, options) => { if (options?.method === 'PUT') student = JSON.parse(options.body); return { profile, student } })
  campusFetch.mockResolvedValue({ profile })
  const view = render(<MemoryRouter initialEntries={['/profile?view=experiences']}><ProfilePage /></MemoryRouter>)
  expect(await screen.findByLabelText('背景或想解决什么')).toHaveValue('分组调研')
  fireEvent.change(screen.getByLabelText('你实际做了什么'), { target: { value: '访谈并整理记录' } })
  expect(screen.getByLabelText('实际结果或学到什么')).toHaveValue('整理报告')
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  view.unmount()
  render(<MemoryRouter initialEntries={['/profile?view=experiences']}><ProfilePage /></MemoryRouter>)
  expect(await screen.findByLabelText('你实际做了什么')).toHaveValue('访谈并整理记录')
  expect(screen.getByLabelText('背景或想解决什么')).toHaveValue('分组调研')
  expect(screen.getByLabelText('实际结果或学到什么')).toHaveValue('整理报告')
})

it.each(['profile', 'student'])('reconciles a committed %s write with a lost response and only retries unfinished work', async (lostTarget) => {
  let profile = { displayName: '', skills: [], bio: '', updatedAt: '2026-10-21T01:00:00.000Z' }
  let student = { interests: [], experiences: [], skillAssessments: [], availability: {}, updatedAt: '2026-10-21T01:00:00.000Z' }
  let profileWrites = 0
  let studentWrites = 0
  campusFetch.mockImplementation(async (_path, options) => {
    profileWrites += 1
    const { expectedUpdatedAt, ...fields } = JSON.parse(options.body)
    expect(expectedUpdatedAt).toBe(profile.updatedAt)
    profile = { ...profile, ...fields, updatedAt: '2026-10-21T02:00:00.000Z' }
    if (lostTarget === 'profile' && profileWrites === 1) throw { code: 'NETWORK_ERROR' }
    return { profile }
  })
  campusData.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') {
      studentWrites += 1
      const { expectedUpdatedAt, ...fields } = JSON.parse(options.body)
      expect(expectedUpdatedAt).toBe(student.updatedAt)
      student = { ...student, ...fields, updatedAt: '2026-10-21T02:00:00.000Z' }
      if (lostTarget === 'student' && studentWrites === 1) throw { code: 'NETWORK_ERROR' }
    }
    return { profile, student }
  })
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  fireEvent.change(await screen.findByLabelText('简介'), { target: { value: '本地简介' } })
  fireEvent.change(screen.getByLabelText('感兴趣的方向（逗号分隔）'), { target: { value: '调研' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText('请求未完成')
  await waitFor(() => expect(screen.getByLabelText('简介')).toBeEnabled())
  expect(screen.getByLabelText('简介')).toHaveValue('本地简介')
  expect(screen.getByLabelText('感兴趣的方向（逗号分隔）')).toHaveValue('调研')
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(profileWrites).toBe(1)
  expect(studentWrites).toBe(1)
  expect(student.interests).toEqual(['调研'])
})

it('keeps explicit unknown attendance while saving an unrelated biography with an existing year', async () => {
  let profile = { displayName: '', bio: '', skills: [], studyStage: '大三', collegeStudent: null, collegeStudentKnown: false }
  const student = { interests: [], experiences: [], skillAssessments: [], availability: {} }
  campusData.mockImplementation(async () => ({ profile, student }))
  campusFetch.mockImplementation(async (_path, options) => { const body = JSON.parse(options.body); profile = { ...profile, ...body, collegeStudentKnown: body.collegeStudent !== null }; return { profile } })
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  fireEvent.change(await screen.findByLabelText('简介'), { target: { value: '只修改简介' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(JSON.parse(campusFetch.mock.calls[0][1].body)).toMatchObject({ collegeStudent: null, studyStage: '大三' })
  expect(profile.collegeStudentKnown).toBe(false)
})

it('preserves local growth edits through a concurrent conflict and never silently replaces the newer value', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const profile = { displayName: '', skills: [] }
  let student = { interests: ['原兴趣'], experiences: [], skillAssessments: [], availability: {}, updatedAt: '2026-10-21T01:00:00.000Z' }
  campusData.mockImplementation(async (_path, options) => { if (options?.method === 'PUT') student = { ...JSON.parse(options.body), updatedAt: '2026-10-21T03:00:00.000Z' }; return { profile, student } })
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  fireEvent.change(await screen.findByLabelText('感兴趣的方向（逗号分隔）'), { target: { value: '本地兴趣' } })
  student = { ...student, interests: ['其他页面兴趣'], updatedAt: '2026-10-21T02:00:00.000Z' }
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
  expect(student.interests).toEqual(['其他页面兴趣'])
  expect(screen.getByLabelText('感兴趣的方向（逗号分隔）')).toHaveValue('本地兴趣')
  confirm.mockReturnValue(true)
  await waitFor(() => expect(screen.getByLabelText('感兴趣的方向（逗号分隔）')).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(student.interests).toEqual(['本地兴趣'])
  expect(student.expectedUpdatedAt).toBe('2026-10-21T02:00:00.000Z')
  confirm.mockRestore()
})

it('retries only the uncommitted student education mirror after profile education commits', async () => {
  let profile = { displayName: '', skills: [], education: [{ id: 'school', institution: '旧学校' }], updatedAt: 'p1' }
  let student = { interests: [], experiences: [], skillAssessments: [], availability: {}, importedEducation: [{ id: 'school', institution: '旧学校' }], updatedAt: 's1' }
  let studentWrites = 0
  campusFetch.mockImplementation(async (_path, options) => { profile = { ...profile, ...JSON.parse(options.body), updatedAt: 'p2' }; return { profile } })
  campusData.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') {
      if (++studentWrites === 1) throw { status: 503 }
      student = { ...student, ...JSON.parse(options.body), updatedAt: 's2' }
    }
    return { profile, student }
  })
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  fireEvent.change(await screen.findByDisplayValue('旧学校'), { target: { value: '新学校' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText('请求未完成')
  await waitFor(() => expect(screen.getByLabelText('学校')).toBeEnabled())
  expect(profile.education[0].institution).toBe('新学校')
  expect(student.importedEducation[0].institution).toBe('旧学校')
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(student.importedEducation[0].institution).toBe('新学校')
  expect(studentWrites).toBe(2)
  expect(campusFetch).toHaveBeenCalledTimes(1)
})

it('preserves concurrently changed student education during an unrelated local interest edit', async () => {
  const profile = { displayName: '', skills: [], education: [{ institution: '档案学校' }] }
  let student = { interests: [], experiences: [], skillAssessments: [], availability: {}, importedEducation: [{ institution: '原成长学校' }], updatedAt: 's1' }
  campusData.mockImplementation(async (_path, options) => { if (options?.method === 'PUT') student = { ...student, ...JSON.parse(options.body) }; return { profile, student } })
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  fireEvent.change(await screen.findByLabelText('感兴趣的方向（逗号分隔）'), { target: { value: '调研' } })
  student = { ...student, importedEducation: [{ institution: '其他页面的新学校' }], updatedAt: 's2' }
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(student.importedEducation).toEqual([{ institution: '其他页面的新学校' }])
  expect(student.interests).toEqual(['调研'])
})

it('persists an intentional return to the original biography after a lost response confirmed its replacement', async () => {
  let profile = { displayName: '', skills: [], bio: '原简介A', updatedAt: 'p1' }
  let student = { interests: [], experiences: [], skillAssessments: [], availability: {}, updatedAt: 's1' }
  let profileWrites = 0
  campusFetch.mockImplementation(async (_path, options) => {
    profile = { ...profile, ...JSON.parse(options.body), updatedAt: `p${++profileWrites + 1}` }
    if (profileWrites === 1) throw { status: 0, code: 'NETWORK_ERROR' }
    return { profile }
  })
  campusData.mockImplementation(async (_path, options) => { if (options?.method === 'PUT') student = { ...student, ...JSON.parse(options.body), updatedAt: 's2' }; return { profile, student } })
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  fireEvent.change(await screen.findByLabelText('简介'), { target: { value: '提交简介B' } })
  fireEvent.change(screen.getByLabelText('感兴趣的方向（逗号分隔）'), { target: { value: '调研' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText('请求未完成')
  await waitFor(() => expect(screen.getByLabelText('简介')).toBeEnabled())
  expect(profile.bio).toBe('提交简介B')
  fireEvent.change(screen.getByLabelText('简介'), { target: { value: '原简介A' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(profile.bio).toBe('原简介A')
  expect(profileWrites).toBe(2)
  expect(student.interests).toEqual(['调研'])
  expect(screen.getByLabelText('简介')).toHaveValue('原简介A')
})

it('freezes a lost profile save through failed recovery reads and rebases before further edits', async () => {
  let profile = { displayName: '', skills: [], bio: '原简介A', updatedAt: 'p1' }
  let student = { interests: [], experiences: [], skillAssessments: [], availability: {}, updatedAt: 's1' }
  let recoveryUnavailable = false
  let profileWrites = 0
  campusFetch.mockImplementation(async (_path, options) => {
    profile = { ...profile, ...JSON.parse(options.body), updatedAt: `p${++profileWrites + 1}` }
    if (profileWrites === 1) { recoveryUnavailable = true; throw { status: 0, code: 'NETWORK_ERROR' } }
    return { profile }
  })
  campusData.mockImplementation(async (_path, options) => {
    if (recoveryUnavailable) throw { status: 503 }
    if (options?.method === 'PUT') student = { ...student, ...JSON.parse(options.body), updatedAt: 's2' }
    return { profile, student }
  })
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  fireEvent.change(await screen.findByLabelText('简介'), { target: { value: '提交简介B' } })
  fireEvent.change(screen.getByLabelText('感兴趣的方向（逗号分隔）'), { target: { value: '调研' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  const recover = await screen.findByRole('button', { name: '检查档案保存结果' })
  await waitFor(() => expect(recover).toBeEnabled())
  expect(screen.getByLabelText('简介')).toBeDisabled()
  expect(screen.getByLabelText('简介')).toHaveValue('提交简介B')
  fireEvent.click(recover)
  await waitFor(() => expect(recover).toBeEnabled())
  expect(screen.getByLabelText('简介')).toBeDisabled()
  expect(profileWrites).toBe(1)
  recoveryUnavailable = false
  fireEvent.click(recover)
  await waitFor(() => expect(screen.getByLabelText('简介')).toBeEnabled())
  expect(profileWrites).toBe(1)
  fireEvent.change(screen.getByLabelText('简介'), { target: { value: '原简介A' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(profile.bio).toBe('原简介A')
  expect(student.interests).toEqual(['调研'])
  expect(profileWrites).toBe(2)
})

it('reveals and focuses an invalid skill from another view, then saves edits from both views', async () => {
  let profile = { displayName: '原姓名', skills: [] }
  let student = { interests: [], experiences: [], skillAssessments: [], availability: {} }
  campusData.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') student = { ...student, ...JSON.parse(options.body) }
    return { profile, student }
  })
  campusFetch.mockImplementation(async (_path, options) => {
    profile = { ...profile, ...JSON.parse(options.body) }
    return { profile }
  })
  renderGuardedProfile()
  fireEvent.change(await screen.findByRole('textbox', { name: '姓名' }), { target: { value: '新姓名' } })
  fireEvent.click(screen.getByRole('link', { name: '技能与其他材料' }))
  fireEvent.click(screen.getByText('技能自评与证据（0 项）'))
  fireEvent.click(screen.getByRole('button', { name: '添加一项自评' }))
  fireEvent.click(screen.getByText('技能自评与证据（1 项）'))
  fireEvent.click(screen.getByRole('link', { name: '个人档案' }))
  expect(screen.queryByRole('textbox', { name: '技能名称' })).not.toBeInTheDocument()
  const readsBeforeSave = campusData.mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))

  const skill = await screen.findByRole('textbox', { name: '技能名称' })
  expect(screen.getByRole('link', { name: '技能与其他材料' })).toHaveAttribute('aria-current', 'page')
  expect(skill).toBeVisible()
  expect(skill).toHaveFocus()
  expect(campusData).toHaveBeenCalledTimes(readsBeforeSave)
  expect(campusFetch).not.toHaveBeenCalled()

  fireEvent.change(skill, { target: { value: '调研' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(profile.displayName).toBe('新姓名')
  expect(student.skillAssessments).toEqual([{ name: '调研', level: null, evidence: '' }])
})

function renderMobileProfile(profile, student, initialEntry = '/profile') {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  campusData.mockImplementation(async (path, options) => {
    if (path !== '/me') return []
    if (options?.method === 'PUT') student = { ...student, ...JSON.parse(options.body) }
    return { profile, student }
  })
  campusFetch.mockImplementation(async (_path, options) => {
    profile = { ...profile, ...JSON.parse(options.body) }
    return { profile }
  })
  renderGuardedProfile(initialEntry)
}

it('opens only one experience and preserves its draft through Back and Forward', async () => {
  const experiences = [
    { id: 'first', kind: 'course', title: '课程调研' },
    { id: 'second', kind: 'project', title: '求职工具' },
  ]
  renderMobileProfile({ skills: [] }, { experiences }, '/profile?source=resume&view=experiences#draft')
  fireEvent.click(await screen.findByRole('link', { name: '课程调研' }))
  expect(screen.getByRole('heading', { name: '课程调研' })).toHaveFocus()
  expect(screen.queryByRole('navigation', { name: '档案页面' })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '名称' })).toHaveValue('课程调研')
  expect(screen.getByDisplayValue('求职工具')).not.toBeVisible()
  fireEvent.change(screen.getByRole('textbox', { name: '名称' }), { target: { value: '课程访谈' } })
  await act(() => router.navigate(-1))
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  expect(screen.getByRole('link', { name: '课程访谈' })).toBeVisible()
  expect(screen.queryByRole('link', { name: '工作台菜单' })).not.toBeInTheDocument()
  await act(() => router.navigate(1))
  expect(screen.getByRole('textbox', { name: '名称' })).toHaveValue('课程访谈')
  expect(router.state.location).toMatchObject({ search: '?source=resume&view=experiences&panel=experience%3Afirst', hash: '#draft' })
  fireEvent.click(screen.getByRole('link', { name: '返回经历与想法' }))
  fireEvent.click(screen.getByRole('link', { name: '个人档案' }))
  expect(screen.getByRole('link', { name: '工作台菜单' })).toHaveAttribute('href', '/workspace-menu')
  expect(router.state.location).toMatchObject({ search: '?source=resume', hash: '#draft' })
})

it('opens and focuses an invalid mobile panel before saving the shared draft', async () => {
  renderMobileProfile({ displayName: '原姓名', skills: [] }, {}, '/profile?view=skills&panel=assessment')
  fireEvent.click(await screen.findByRole('button', { name: '添加一项自评' }))
  const skill = screen.getByRole('textbox', { name: '技能名称' })
  fireEvent.click(screen.getByRole('link', { name: '返回技能与其他材料' }))
  fireEvent.click(screen.getByRole('link', { name: '个人档案' }))
  fireEvent.click(screen.getByRole('link', { name: '基本档案' }))
  fireEvent.change(screen.getByRole('textbox', { name: '姓名' }), { target: { value: '新姓名' } })
  const readsBeforeSave = campusData.mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  expect(router.state.location.search).toBe('?view=skills&panel=assessment')
  expect(skill).toBeVisible()
  expect(skill).toHaveFocus()
  expect(campusData).toHaveBeenCalledTimes(readsBeforeSave)
  expect(campusFetch).not.toHaveBeenCalled()

  fireEvent.change(skill, { target: { value: '调研' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(JSON.parse(campusFetch.mock.calls[0][1].body).displayName).toBe('新姓名')
  const [, write] = campusData.mock.calls.find(([, options]) => options?.method === 'PUT')
  expect(JSON.parse(write.body).skillAssessments).toEqual([{ name: '调研', level: null, evidence: '' }])
})

it('opens the exact incomplete experience when saving from a different record', async () => {
  renderMobileProfile({ skills: [] }, { experiences: [{ id: 'first', kind: 'course', title: '课程调研' }] }, '/profile?view=experiences')
  fireEvent.click(await screen.findByRole('button', { name: '添加课程、社团或项目经历' }))
  const newRecordSearch = router.state.location.search
  const incomplete = screen.getByRole('textbox', { name: '名称' })
  expect(incomplete).toHaveValue('')
  fireEvent.click(screen.getByRole('link', { name: '返回经历与想法' }))
  fireEvent.click(screen.getByRole('link', { name: '课程调研' }))
  expect(incomplete).not.toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  expect(router.state.location.search).toBe(newRecordSearch)
  expect(incomplete).toBeVisible()
  expect(incomplete).toHaveFocus()
  expect(campusData.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
})

it.each([
  ['/profile?source=resume&view=unknown&panel=assessment#draft', '?source=resume'],
  ['/profile?source=resume&view=skills&panel=basics&panel=tags#draft', '?source=resume&view=skills'],
])('normalizes malformed mobile Profile entries before editing (%s)', async (entry, search) => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  try {
    renderMobileProfile({ displayName: '原姓名', skills: [] }, {}, entry)
    await waitFor(() => expect(router.state.location).toMatchObject({ search, hash: '#draft' }))
    if (search.includes('view=')) fireEvent.click(screen.getByRole('link', { name: '个人档案' }))
    fireEvent.click(screen.getByRole('link', { name: '基本档案' }))
    fireEvent.change(await screen.findByRole('textbox', { name: '姓名' }), { target: { value: '未保存姓名' } })
    fireEvent.click(screen.getByRole('link', { name: '返回个人档案' }))
    fireEvent.click(screen.getByRole('link', { name: '可实习时间' }))
    expect(router.state.location).toMatchObject({ search: '?source=resume&panel=availability', hash: '#draft' })
    expect(confirm).not.toHaveBeenCalled()
  } finally { confirm.mockRestore() }
})

it('reveals the actionable availability field after a confirmed server validation rejection', async () => {
  let profile = { displayName: '原姓名', skills: [] }
  const student = { availability: { startDate: '2026-12-20', endDate: '2026-12-01' } }
  renderMobileProfile(profile, student, '/profile?panel=basics')
  campusFetch.mockImplementation(async (_path, options) => {
    profile = { ...profile, ...JSON.parse(options.body) }
    return { profile }
  })
  campusData.mockImplementation(async (path, options) => {
    if (path !== '/me') return []
    if (options?.method === 'PUT' && JSON.parse(options.body).availability.endDate === '2026-12-01') {
      throw { code: 'VALIDATION_FAILED', details: [{ field: 'availability', code: 'custom', message: 'PRIVATE' }] }
    }
    if (options?.method === 'PUT') Object.assign(student, JSON.parse(options.body))
    return { profile, student }
  })
  fireEvent.change(await screen.findByRole('textbox', { name: '姓名' }), { target: { value: '新姓名' } })
  fireEvent.change(screen.getByLabelText('感兴趣的方向（逗号分隔）'), { target: { value: '调研' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await waitFor(() => expect(router.state.location.search).toBe('?panel=availability'))
  expect(screen.getByLabelText('可持续到')).toHaveFocus()
  expect(screen.getByLabelText('可持续到')).toHaveValue('2026-12-01')
  expect(screen.getByRole('alert')).toHaveTextContent('开始日期不能晚于结束日期')
  expect(screen.queryByText('PRIVATE')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '检查档案保存结果' })).not.toBeInTheDocument()
  expect(campusData.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1)

  fireEvent.change(screen.getByLabelText('可持续到'), { target: { value: '2026-12-25' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  expect(campusFetch).toHaveBeenCalledOnce()
  expect(profile.displayName).toBe('新姓名')
  expect(student.interests).toEqual(['调研'])
})
