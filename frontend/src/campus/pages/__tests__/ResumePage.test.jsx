import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Link, MemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ResumePage from '../ResumePage'
import UnsavedWorkProvider from '../../components/UnsavedWorkProvider'
import { campusData, campusFetch } from '../../api'
const navigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (original) => {
  const router = await original()
  return { ...router, useNavigate: () => {
    const realNavigate = router.useNavigate()
    return (destination, options) => typeof destination === 'string' && destination.startsWith('/interview')
      ? navigate(destination)
      : realNavigate(destination, options)
  } }
})

vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), resumeRows: (payload) => payload.data, logClientEvent: vi.fn(), downloadBlob: vi.fn(), downloadDiagnostics: vi.fn(), errorText: () => '请求未完成' }))
vi.mock('../../components/VoiceInput', () => ({ default: ({ onTranscript }) => <button type="button" onClick={() => onTranscript('语音补充', 1, 1)}>受控转写</button> }))
vi.mock('../../components/JobSelect', () => ({ default: () => null }))
const stored = { id: 'saved', title: '已保存简历', jobRole: '测试方向', originalText: '真实经历测试文本', revision: 3, contentRevision: 2 }
beforeEach(() => {
  campusData.mockImplementation(async (path) => {
    if (path === '/me') return { profile: {}, student: { targetJobId: null } }
    if (path === '/me/targets') return []
    return { items: [], total: 0 }
  })
  campusFetch.mockImplementation((path) => Promise.resolve({ data: path === '/api/resumes' ? [stored] : stored }))
})
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const open = (entry = '/resume') => render(<MemoryRouter initialEntries={[entry]}><ResumePage /></MemoryRouter>)
const editor = () => fireEvent.click(screen.getByRole('button', { name: '编辑简历' }))
const versions = () => fireEvent.click(screen.getByRole('button', { name: '已保存版本' }))
const importing = () => fireEvent.click(screen.getByRole('button', { name: '导入简历' }))
async function openStored() {
  versions()
  fireEvent.click(await screen.findByRole('button', { name: stored.title }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText))
}

function openPhone(entry = '/resume') {
  const media = Object.assign(new EventTarget(), { matches: true })
  vi.stubGlobal('matchMedia', (query) => query === '(max-width: 767px)' ? media : undefined)
  const router = createMemoryRouter([
    { path: '/resume', element: <UnsavedWorkProvider><ResumePage /><Link to="/elsewhere">离开简历</Link></UnsavedWorkProvider> },
    { path: '/elsewhere', element: <h1>已离开简历</h1> },
  ], { initialEntries: [entry] })
  render(<RouterProvider router={router} />)
  return router
}

it('keeps dirty editor and materials inputs through mobile Back, Forward, and return to the editor', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const router = openPhone('/resume?import=1&from=home#draft')
  expect(screen.getByLabelText('上传已有简历')).toBeVisible()
  editor()
  await screen.findByRole('heading', { name: '编辑简历' })
  const body = screen.getByLabelText('真实经历与简历正文')
  fireEvent.change(body, { target: { value: '手机上尚未保存的正文' } })
  fireEvent.click(screen.getByRole('button', { name: '补充材料与岗位' }))
  await waitFor(() => expect(router.state.location).toMatchObject({ search: '?import=1&from=home&panel=materials', hash: '#draft' }))
  expect(screen.getByRole('heading', { name: '补充材料与岗位' })).toHaveFocus()
  expect(body).not.toBeVisible()
  expect(screen.queryByRole('button', { name: '保存简历' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText(/临时粘贴岗位 JD 要求/), { target: { value: '仍未提交的招聘要求' } })

  await act(() => router.navigate(-1))
  expect(body).toBeVisible()
  expect(body).toHaveValue('手机上尚未保存的正文')
  await act(() => router.navigate(1))
  expect(screen.getByLabelText(/临时粘贴岗位 JD 要求/)).toHaveValue('仍未提交的招聘要求')
  fireEvent.click(screen.getByRole('button', { name: /返回编辑简历/ }))
  await waitFor(() => expect(router.state.location.search).toBe('?import=1&from=home'))
  expect(body).toBeVisible()
  expect(screen.getByRole('button', { name: '保存简历' })).toBeEnabled()
  expect(confirm).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('link', { name: '离开简历' }))
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
  expect(body).toBeVisible()
})

