import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, Link, MemoryRouter, RouterProvider, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import JobsPage from '../JobsPage'
import { campusData, campusFetch } from '../../api'
import UnsavedWorkProvider from '../../components/UnsavedWorkProvider'

const navigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (original) => {
  const router = await original()
  return { ...router, useNavigate: () => {
    const actualNavigate = router.useNavigate()
    return (...args) => typeof args[0] !== 'string' ? actualNavigate(...args) : navigate(...args)
  } }
})
vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), errorText: () => '请求未完成', downloadDiagnostics: vi.fn() }))
vi.mock('../../auth', () => ({ useCampusSession: () => ({ status: { user: { uid: 'owner' } } }) }))
const saved = { id: 'job', creatorUid: 'owner', company: '合成企业', title: '合成岗位', description: '真实岗位要求', source: '', authorKind: 'student', status: 'draft', requirements: [], availability: {}, updatedAt: '2026-10-21T01:00:00.000Z' }
beforeEach(() => {
  localStorage.clear()
  campusData.mockImplementation(async (path) => path.startsWith('/jobs?') ? { items: [saved], total: 1 } : path === '/jobs/job' ? saved : path === '/jobs/images' ? { items: [] } : path === '/jobs/job/gap' ? null : {})
  campusFetch.mockResolvedValue({ data: saved })
})
afterEach(() => { cleanup(); vi.resetAllMocks() })

function JobsRouteHarness() {
  const { search, hash } = useLocation()
  const move = useNavigate()
  return <>
    <Link to="/jd">岗位导航</Link>
    <Link to="/jd?from=interview&entry=screenshot&extra=kept#hand-off">截图导航</Link>
    <button type="button" onClick={() => move(-1)}>历史后退</button>
    <output aria-label="当前链接">{search}{hash}</output>
    <JobsPage />
  </>
}

it('honors same-mount screenshot entry and clears it on return without clearing handoff context', async () => {
  render(<MemoryRouter initialEntries={['/jd']}><JobsRouteHarness /></MemoryRouter>)
  const screenshotEntry = screen.getByRole('link', { name: '截图导航' })
  fireEvent.click(screenshotEntry)
  expect(await screen.findByLabelText('添加岗位截图')).toBeVisible()
  fireEvent.click(screen.getByRole('link', { name: '岗位导航' }))
  expect(screen.getByRole('button', { name: '录入一个岗位' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '历史后退' }))
  expect(screen.getByLabelText('添加岗位截图')).toBeVisible()
  fireEvent.click(screen.getByRole('link', { name: '岗位导航' }))
  fireEvent.click(screenshotEntry)
  fireEvent.click(await screen.findByRole('button', { name: '返回岗位列表' }))
  expect(screen.getByLabelText('当前链接')).toHaveTextContent('?from=interview&extra=kept#hand-off')
  expect(screen.getByRole('button', { name: '录入一个岗位' })).toBeVisible()
  expect(screen.getByRole('link', { name: '取消录入，回到原来的面试准备单' })).toBeVisible()
})

it('retains local screenshots during entry cleanup and still guards leaving Jobs', async () => {
  const createPreview = URL.createObjectURL
  const revokePreview = URL.revokeObjectURL
  URL.createObjectURL = vi.fn(() => 'blob:guarded-job')
  URL.revokeObjectURL = vi.fn()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const router = createMemoryRouter([
    { path: '/jd', element: <UnsavedWorkProvider><JobsPage /><Link to="/elsewhere">离开岗位</Link></UnsavedWorkProvider> },
    { path: '/elsewhere', element: <p>已离开岗位</p> },
  ], { initialEntries: ['/jd?from=interview&entry=screenshot'] })
  try {
    render(<RouterProvider router={router} />)
    fireEvent.change(await screen.findByLabelText('添加岗位截图'), { target: { files: [new File(['job'], 'job.png', { type: 'image/png' })] } })
    fireEvent.click(screen.getByRole('button', { name: '返回岗位列表' }))
    expect(await screen.findByRole('button', { name: '录入一个岗位' })).toBeVisible()
    expect(router.state.location.search).toBe('?from=interview')
    expect(confirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link', { name: '离开岗位' }))
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    expect(screen.queryByText('已离开岗位')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '从岗位截图整理' }))
    expect(screen.getByRole('img', { name: '岗位截图 1' })).toBeVisible()
  } finally { cleanup(); confirm.mockRestore(); URL.createObjectURL = createPreview; URL.revokeObjectURL = revokePreview }
})

