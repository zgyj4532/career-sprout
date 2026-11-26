import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Link, Route, RouterProvider, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import ProfilePage from '../ProfilePage'
import { campusData, campusFetch } from '../../api'
import UnsavedWorkProvider from '../../components/UnsavedWorkProvider'

vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), downloadBlob: vi.fn(), downloadDiagnostics: vi.fn(), errorText: (error) => error?.message }))
let router
afterEach(() => { cleanup(); router?.dispose(); vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllGlobals() })

const student = { interests: [], experiences: [], skillAssessments: [], availability: {} }
const profile = { displayName: '原姓名', skills: [] }
const draft = { id: 'draft', status: 'ready', resumeId: 'resume', resumeTitle: '确认简历', resumeChoices: [{ id: 'resume', title: '确认简历' }], issues: [], candidates: [], result: { name: '导入姓名', education: [], experiences: [], skills: [], otherMaterials: '' } }
const saveImport = '确认导入档案并更新《确认简历》'

function mockProfileRequests(readProfile) {
  campusData.mockImplementation(async (path) => {
    if (path === '/imports') return { items: [draft] }
    if (path === '/imports/draft') return draft
    if (['/me/classes', '/me/guidance', '/teachers', '/me/sharing'].includes(path)) return []
    if (path === '/me') return readProfile()
    throw new Error(path)
  })
}

function renderProfile(initialEntry) {
  router = createMemoryRouter([{ path: '*', element: <UnsavedWorkProvider>
    <Link to="/resume">离开档案</Link>
    <Routes>
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/resume" element={<h1>简历页面</h1>} />
    </Routes>
  </UnsavedWorkProvider> }], { initialEntries: ['/resume', initialEntry] })
  render(<RouterProvider router={router} />)
}

function switchView(name) {
  fireEvent.click(screen.getByRole('link', { name }))
  return screen.findByRole('heading', { level: 1, name })
}

function historyMove(delta) {
  return act(async () => { await router.navigate(delta) })
}

it('locks the visible profile inputs during import confirmation and the following refresh', async () => {
  let finishSave
  let finishRefresh
  let profileReads = 0
  mockProfileRequests(() => {
    profileReads += 1
    if (profileReads === 1) return { profile, student }
    return new Promise((resolve) => { finishRefresh = resolve })
  })
  campusFetch.mockImplementation(() => new Promise((resolve) => { finishSave = resolve }))
  renderProfile('/profile?view=materials')
  expect(screen.getByRole('heading', { level: 1, name: '导入与授权' })).toBeVisible()
  expect(screen.queryByRole('region', { name: '档案编辑' })).not.toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: '确认简历 · ready' }))
  fireEvent.click(await screen.findByRole('button', { name: saveImport }))
  await switchView('个人档案')
  const input = await screen.findByRole('textbox', { name: '姓名' })
  expect(input).toBeVisible()
  expect(input).toBeDisabled()
  await act(async () => finishSave({ saved: true, data: { ...draft, saved: true, status: 'saved' } }))
  await waitFor(() => expect(profileReads).toBe(2))
  expect(input).toBeDisabled()
  await act(async () => finishRefresh({ profile: { displayName: '已保存姓名', skills: [] }, student }))
  await waitFor(() => expect(input).toBeEnabled())
  expect(input).toHaveValue('已保存姓名')
  fireEvent.change(input, { target: { value: '刷新后的新编辑' } })
  expect(input).toHaveValue('刷新后的新编辑')
})