it('restores the selected mobile tab after leaving and returning to a legacy deep link', async () => {
  const router = openPhone('/resume?import=1#draft')
  expect(screen.getByLabelText('上传已有简历')).toBeVisible()
  versions()
  await screen.findByRole('heading', { name: '已保存的简历' })
  fireEvent.click(screen.getByRole('link', { name: '离开简历' }))
  await screen.findByRole('heading', { name: '已离开简历' })
  await act(() => router.navigate(-1))
  expect(await screen.findByRole('heading', { name: '已保存的简历' })).toBeVisible()
  expect(router.state.location).toMatchObject({ search: '?import=1', hash: '#draft' })
})

it('keeps the newer mobile destination when save-and-continue finishes, then reuses the acknowledgement', async () => {
  const saved = { ...stored, originalText: '已确认保存的内容', revision: 4 }
  let resolveSave
  const originalFetch = campusFetch.getMockImplementation()
  campusFetch.mockImplementation((path, options) => options?.method === 'PUT'
    ? new Promise((resolve) => { resolveSave = resolve })
    : originalFetch(path, options))
  openPhone('/resume?resumeId=saved')
  const body = screen.getByLabelText('真实经历与简历正文')
  await waitFor(() => expect(body).toHaveValue(stored.originalText))
  fireEvent.change(body, { target: { value: saved.originalText } })
  fireEvent.click(screen.getByRole('button', { name: '保存并继续' }))
  fireEvent.click(screen.getByRole('button', { name: '补充材料与岗位' }))
  await screen.findByRole('heading', { name: '补充材料与岗位' })
  await act(async () => resolveSave({ data: saved }))
  expect(screen.getByRole('heading', { name: '补充材料与岗位' })).toBeVisible()
  expect(navigate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /返回编辑简历/ }))
  const next = await screen.findByRole('button', { name: '继续准备面试' })
  await waitFor(() => expect(next).toBeEnabled())
  fireEvent.click(next)
  expect(navigate).toHaveBeenCalledWith('/interview?resumeId=saved&resumeRevision=4')
  expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1)
})

it('keeps in-flight mobile AI work reachable and adopts results without implicitly saving', async () => {
  let resolvePolish
  const originalData = campusData.getMockImplementation()
  campusData.mockImplementation((path) => path === '/resumes/polish' ? new Promise((resolve) => { resolvePolish = resolve }) : originalData(path))
  const router = openPhone('/resume?resumeId=saved&panel=review')
  const generate = screen.getByRole('button', { name: 'AI 润色建议' })
  await waitFor(() => expect(generate).toBeEnabled())
  fireEvent.click(generate)
  fireEvent.click(screen.getByRole('button', { name: /返回编辑简历/ }))
  await waitFor(() => expect(router.state.location.search).toBe('?resumeId=saved'))
  expect(screen.getByRole('button', { name: '查看 AI 润色进度' })).toBeVisible()
  await act(async () => resolvePolish({ draft: '核对后的真实经历' }))
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText)
  fireEvent.click(screen.getByRole('button', { name: '核对待处理的 AI 建议' }))
  fireEvent.click(await screen.findByRole('button', { name: '确认事实并采纳建议' }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue('核对后的真实经历'))
  expect(screen.getByRole('button', { name: '下载确认版 PDF' })).toBeDisabled()
  expect(campusFetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
})

it('returns from a mobile leaf to the same pending voice review', async () => {
  openPhone('/resume?resumeId=saved')
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText))
  fireEvent.click(screen.getByRole('button', { name: '用声音补充经历' }))
  fireEvent.click(screen.getByRole('button', { name: '受控转写' }))
  const transcript = screen.getByLabelText('转写校对')
  fireEvent.change(transcript, { target: { value: '修改后的口述经历' } })
  fireEvent.click(screen.getByRole('button', { name: '补充材料与岗位' }))
  await waitFor(() => expect(transcript).not.toBeVisible())
  fireEvent.click(screen.getByRole('button', { name: '返回录音或校对' }))
  await waitFor(() => expect(transcript).toBeVisible())
  expect(transcript).toHaveValue('修改后的口述经历')
  fireEvent.click(screen.getByRole('button', { name: '使用校对后的文字' }))
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(`${stored.originalText}\n\n修改后的口述经历`)
})