it('saves edits with the loaded token and navigates with the acknowledged job version', async () => {
  const acknowledged = { ...saved, description: '新要求', updatedAt: '2026-10-21T02:00:00.000Z' }
  campusFetch.mockResolvedValue({ data: acknowledged })
  render(<MemoryRouter initialEntries={['/jd?from=interview']}><JobsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: /合成岗位/ }))
  const description = await screen.findByLabelText('岗位描述')
  await waitFor(() => expect(description).toBeEnabled())
  fireEvent.change(description, { target: { value: '新要求' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并继续', exact: true }))
  await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/interview?jobId=job&jobRevision=${encodeURIComponent(acknowledged.updatedAt)}`))
  const body = JSON.parse(campusFetch.mock.calls[0][1].body)
  expect(body).toMatchObject({ description: '新要求', expectedUpdatedAt: saved.updatedAt, status: 'draft', operationId: expect.any(String) })
  expect(campusFetch.mock.calls[0][1].method).toBe('PATCH')
})

it('retains edited text and private publication scope on save conflict', async () => {
  campusFetch.mockRejectedValue({ status: 409, code: 'JOB_CHANGED' })
  render(<MemoryRouter initialEntries={['/jd?from=interview']}><JobsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: /合成岗位/ }))
  const description = await screen.findByLabelText('岗位描述')
  await waitFor(() => expect(description).toBeEnabled())
  fireEvent.change(description, { target: { value: '尚未保存的要求' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并继续', exact: true }))
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(description).toBeEnabled()
  expect(screen.getByLabelText('岗位描述')).toHaveValue('尚未保存的要求')
  expect(screen.getByLabelText('发布状态')).toHaveValue('draft')
  expect(navigate).not.toHaveBeenCalled()
})

it('retries return using the saved identity without another create', async () => {
  navigate.mockImplementationOnce(() => { throw new Error('navigation unavailable') })
  render(<MemoryRouter initialEntries={['/jd?from=interview']}><JobsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '录入一个岗位' }))
  fireEvent.change(screen.getByLabelText('企业'), { target: { value: saved.company } })
  fireEvent.change(screen.getByLabelText('岗位', { exact: true }), { target: { value: saved.title } })
  fireEvent.change(screen.getByLabelText('岗位描述'), { target: { value: saved.description } })
  fireEvent.click(screen.getByRole('button', { name: '保存并继续', exact: true }))
  const retry = await screen.findByRole('button', { name: '使用已保存岗位继续面试' })
  await waitFor(() => expect(retry).toBeEnabled())
  fireEvent.click(retry)
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(2))
  expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
})

it('does not relock a recovered job save when gap refresh fails', async () => {
  let gapReads = 0
  campusData.mockImplementation(async (path) => {
    if (path.startsWith('/jobs?')) return { items: [saved], total: 1 }
    if (path === '/jobs/job/gap') { if (++gapReads > 1) throw { status: 503 }; return null }
    return saved
  })
  const acknowledged = { ...saved, description: '新要求', updatedAt: '2026-10-21T02:00:00.000Z' }
  campusFetch.mockImplementation(async (_path, options) => { if (options?.method === 'PATCH') throw { status: 0 }; return { data: acknowledged } })
  render(<MemoryRouter><JobsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: /合成岗位/ }))
  await waitFor(() => expect(screen.getByLabelText('岗位描述')).toBeEnabled())
  fireEvent.change(screen.getByLabelText('岗位描述'), { target: { value: '新要求' } })
  fireEvent.click(screen.getByRole('button', { name: '保存岗位', exact: true }))
  await screen.findByText(/匹配信息刷新失败/)
  await waitFor(() => expect(screen.getByLabelText('岗位描述')).toBeEnabled())
  expect(screen.queryByRole('button', { name: '检查保存结果并继续' })).not.toBeInTheDocument()
  expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1)
})

it('opens only the selected job and restores the current page, scroll and row focus', async () => {
  const next = { ...saved, title: '第二页的岗位' }
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const scrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 480 })
  const firstPage = Array.from({ length: 20 }, (_, index) => ({ ...saved, id: `job-${index}`, title: `岗位 ${index + 1}` }))
  campusData.mockImplementation(async (path) => {
    if (path.includes('page=1')) return { items: firstPage, total: 21 }
    if (path.includes('page=2')) return { items: [next], total: 21 }
    if (path === '/jobs/job') return next
    return null
  })
  try {
    render(<MemoryRouter><JobsPage /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: '下一页' }))
    const row = await screen.findByRole('button', { name: /第二页的岗位/ })
    row.focus()
    fireEvent.click(row)
    expect(await screen.findByLabelText('岗位描述')).toBeVisible()
    expect(screen.queryByRole('button', { name: /第二页的岗位/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '第二页的岗位' })).toHaveFocus()
    const back = screen.getByRole('button', { name: '返回岗位列表' })
    await waitFor(() => expect(back).toBeEnabled())
    fireEvent.click(back)
    expect(screen.getByRole('button', { name: '上一页' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /第二页的岗位/ })).toHaveFocus()
    expect(scroll).toHaveBeenLastCalledWith(0, 480)
  } finally { scroll.mockRestore(); Object.defineProperty(window, 'scrollY', scrollY) }
})

it('keeps a dirty job when return is cancelled and discards it only when confirmed', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  try {
    render(<MemoryRouter><JobsPage /></MemoryRouter>)
    const manual = await screen.findByRole('button', { name: '录入一个岗位' })
    fireEvent.click(manual)
    fireEvent.change(screen.getByLabelText('岗位描述'), { target: { value: '未保存的手工岗位' } })
    const back = screen.getByRole('button', { name: '返回岗位列表' })
    fireEvent.click(back)
    expect(screen.getByLabelText('岗位描述')).toHaveValue('未保存的手工岗位')
    expect(manual).not.toBeVisible()
    fireEvent.click(back)
    expect(manual).toHaveFocus()
    fireEvent.click(manual)
    expect(screen.getByLabelText('岗位描述')).toHaveValue('')
    expect(campusFetch).not.toHaveBeenCalled()
  } finally { confirm.mockRestore() }
})

it('opens the screenshot handoff directly and preserves source review and private draft saving', async () => {
  const screenshot = { id: 'images', status: 'ready', title: '待核对截图', files: [{ id: 'source', index: 0 }], candidates: [{ ...saved, sourcePages: [1] }] }
  const createPreview = URL.createObjectURL
  const revokePreview = URL.revokeObjectURL
  URL.createObjectURL = vi.fn(() => 'blob:job-original')
  URL.revokeObjectURL = vi.fn()
  campusData.mockImplementation(async (path) => {
    if (path === '/jobs/images') return { items: [screenshot] }
    if (path === '/jobs/images/images') return screenshot
    if (path.startsWith('/jobs?')) return { items: [saved], total: 1 }
    return null
  })
  campusFetch.mockImplementation(async (path) => path.endsWith('/source/0') ? new Blob(['original']) : { data: saved })
  try {
    render(<MemoryRouter initialEntries={['/jd?from=interview&entry=screenshot']}><JobsPage /></MemoryRouter>)
    expect(screen.getByLabelText('添加岗位截图')).toBeVisible()
    expect(screen.queryByRole('button', { name: '录入一个岗位' })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByText(/找回截图导入记录/))
    fireEvent.click(await screen.findByRole('button', { name: /待核对截图/ }))
    const useCandidate = await screen.findByRole('button', { name: '使用这个岗位，核对后保存' })
    await waitFor(() => expect(useCandidate).toBeEnabled())
    fireEvent.click(useCandidate)
    const description = screen.getByLabelText('岗位描述')
    fireEvent.change(description, { target: { value: '人工核对后的岗位要求' } })
    const reviewSource = screen.getByRole('button', { name: '核对截图原件' })
    fireEvent.click(reviewSource)
    expect(description).not.toBeVisible()
    expect(screen.getByRole('img', { name: '岗位截图 1' })).toBeVisible()
    expect(screen.queryByText(/找回截图导入记录/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '丢弃这组截图与原件' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回岗位编辑' }))
    expect(reviewSource).toHaveFocus()
    expect(description).toHaveValue('人工核对后的岗位要求')
    expect(screen.queryByLabelText('发布状态')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/interview?jobId=job&jobRevision=${encodeURIComponent(saved.updatedAt)}`))
    const write = campusFetch.mock.calls.find(([, options]) => options?.method === 'POST')
    expect(JSON.parse(write[1].body)).toMatchObject({ description: '人工核对后的岗位要求', status: 'draft' })
    expect(campusData).toHaveBeenCalledWith('/jobs/images/images/saved', expect.objectContaining({ method: 'POST' }))
  } finally { cleanup(); URL.createObjectURL = createPreview; URL.revokeObjectURL = revokePreview }
})