it('preserves both drafts across dirty view switches while preventing import writes and guarding actual leave', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  mockProfileRequests(() => ({ profile, student }))
  renderProfile('/profile/?source=resume&source=upload#draft')

  const name = await screen.findByRole('textbox', { name: '姓名' })
  expect(screen.queryByRole('region', { name: '导入与授权管理' })).not.toBeInTheDocument()
  await switchView('导入与授权')
  expect(screen.getByRole('heading', { name: '我的班级与辅导' })).toBeVisible()
  expect(screen.getByRole('heading', { name: '由谁帮助你荐才' })).toBeVisible()
  expect(name).not.toBeVisible()
  fireEvent.click(await screen.findByRole('button', { name: '确认简历 · ready' }))
  fireEvent.click(await screen.findByText('查看或修改整理详情', { selector: 'summary' }))
  const importedName = within(await screen.findByRole('region', { name: '导入结果' })).getByRole('textbox', { name: '姓名' })
  fireEvent.change(importedName, { target: { value: '核对后的导入姓名' } })

  await switchView('个人档案')
  expect(importedName).not.toBeVisible()
  fireEvent.change(screen.getByRole('textbox', { name: '姓名' }), { target: { value: '未保存的档案姓名' } })
  await historyMove(-1)
  expect(screen.getByRole('heading', { level: 1, name: '导入与授权' })).toHaveFocus()
  expect(screen.getByRole('link', { name: '导入与授权' })).toHaveAttribute('aria-current', 'page')
  expect(router.state.location).toMatchObject({ pathname: '/profile/', search: '?source=resume&source=upload&view=materials', hash: '#draft' })
  expect(screen.getByRole('textbox', { name: '姓名' })).toHaveValue('核对后的导入姓名')
  expect(screen.getByText(/请返回个人档案保存或放弃后再导入/)).toBeVisible()
  const submit = screen.getByRole('button', { name: saveImport })
  expect(submit).toBeDisabled()
  fireEvent.click(submit)
  expect(campusFetch).not.toHaveBeenCalled()

  await historyMove(1)
  expect(screen.getByRole('textbox', { name: '姓名' })).toHaveValue('未保存的档案姓名')
  const currentKey = router.state.location.key
  await switchView('个人档案')
  expect(router.state.location.key).toBe(currentKey)
  expect(confirm).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('link', { name: '离开档案' }))
  expect(confirm).toHaveBeenCalledOnce()
  expect(screen.getByRole('textbox', { name: '姓名' })).toHaveValue('未保存的档案姓名')
  await historyMove(-3)
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(router.state.location.key).toBe(currentKey)
  expect(screen.getByRole('textbox', { name: '姓名' })).toHaveValue('未保存的档案姓名')

  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: '放弃本次档案编辑' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: '姓名' })).toHaveValue('原姓名'))
  await switchView('导入与授权')
  expect(screen.getByRole('textbox', { name: '姓名' })).toHaveValue('核对后的导入姓名')
  expect(screen.getByRole('button', { name: saveImport })).toBeEnabled()
})

it('opens the upload immediately from the personal shortcut and keeps each view exclusive', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  mockProfileRequests(() => ({ profile, student }))
  renderProfile('/profile')
  const name = await screen.findByRole('textbox', { name: '姓名' })
  const addExperience = '添加课程、社团或项目经历'
  const otherMaterials = '其他原文材料（奖项、证书、联系方式等）'
  const upload = screen.getByLabelText('上传已有简历')
  expect(upload).not.toBeVisible()
  expect(screen.queryByRole('button', { name: addExperience })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: otherMaterials })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('link', { name: '上传已有简历，导入档案' }))
  expect(screen.getByRole('heading', { level: 1, name: '导入与授权' })).toHaveFocus()
  expect(upload).toBeVisible()
  expect(upload).toBeEnabled()
  expect(name).not.toBeVisible()
  expect(screen.queryByRole('button', { name: '保存档案与成长材料' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^导入简历/ }))
  expect(upload).not.toBeVisible()
  await historyMove(-1)
  fireEvent.click(screen.getByRole('link', { name: '上传已有简历，导入档案' }))
  expect(upload).toBeVisible()

  await switchView('经历与想法')
  fireEvent.click(screen.getByRole('button', { name: addExperience }))
  fireEvent.change(screen.getByRole('textbox', { name: '名称' }), { target: { value: '未保存的经历' } })
  await switchView('技能与其他材料')
  fireEvent.change(screen.getByRole('textbox', { name: otherMaterials }), { target: { value: '未保存的证书' } })
  expect(screen.queryByRole('button', { name: addExperience })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '可实习时间' })).not.toBeInTheDocument()
  await historyMove(-1)
  expect(screen.getByRole('heading', { level: 1, name: '经历与想法' })).toHaveFocus()
  expect(screen.getByRole('textbox', { name: '名称' })).toHaveValue('未保存的经历')
  await historyMove(1)
  expect(screen.getByRole('heading', { level: 1, name: '技能与其他材料' })).toHaveFocus()
  expect(screen.getByRole('textbox', { name: otherMaterials })).toHaveValue('未保存的证书')
  expect(confirm).not.toHaveBeenCalled()
})