it('keeps native title validation on mobile before writing the editor draft', async () => {
  openPhone()
  const title = screen.getByLabelText('简历标题')
  const save = screen.getByRole('button', { name: '保存简历' })
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: '有正文，尚未命名' } })
  fireEvent.click(save)
  expect(title.validity.valueMissing).toBe(true)
  expect(campusFetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  fireEvent.change(title, { target: { value: '手机保存的简历' } })
  fireEvent.click(save)
  await screen.findByText('服务器已确认保存。')
  expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
})

it('can recover a pending import directly from a mobile leaf without reloading it', async () => {
  const originalData = campusData.getMockImplementation()
  campusData.mockImplementation((path) => path === '/imports/unfinished'
    ? Promise.resolve({ id: 'unfinished', status: 'save_unknown', frozen: true, kept: true, canContinue: true })
    : originalData(path))
  const router = openPhone('/resume?importId=unfinished&panel=materials')
  fireEvent.click(await screen.findByRole('button', { name: '检查导入结果' }))
  await waitFor(() => expect(router.state.location.search).toBe('?importId=unfinished'))
  expect(screen.getByRole('button', { name: '检查保存结果并继续' })).toBeEnabled()
  expect(campusData.mock.calls.filter(([path]) => path === '/imports/unfinished')).toHaveLength(1)
})

it('does not prompt when replacing an untouched blank draft', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  open()
  await openStored()
  expect(confirm).not.toHaveBeenCalled()
})
it('keeps cleared body and changed metadata when discarding is cancelled', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const other = { ...stored, id: 'other', title: '另一份简历' }
  campusFetch.mockImplementation(async (path) => ({ data: path === '/api/resumes' ? [stored, other] : stored }))
  open()
  await openStored()
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: '' } })
  expect(screen.getByLabelText('简历标题')).toHaveAttribute('readonly')
  versions()
  fireEvent.click(screen.getByRole('button', { name: other.title }))
  fireEvent.click(screen.getByRole('button', { name: '新建空白简历' }))
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(campusFetch).not.toHaveBeenCalledWith('/api/resumes/other')
  editor()
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue('')
  expect(screen.getByLabelText('简历标题')).toHaveValue(stored.title)
  expect(screen.getByLabelText('想尝试的岗位（可留空）')).toHaveValue(stored.jobRole)
})
it('guards metadata-only edits on an otherwise blank draft', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  open()
  fireEvent.change(screen.getByLabelText('简历标题'), { target: { value: '仅有标题' } })
  versions()
  fireEvent.click(screen.getByRole('button', { name: '新建空白简历' }))
  expect(confirm).toHaveBeenCalledOnce()
  editor()
  expect(screen.getByLabelText('简历标题')).toHaveValue('仅有标题')
})

it('opens a different saved record after confirming the draft replacement', async () => {
  const other = { ...stored, id: 'other', title: '第二份简历', originalText: '另一份已保存正文' }
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  campusFetch.mockImplementation(async (path) => ({ data: path === '/api/resumes' ? [stored, other] : path === '/api/resumes/other' ? other : stored }))
  open()
  await openStored()
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: '要放弃的正文' } })
  versions()
  fireEvent.click(screen.getByRole('button', { name: other.title }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(other.originalText))
  expect(screen.getByLabelText('真实经历与简历正文')).toBeVisible()
  expect(confirm).toHaveBeenCalledOnce()
})