it('retries a failed detail without reopening the list and keeps subgroup links with gap results', async () => {
  let attempts = 0
  campusData.mockImplementation(async (path) => {
    if (path.startsWith('/jobs?')) return { items: [saved], total: 1 }
    if (path === '/jobs/images') return { items: [] }
    if (path.endsWith('/gap')) return { unknownSkills: [{ name: 'SQL' }] }
    if (++attempts === 1) throw { status: 503 }
    return saved
  })
  render(<MemoryRouter><JobsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: /合成岗位/ }))
  expect(await screen.findByRole('alert')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  expect(await screen.findByRole('heading', { name: '与岗位的距离' })).toBeVisible()
  expect(screen.getByText('SQL')).toBeVisible()
  expect(screen.getByRole('link', { name: '补充技能自评' })).toHaveAttribute('href', '/profile?view=skills')
  expect(screen.getByRole('link', { name: '补充可实习时间' })).toHaveAttribute('href', '/profile')
})

it('keeps AI requirements separate from the job until explicitly adopted', async () => {
  const requirements = [{ name: 'SQL', level: 1, required: true, evidence: '工作中需要 SQL' }]
  campusData.mockImplementation(async (path) => {
    if (path === '/jobs/analyze') return { requirements, questions: ['是否需要查询优化？'] }
    if (path.startsWith('/jobs?')) return { items: [saved], total: 1 }
    if (path === '/jobs/job') return saved
    return null
  })
  render(<MemoryRouter><JobsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: /合成岗位/ }))
  const analyze = await screen.findByText('AI 分析岗位要求')
  await waitFor(() => expect(analyze).toBeEnabled())
  fireEvent.click(screen.getByText(/时间与技能要求/))
  fireEvent.click(analyze)
  const adopt = await screen.findByRole('button', { name: '确认采用这些要求' })
  expect(screen.queryByLabelText('技能', { exact: true })).not.toBeInTheDocument()
  expect(campusFetch).not.toHaveBeenCalled()
  fireEvent.click(adopt)
  expect(screen.getByLabelText('技能', { exact: true })).toHaveValue('SQL')
  expect(screen.getByLabelText('岗位描述')).toHaveValue(saved.description)
  expect(campusFetch).not.toHaveBeenCalled()
})