it('keeps profile edits locked until a refresh-only retry succeeds after import', async () => {
  const importedStudent = { ...student, experiences: [{ id: 'project', kind: 'project', title: '已导入项目' }] }
  const readProfile = vi.fn()
    .mockReturnValueOnce({ profile, student })
    .mockRejectedValueOnce(new Error('暂时无法刷新'))
    .mockResolvedValueOnce({ profile: { ...profile, displayName: '已导入姓名' }, student: importedStudent })
  mockProfileRequests(readProfile)
  campusFetch.mockResolvedValue({ saved: true, data: { ...draft, saved: true, status: 'saved' } })
  renderProfile('/profile?view=materials')
  fireEvent.click(await screen.findByRole('button', { name: '确认简历 · ready' }))
  fireEvent.click(await screen.findByRole('button', { name: saveImport }))
  await screen.findByRole('button', { name: '只重试刷新档案' })

  await switchView('个人档案')
  expect(screen.getByRole('textbox', { name: '姓名' })).toBeDisabled()
  await switchView('导入与授权')
  fireEvent.click(screen.getByRole('button', { name: '只重试刷新档案' }))
  fireEvent.click(await screen.findByRole('link', { name: '查看经历与想法' }))
  const project = await screen.findByRole('textbox', { name: '名称' })
  expect(project).toHaveValue('已导入项目')
  expect(project).toBeEnabled()
  await switchView('个人档案')
  expect(screen.getByRole('textbox', { name: '姓名' })).toHaveValue('已导入姓名')
  expect(campusFetch).toHaveBeenCalledOnce()
})

it('keeps import refresh recovery reachable from another mobile leaf', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  const readProfile = vi.fn()
    .mockReturnValueOnce({ profile, student })
    .mockRejectedValueOnce(new Error('暂时无法刷新'))
    .mockResolvedValueOnce({ profile: { ...profile, displayName: '已导入姓名' }, student })
  mockProfileRequests(readProfile)
  campusFetch.mockResolvedValue({ saved: true, data: { ...draft, saved: true, status: 'saved' } })
  renderProfile('/profile?view=materials')
  fireEvent.click(screen.getByRole('link', { name: '简历导入与恢复' }))
  expect(screen.getByRole('heading', { level: 1, name: '简历导入与恢复' })).toHaveFocus()
  expect(screen.getByLabelText('上传已有简历')).toBeVisible()
  expect(screen.queryByRole('heading', { name: '我的班级与辅导' })).not.toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: '确认简历 · ready' }))
  fireEvent.click(await screen.findByRole('button', { name: saveImport }))
  const retry = await screen.findByRole('button', { name: '只重试刷新档案' })

  fireEvent.click(screen.getByRole('link', { name: '返回导入与授权' }))
  fireEvent.click(screen.getByRole('link', { name: '班级与辅导' }))
  expect(screen.getByRole('heading', { name: '我的班级与辅导' })).toBeVisible()
  expect(retry).not.toBeVisible()
  fireEvent.click(screen.getByRole('link', { name: '返回简历导入与恢复' }))
  expect(retry).toBeVisible()
  fireEvent.click(retry)
  fireEvent.click(await screen.findByRole('link', { name: '查看个人档案' }))
  fireEvent.click(screen.getByRole('link', { name: '基本档案' }))
  expect(screen.getByRole('textbox', { name: '姓名' })).toHaveValue('已导入姓名')
  expect(screen.getByRole('textbox', { name: '姓名' })).toBeEnabled()
  expect(campusFetch).toHaveBeenCalledOnce()
})