it('keeps a newer destination selected when a pending saved record arrives', async () => {
  let resolveRecord
  campusFetch.mockImplementation((path) => path === '/api/resumes'
    ? Promise.resolve({ data: [stored] })
    : new Promise((resolve) => { resolveRecord = resolve }))
  open()
  versions()
  fireEvent.click(await screen.findByRole('button', { name: stored.title }))
  importing()
  await act(async () => resolveRecord({ data: stored }))
  expect(screen.getByRole('button', { name: '导入简历' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('heading', { name: '导入简历' })).toHaveFocus()
  editor()
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText)
})

it('refreshes the current saved record when explicitly reopened with a clean editor', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  open()
  await openStored()
  const updated = { ...stored, revision: 4, originalText: '另一处保存的正文' }
  campusFetch.mockResolvedValueOnce({ data: updated })
  versions()
  fireEvent.click(screen.getByRole('button', { name: stored.title }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(updated.originalText))
  expect(screen.getByText('当前内容已保存 · 版本 4', { exact: false })).toBeVisible()
  expect(confirm).not.toHaveBeenCalled()
})

it('sends the server revision without title in a body save', async () => {
  open()
  await openStored()
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: '修改后的真实经历' } })
  fireEvent.click(screen.getByRole('button', { name: '保存简历' }))
  await waitFor(() => expect(campusFetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true))
  const body = JSON.parse(campusFetch.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body)
  expect(body).toMatchObject({ revision: 3, originalText: '修改后的真实经历' })
  expect(body).not.toHaveProperty('title')
})

it('renaming another resume preserves the current unsaved body', async () => {
  const other = { ...stored, id: 'other', title: '另一份简历', revision: 7 }
  campusFetch.mockImplementation((path, options) => Promise.resolve({ data: path === '/api/resumes' ? [stored, other] : options?.method === 'PUT' ? { ...other, title: '新名称', revision: 8 } : stored }))
  vi.spyOn(window, 'prompt').mockReturnValue('新名称')
  open()
  await openStored()
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: '正在写的内容' } })
  versions()
  screen.getAllByText('管理', { selector: 'summary' }).forEach((summary) => fireEvent.click(summary))
  fireEvent.click(screen.getAllByRole('button', { name: '改名', exact: true })[1])
  await waitFor(() => expect(campusFetch).toHaveBeenCalledWith('/api/resumes/other', expect.objectContaining({ method: 'PUT' })))
  editor()
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue('正在写的内容')
})

it('uses the acknowledged saved version when continuing, not a speculative reread', async () => {
  const saved = { ...stored, originalText: '刚保存的经历', revision: 4 }
  campusFetch.mockImplementation((path, options) => Promise.resolve({ data: path === '/api/resumes' ? [stored] : options?.method === 'PUT' ? saved : stored }))
  const view = open()
  await openStored()
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: saved.originalText } })
  fireEvent.click(screen.getByRole('button', { name: '保存并继续', exact: true }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(saved.originalText))
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/interview?resumeId=saved&resumeRevision=4'))
  expect(campusFetch.mock.calls.filter(([path, options]) => path === '/api/resumes/saved' && !options)).toHaveLength(1)
  expect(JSON.parse(campusFetch.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body)).toMatchObject({ revision: 3, originalText: saved.originalText, operationId: expect.any(String) })
  view.unmount()
})

it('keeps the editor unchanged on conflict and does not move to a saved state', async () => {
  campusFetch.mockImplementation((path, options) => options?.method === 'PUT' ? Promise.reject({ status: 409, code: 'REVISION_CONFLICT' }) : Promise.resolve({ data: path === '/api/resumes' ? [stored] : stored }))
  open()
  await openStored()
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: '本地修改保留' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并继续', exact: true }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toBeEnabled())
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue('本地修改保留')
  expect(screen.getByRole('button', { name: '下载确认版 PDF' })).toBeDisabled()
})

it('reuses the saved identity after navigation fails instead of creating twice', async () => {
  navigate.mockImplementationOnce(() => { throw new Error('navigation unavailable') }).mockImplementation(() => {})
  campusFetch.mockImplementation((path, options) => Promise.resolve({ data: options?.method === 'POST' ? { ...stored, id: 'created', revision: 1, title: '新简历', jobRole: '', originalText: '真实正文' } : path === '/api/resumes' ? [] : stored }))
  open()
  fireEvent.change(screen.getByLabelText('简历标题'), { target: { value: '新简历' } })
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: '真实正文' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并继续', exact: true }))
  const retry = await screen.findByRole('button', { name: '继续准备面试' })
  await waitFor(() => expect(retry).toBeEnabled())
  fireEvent.click(retry)
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(2))
  expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
})