it('keeps local screenshot files when returning to the list and reopening import', async () => {
  const createPreview = URL.createObjectURL
  const revokePreview = URL.revokeObjectURL
  URL.createObjectURL = vi.fn(() => 'blob:local-job')
  URL.revokeObjectURL = vi.fn()
  try {
    render(<MemoryRouter><JobsPage /></MemoryRouter>)
    const entry = await screen.findByRole('button', { name: '从岗位截图整理' })
    fireEvent.click(entry)
    fireEvent.change(screen.getByLabelText('添加岗位截图'), { target: { files: [new File(['job'], 'job.png', { type: 'image/png' })] } })
    expect(screen.getByRole('img', { name: '岗位截图 1' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '返回岗位列表' }))
    expect(entry).toHaveFocus()
    expect(screen.queryByRole('img', { name: '岗位截图 1' })).not.toBeInTheDocument()
    fireEvent.click(entry)
    expect(screen.getByRole('img', { name: '岗位截图 1' })).toBeVisible()
    expect(screen.getByRole('button', { name: '读取这些截图' })).toBeEnabled()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  } finally { cleanup(); URL.createObjectURL = createPreview; URL.revokeObjectURL = revokePreview }
})

it('locks return to the list until an unknown save is recovered', async () => {
  campusFetch.mockRejectedValue({ status: 0 })
  render(<MemoryRouter><JobsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: /合成岗位/ }))
  const description = await screen.findByLabelText('岗位描述')
  await waitFor(() => expect(description).toBeEnabled())
  fireEvent.change(description, { target: { value: '等待确认的岗位要求' } })
  fireEvent.click(screen.getByRole('button', { name: '保存岗位', exact: true }))
  const recover = await screen.findByRole('button', { name: '检查保存结果并继续' })
  expect(screen.getByRole('button', { name: '返回岗位列表' })).toBeDisabled()
  expect(description).toHaveValue('等待确认的岗位要求')
  campusFetch.mockResolvedValue({ data: { ...saved, description: '等待确认的岗位要求' } })
  fireEvent.click(recover)
  await waitFor(() => expect(screen.getByRole('button', { name: '返回岗位列表' })).toBeEnabled())
  expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1)
})

