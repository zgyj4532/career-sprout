import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import ProfilePage from '../ProfilePage'
import { campusData, campusFetch } from '../../api'
import { materialText } from '../../material'

vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), downloadDiagnostics: vi.fn(), errorText: () => '请求未完成' }))
vi.mock('../../components/SharingControls', () => ({ default: () => null }))
vi.mock('../../components/ImportPanel', () => ({ default: () => null }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
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
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
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
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  await screen.findByDisplayValue('完整经历原文')
  fireEvent.click(screen.getAllByRole('button', { name: '整理这段' })[1])
  fireEvent.click(await screen.findByRole('button', { name: '确认事实，采纳到输入框' }))
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
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  fireEvent.change(await screen.findByLabelText('想法原文'), { target: { value: '想尝试为同学做一个工具' } })
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
  const view = render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  expect(await screen.findByLabelText('背景或想解决什么')).toHaveValue('分组调研')
  fireEvent.change(screen.getByLabelText('你实际做了什么'), { target: { value: '访谈并整理记录' } })
  expect(screen.getByLabelText('实际结果或学到什么')).toHaveValue('整理报告')
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await screen.findByText(/档案与成长材料已保存/)
  view.unmount()
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
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