it('keeps a recovered save acknowledged when the subsequent list refresh fails', async () => {
  let listReads = 0
  const acknowledged = { ...stored, revision: 4, originalText: '已提交内容' }
  campusFetch.mockImplementation(async (path, options) => {
    if (path === '/api/resumes') { if (++listReads > 1) throw { status: 503 }; return { data: [stored] } }
    if (path.includes('/save-operations/')) return { data: acknowledged }
    if (options?.method === 'PUT') throw { status: 0, code: 'NETWORK_ERROR' }
    return { data: stored }
  })
  open()
  await openStored()
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: acknowledged.originalText } })
  fireEvent.click(screen.getByRole('button', { name: '保存简历', exact: true }))
  await screen.findByText(/列表刷新失败/)
  expect(screen.getByLabelText('真实经历与简历正文')).toBeEnabled()
  expect(screen.queryByRole('button', { name: '检查保存结果并继续' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '继续准备面试' }))
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/interview?resumeId=saved&resumeRevision=4'))
  expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1)
})

it.each([['desktop', open], ['mobile', openPhone]])('shows the PDF comparison and creates a separate unsaved copy on %s', async (device, renderPage) => {
  campusFetch.mockImplementation((path) => Promise.resolve({ data: path === '/api/resumes' ? [stored] : path.includes('/download?') ? {
    pdf: 'JVBERg==', compression: { original: stored.originalText, draft: '保留的真实经历', changes: ['省略一段'] },
  } : stored }))
  renderPage()
  await openStored()
  fireEvent.click(screen.getByRole('button', { name: '下载确认版 PDF' }))
  await screen.findByText('省略一段')
  if (device === 'mobile') {
    versions()
    fireEvent.click(await screen.findByRole('button', { name: '核对 PDF 压缩稿' }))
    expect(screen.getByRole('heading', { name: '压缩稿与原文对照' })).toHaveFocus()
  }
  expect(within(screen.getByRole('heading', { name: '压缩稿与原文对照' }).parentElement).getByText(stored.originalText)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '作为新简历修改压缩稿' }))
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue('保留的真实经历')
  expect(screen.getByLabelText('简历标题')).not.toHaveAttribute('readonly')
  expect(screen.getByRole('button', { name: '下载确认版 PDF' })).toBeDisabled()
  expect(campusFetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
})

it('supports multi-scenario AI polish modes, ad-hoc JD context, summary prepend, and read-only interview predictions', async () => {
  campusData.mockImplementation((path, options) => {
    if (path === '/me') return Promise.resolve({ profile: {}, student: { targetJobId: null } })
    if (path === '/me/targets') return Promise.resolve([])
    if (path === '/imports') return Promise.resolve({ items: [] })
    if (path.startsWith('/jobs')) return Promise.resolve({ items: [], total: 0 })
    if (path === '/resumes/polish') {
      const payload = JSON.parse(options.body)
      if (payload.mode === 'profile_summary') {
        return Promise.resolve({ mode: 'profile_summary', draft: '具备扎实内容策划经验的校园运营人。', changes: ['提炼核心优势'], questions: [] })
      }
      if (payload.mode === 'interview_questions') {
        return Promise.resolve({
          mode: 'interview_questions',
          draft: '',
          changes: [],
          questions: [],
          interviewQuestions: [{ question: '你在项目中具体负责哪一块？', approach: '用 STAR 法说明分工与结果', sourceExcerpt: '真实经历测试文本' }],
        })
      }
    }
    return Promise.resolve({})
  })
  open()
  await openStored()

  fireEvent.change(screen.getByLabelText(/临时粘贴岗位 JD 要求/), { target: { value: '负责新媒体选题与活动执行' } })
  fireEvent.click(screen.getByRole('button', { name: '个人简介(3句话)' }))
  fireEvent.click(screen.getByRole('button', { name: '生成 3 句话个人简介' }))
  await screen.findByText('具备扎实内容策划经验的校园运营人。')
  importing()
  expect(screen.getByText(/AI 建议待核对/)).toBeVisible()
  editor()
  fireEvent.click(screen.getByRole('button', { name: '插入到简历开头' }))
  expect(screen.getByLabelText('真实经历与简历正文').value).toContain('## 个人简介\n具备扎实内容策划经验的校园运营人。\n\n真实经历测试文本')

  fireEvent.click(screen.getByRole('button', { name: '预测面试追问(5题)' }))
  fireEvent.click(screen.getByRole('button', { name: '预测 5 道面试追问' }))
  await screen.findByText('你在项目中具体负责哪一块？')
  expect(screen.queryByRole('button', { name: '确认事实并采纳建议' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '收起预测问题' }))
})