it('keeps the current page on a paging error and retries the failed destination', async () => {
  let pageTwoReads = 0
  campusData.mockImplementation(async (path) => {
    if (path.includes('page=1')) return { items: [saved], total: 21 }
    if (path.includes('page=2')) {
      if (++pageTwoReads === 1) throw { status: 503 }
      return { items: [{ ...saved, id: 'other', title: '另一个岗位' }], total: 21 }
    }
    return null
  })
  render(<MemoryRouter><JobsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '下一页' }))
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.getByRole('button', { name: /合成岗位/ })).toBeVisible()
  expect(screen.queryByText(/还没有岗位/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  expect(await screen.findByRole('button', { name: /另一个岗位/ })).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('continues to a resume using the currently saved job without rewriting it', async () => {
  render(<MemoryRouter><JobsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: /合成岗位/ }))
  const continueButton = await screen.findByRole('button', { name: '使用此岗位做简历' })
  await waitFor(() => expect(continueButton).toBeEnabled())
  fireEvent.click(continueButton)
  expect(navigate).toHaveBeenCalledWith(`/resume?jobId=job&jobRevision=${encodeURIComponent(saved.updatedAt)}`)
  expect(campusFetch).not.toHaveBeenCalled()
})

function renderMobileJobs(initialEntry = '/jd') {
  const previous = window.matchMedia
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
  const router = createMemoryRouter([{ path: '/jd', element: <UnsavedWorkProvider><JobsRouteHarness /></UnsavedWorkProvider> }], { initialEntries: [initialEntry] })
  render(<RouterProvider router={router} />)
  return { router, restore: () => { cleanup(); window.matchMedia = previous } }
}

it('returns to an acknowledged new job from Requirements via Forward', async () => {
  const { router, restore } = renderMobileJobs('/jd?ref=kept#handoff')
  try {
    fireEvent.click(await screen.findByRole('button', { name: '录入一个岗位' }))
    for (const [label, value] of [['企业', saved.company], ['岗位', saved.title], ['岗位描述', saved.description]]) {
      fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: /时间与技能要求/ }))
    fireEvent.click(screen.getByRole('button', { name: '保存岗位' }))
    await waitFor(() => expect(screen.getByLabelText('当前链接')).toHaveTextContent('?ref=kept&panel=requirements&jobId=job#handoff'))
    fireEvent.click(screen.getByRole('button', { name: '历史后退' }))
    expect(await screen.findByRole('button', { name: '录入一个岗位' })).toBeVisible()
    await act(() => router.navigate(1))
    expect(await screen.findByRole('heading', { name: '时间与技能要求' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '返回岗位详情' }))
    expect(await screen.findByLabelText('岗位描述')).toHaveValue(saved.description)
  } finally { restore() }
})

it('returns to the list on confirmed Back after an unknown save and recovers without another write', async () => {
  campusFetch.mockRejectedValue({ status: 0 })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  const { restore } = renderMobileJobs()
  try {
    fireEvent.click(await screen.findByRole('button', { name: /合成岗位/ }))
    const description = await screen.findByLabelText('岗位描述')
    await waitFor(() => expect(description).toBeEnabled())
    fireEvent.change(description, { target: { value: '待确认的修改' } })
    fireEvent.click(screen.getByRole('button', { name: '保存岗位' }))
    await screen.findByRole('button', { name: '检查保存结果并继续' })
    fireEvent.click(screen.getByRole('button', { name: '历史后退' }))
    expect(await screen.findByRole('button', { name: '录入一个岗位' })).toBeVisible()
    expect(confirm).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '返回待确认的岗位' }))
    expect(await screen.findByLabelText('岗位描述')).toHaveValue('待确认的修改')
    campusFetch.mockResolvedValue({ data: { ...saved, description: '待确认的修改' } })
    fireEvent.click(screen.getByRole('button', { name: '检查保存结果并继续' }))
    expect(await screen.findByText('岗位已保存。')).toBeVisible()
    expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1)
  } finally { restore(); confirm.mockRestore() }
})

it('keeps the screenshot action in mobile history', async () => {
  const { router, restore } = renderMobileJobs('/jd?from=interview#handoff')
  try {
    fireEvent.click(await screen.findByRole('button', { name: '从岗位截图整理' }))
    expect(await screen.findByLabelText('添加岗位截图')).toBeVisible()
    expect(screen.getByLabelText('当前链接')).toHaveTextContent('?from=interview&entry=screenshot#handoff')
    fireEvent.click(screen.getByRole('button', { name: '历史后退' }))
    expect(await screen.findByRole('button', { name: '录入一个岗位' })).toBeVisible()
    await act(() => router.navigate(1))
    await waitFor(() => expect(screen.getByLabelText('添加岗位截图')).toBeVisible())
  } finally { restore() }
})

it('links server date-range validation to the end date without losing the draft', async () => {
  campusFetch.mockRejectedValue({ status: 400, code: 'VALIDATION_FAILED', details: [{ field: 'availability', code: 'custom' }] })
  const { restore } = renderMobileJobs('/jd?jobId=job')
  try {
    fireEvent.click(await screen.findByRole('button', { name: /时间与技能要求/ }))
    const end = screen.getByLabelText('结束日期')
    fireEvent.change(end, { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-11-01' } })
    fireEvent.click(screen.getByRole('button', { name: '返回岗位详情' }))
    await waitFor(() => expect(end).not.toBeVisible())
    await waitFor(() => expect(screen.getByRole('button', { name: '保存岗位' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '保存岗位' }))
    fireEvent.click(await screen.findByRole('button', { name: '修改时间与技能要求' }))
    await waitFor(() => expect(end).toHaveFocus())
    expect(end).toHaveValue('2026-10-01')
  } finally { restore() }
})

it('reveals an invalid requirement and focuses it before sending a save', async () => {
  const { restore } = renderMobileJobs('/jd?jobId=job')
  try {
    fireEvent.click(await screen.findByRole('button', { name: /时间与技能要求/ }))
    const add = screen.getByRole('button', { name: '手动添加技能' })
    await waitFor(() => expect(add).toBeEnabled())
    fireEvent.click(add)
    const skill = screen.getByLabelText('技能', { exact: true })
    fireEvent.click(screen.getByRole('button', { name: '返回岗位详情' }))
    await waitFor(() => expect(skill).not.toBeVisible())
    fireEvent.click(screen.getByRole('button', { name: '保存岗位' }))
    await waitFor(() => expect(skill).toHaveFocus())
    expect(campusFetch).not.toHaveBeenCalled()
  } finally { restore() }
})