it('switches destinations without prompting, replacing the edited record, or resetting its local inputs', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  open()
  await openStored()
  const body = screen.getByLabelText('真实经历与简历正文')
  const jd = screen.getByLabelText(/临时粘贴岗位 JD 要求/)
  fireEvent.click(screen.getByText(/补充材料、选择岗位/))
  fireEvent.change(body, { target: { value: '仍在编辑的简历' } })
  fireEvent.change(jd, { target: { value: '临时 JD' } })
  importing()
  expect(screen.getByRole('heading', { name: '导入简历' })).toHaveFocus()
  expect(body).not.toBeVisible()
  expect(screen.getByLabelText('上传已有简历')).toBeDisabled()
  expect(screen.queryByRole('heading', { name: '已保存的简历' })).not.toBeInTheDocument()
  versions()
  fireEvent.click(screen.getByRole('button', { name: stored.title }))
  expect(screen.getByRole('heading', { name: '编辑简历' })).toHaveFocus()
  expect(body).toBeVisible()
  expect(body).toHaveValue('仍在编辑的简历')
  expect(jd).toBeVisible()
  expect(jd).toHaveValue('临时 JD')
  expect(confirm).not.toHaveBeenCalled()
  expect(campusFetch.mock.calls.filter(([path]) => path === '/api/resumes/saved')).toHaveLength(1)
})

it('opens the upload destination from the import entry link', async () => {
  open('/resume?import=1')
  expect(screen.getByRole('button', { name: '导入简历' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('上传已有简历')).toBeVisible()
  await waitFor(() => expect(campusData).toHaveBeenCalledWith('/imports'))
})

it('opens saved versions from a completed import without discarding the current editor', async () => {
  const loadData = campusData.getMockImplementation()
  campusData.mockImplementation((path) => path === '/imports/complete'
    ? Promise.resolve({ id: 'complete', status: 'saved', saved: true })
    : loadData(path))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  open('/resume?import=1&importId=complete')
  await screen.findByRole('button', { name: '去看简历' })
  editor()
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: '当前草稿继续写' } })
  importing()
  fireEvent.click(screen.getByRole('button', { name: '去看简历' }))
  expect(await screen.findByRole('button', { name: stored.title })).toBeVisible()
  editor()
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue('当前草稿继续写')
  expect(confirm).not.toHaveBeenCalled()
})

it('retains the deep-linked import result and surfaces unknown import recovery from other views', async () => {
  const pending = { id: 'unfinished', status: 'save_unknown', frozen: true, kept: true, canContinue: true }
  let resolveDraft
  campusData.mockImplementation(async (path) => {
    if (path === '/imports/unfinished') return new Promise((resolve) => { resolveDraft = resolve })
    if (path === '/me') return { profile: {}, student: { targetJobId: null } }
    return path === '/me/targets' ? [] : { items: [], total: 0 }
  })
  open('/resume?importId=unfinished')
  expect(screen.getByLabelText('上传已有简历')).toBeVisible()
  editor()
  expect(screen.getByText(/正在处理导入，返回导入简历/)).toBeVisible()
  await act(async () => resolveDraft(pending))
  expect(screen.getByText(/导入结果尚未确认，返回导入简历/)).toBeVisible()
  importing()
  expect(screen.getByRole('button', { name: '检查保存结果并继续' })).toBeEnabled()
  expect(campusData.mock.calls.filter(([path]) => path === '/imports/unfinished')).toHaveLength(1)
})

it.each([['desktop', open], ['mobile', openPhone]])('recovers an unknown editor save from saved versions without writing another record on %s', async (_device, renderPage) => {
  const saved = { ...stored, revision: 4, originalText: '服务器已确认的正文' }
  let recoveries = 0
  campusFetch.mockImplementation(async (path, options) => {
    if (path === '/api/resumes') return { data: [stored] }
    if (path.includes('/save-operations/')) {
      if (++recoveries === 1) throw { status: 503 }
      return { data: saved }
    }
    if (options?.method === 'PUT') throw { status: 0, code: 'NETWORK_ERROR' }
    return { data: stored }
  })
  renderPage()
  await openStored()
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: saved.originalText } })
  fireEvent.click(screen.getByRole('button', { name: '保存简历' }))
  await screen.findByRole('button', { name: '检查保存结果并继续' })
  versions()
  expect(await screen.findByRole('button', { name: '新建空白简历' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '检查保存结果并继续' }))
  await screen.findByText('服务器已确认保存。')
  editor()
  await screen.findByRole('heading', { name: '编辑简历' })
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(saved.originalText)
  expect(screen.getByRole('button', { name: '下载确认版 PDF' })).toBeEnabled()
  expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1)
})

it('keeps unsaved targeted changes distinct from the source editor across views', async () => {
  const target = { id: 'target', company: '测试企业', title: '岗位', revision: 1, draft: '针对岗位的稿件' }
  campusData.mockImplementation(async (path) => {
    if (path === '/me') return { profile: {}, student: { targetJobId: null } }
    return path === '/me/targets' ? [target] : { items: [], total: 0 }
  })
  open()
  await openStored()
  versions()
  expect(screen.getByRole('heading', { name: '企业定向简历' })).toBeVisible()
  fireEvent.click(screen.getByText('查看或编辑此版本'))
  const draft = screen.getByLabelText('定向简历正文')
  fireEvent.change(draft, { target: { value: '未保存的定向编辑' } })
  editor()
  expect(screen.getByText(/定向版本有尚未保存的编辑/)).toBeVisible()
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText)
  expect(draft).not.toBeVisible()
  versions()
  expect(draft).toBeVisible()
  expect(draft).toHaveValue('未保存的定向编辑')
})

it('keeps voice review pending until the user returns and accepts the transcript', async () => {
  open()
  await openStored()
  fireEvent.click(screen.getByText('用声音补充经历'))
  fireEvent.click(screen.getByRole('button', { name: '受控转写' }))
  const review = screen.getByLabelText('转写校对')
  fireEvent.change(review, { target: { value: '校对后的语音补充' } })
  versions()
  expect(screen.getByText(/语音录制或校对尚未完成，返回编辑简历/)).toBeVisible()
  expect(screen.getByRole('button', { name: '新建空白简历' })).toBeDisabled()
  editor()
  expect(review).toBeVisible()
  expect(review).toHaveValue('校对后的语音补充')
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText)
  fireEvent.click(screen.getByRole('button', { name: '使用校对后的文字' }))
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(`${stored.originalText}\n\n校对后的语音补充`)
})

it('finishes an active AI review request while saved versions are open', async () => {
  let finishPolish
  const originalData = campusData.getMockImplementation()
  campusData.mockImplementation((path) => path === '/resumes/polish' ? new Promise((resolve) => { finishPolish = resolve }) : originalData(path))
  open()
  await openStored()
  fireEvent.click(screen.getByRole('button', { name: 'AI 润色建议' }))
  versions()
  expect(screen.getByText(/AI 正在润色，返回编辑简历/)).toBeVisible()
  expect(screen.getByRole('button', { name: '新建空白简历' })).toBeDisabled()
  await act(async () => finishPolish({ draft: '尚未采纳的润色稿' }))
  expect(screen.getByText(/AI 建议待核对/)).toBeVisible()
  editor()
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText)
  fireEvent.click(screen.getByRole('button', { name: '确认事实并采纳建议' }))
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue('尚未采纳的润色稿')
})
