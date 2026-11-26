import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import ImportPanel from '../ImportPanel'
import ImportConfirm from '../ImportConfirm'
import { campusData, campusFetch } from '../../api'

vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), downloadBlob: vi.fn(), downloadDiagnostics: vi.fn(), errorText: (error) => error?.message }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
const draft = { id: 'draft', status: 'ready', kept: true, canContinue: false, phase: '请核对', resumeTitle: '已有简历', resumeId: 'resume', resumeChoices: [{ id: 'resume', title: '已有简历' }], issues: [], candidates: [], blocks: [{ id: 'page1', text: '原文' }], result: { name: '原姓名', education: [{ institution: '测试学校', dateText: '2020年9月—至今' }], experiences: [], skills: [{ name: '写作' }], otherMaterials: '证书原文' } }

it('renders no confirmation for an absent import rather than crashing', () => {
  const view = render(<ImportConfirm draft={null} />)
  expect(view.container).toBeEmptyDOMElement()
})

it('recovers structured editable results and freezes reviewed fields on save', async () => {
  campusData.mockImplementation(async (path) => path === '/imports' ? { items: [draft] } : draft)
  campusFetch.mockResolvedValue({ success: true, saved: true, data: { ...draft, status: 'saved' } })
  render(<MemoryRouter><ImportPanel /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '已有简历 · 请核对' }))
  expect(await screen.findByLabelText('学校')).toHaveValue('测试学校')
  expect(screen.getByLabelText('时间（保留月份与至今）')).toHaveValue('2020年9月—至今')
  fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '核对姓名' } })
  fireEvent.click(screen.getByRole('button', { name: '补充我的档案，并更新《已有简历》' }))
  await waitFor(() => expect(campusFetch).toHaveBeenCalled())
  const [path, options] = campusFetch.mock.calls[0]
  expect(path).toBe('/api/campus/imports/draft/confirm')
  expect(JSON.parse(options.body)).toMatchObject({ resumeId: 'resume', result: { name: '核对姓名', otherMaterials: '证书原文' }, skipIssues: false })
  expect(await screen.findByRole('button', { name: '恢复导入前的版本' })).toBeInTheDocument()
})

it('separates unknown save recovery from another editable confirmation', async () => {
  campusData.mockImplementation(async (path) => path === '/imports' ? { items: [draft] } : campusFetch.mock.calls.length ? { ...draft, frozen: true, status: 'save_unknown', canContinue: true } : draft)
  campusFetch.mockRejectedValue(Object.assign(new Error('结果未知'), { code: 'NETWORK_ERROR' }))
  render(<MemoryRouter><ImportPanel /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '已有简历 · 请核对' }))
  fireEvent.click(await screen.findByRole('button', { name: '补充我的档案，并更新《已有简历》' }))
  expect(await screen.findByRole('button', { name: '检查保存结果并继续' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '补充我的档案，并更新《已有简历》' })).not.toBeInTheDocument()
})

it('keeps extraction status out of the biography input', async () => {
  const extracted = { ...draft, result: { ...draft.result, summary: '已整理 2 段经历' } }
  campusData.mockImplementation(async (path) => path === '/imports' ? { items: [extracted] } : extracted)
  render(<MemoryRouter><ImportPanel /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '已有简历 · 请核对' }))
  expect(await screen.findByLabelText('简介')).toHaveValue('')
})

it('sends the original filename with the binary upload', async () => {
  campusData.mockResolvedValue({ items: [] })
  campusFetch.mockResolvedValue({ success: true, data: draft })
  render(<MemoryRouter><ImportPanel /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: '导入简历', exact: true }))
  const file = new File(['pdf'], '中文原件.pdf', { type: 'application/pdf' })
  fireEvent.change(screen.getByLabelText('上传已有简历'), { target: { files: [file] } })
  await waitFor(() => expect(campusFetch).toHaveBeenCalled())
  expect(campusFetch.mock.calls[0][1]).toMatchObject({ body: file, headers: { 'X-File-Name': encodeURIComponent(file.name), 'Content-Type': 'application/pdf' } })
})

it.each([500, 409])('reconciles a frozen confirmation after HTTP %s rather than accepting more edits', async (status) => {
  campusData.mockImplementation(async (path) => path === '/imports' ? { items: [draft] } : campusFetch.mock.calls.length ? { ...draft, frozen: true, status: 'save_unknown', canContinue: true, result: { ...draft.result, name: '服务器冻结姓名' } } : draft)
  campusFetch.mockRejectedValue(Object.assign(new Error('写入未完成'), { status, code: 'IMPORT_FAILED' }))
  render(<MemoryRouter><ImportPanel /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '已有简历 · 请核对' }))
  fireEvent.click(await screen.findByRole('button', { name: '补充我的档案，并更新《已有简历》' }))
  expect(await screen.findByRole('button', { name: '检查保存结果并继续' })).toBeInTheDocument()
  expect(screen.getByLabelText('姓名')).toHaveValue('服务器冻结姓名')
  expect(screen.getByLabelText('姓名')).toBeDisabled()
})

it('holds the parent mutation lock until its asynchronous refresh finishes', async () => {
  let finishRefresh
  const onSaved = vi.fn(() => new Promise((resolve) => { finishRefresh = resolve }))
  const onMutationChange = vi.fn()
  campusData.mockImplementation(async (path) => path === '/imports' ? { items: [draft] } : draft)
  campusFetch.mockResolvedValue({ saved: true, data: { ...draft, saved: true, status: 'saved' } })
  render(<MemoryRouter><ImportPanel onSaved={onSaved} onMutationChange={onMutationChange} /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '已有简历 · 请核对' }))
  fireEvent.click(await screen.findByRole('button', { name: '补充我的档案，并更新《已有简历》' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
  expect(onMutationChange.mock.calls).toEqual([[true]])
  expect(screen.getByRole('button', { name: '恢复导入前的版本' })).toBeDisabled()
  await act(async () => finishRefresh())
  await waitFor(() => expect(onMutationChange.mock.calls).toEqual([[true], [false]]))
})

it('keeps cache retry available after restoration and does not offer confirmation again', async () => {
  const restored = { ...draft, saved: false, frozen: true, status: 'restored', cachePending: true }
  campusData.mockImplementation(async (path) => path === '/imports' ? { items: [restored] } : restored)
  campusFetch.mockResolvedValue({ data: { ...restored, cachePending: false } })
  render(<MemoryRouter><ImportPanel /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '已有简历 · 请核对' }))
  fireEvent.click(await screen.findByRole('button', { name: '只重试刷新缓存' }))
  await waitFor(() => expect(campusFetch).toHaveBeenCalledWith('/api/campus/imports/draft/cache', expect.objectContaining({ method: 'POST' })))
  expect(screen.queryByRole('button', { name: '补充我的档案，并更新《已有简历》' })).not.toBeInTheDocument()
})

it('describes creating a new resume when no existing destination exists', async () => {
  const fresh = { ...draft, resumeId: null, resumeChoices: [], resumeTitle: '新简历' }
  campusData.mockImplementation(async (path) => path === '/imports' ? { items: [fresh] } : fresh)
  render(<MemoryRouter><ImportPanel /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '新简历 · 请核对' }))
  expect(await screen.findByRole('button', { name: '补充我的档案，并新建《新简历》' })).toBeInTheDocument()
})

it('returns an unknown save to editable review when reconciliation proves no writes occurred', async () => {
  let reads = 0
  campusData.mockImplementation(async (path) => {
    if (path === '/imports') return { items: [draft] }
    reads += 1
    if (reads === 1) return draft
    if (reads === 2) throw new Error('offline')
    return { ...draft, status: 'review', frozen: false }
  })
  campusFetch.mockRejectedValue(Object.assign(new Error('目标已修改'), { status: 409, code: 'REVISION_CONFLICT' }))
  render(<MemoryRouter><ImportPanel /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '已有简历 · 请核对' }))
  fireEvent.change(await screen.findByLabelText('姓名'), { target: { value: '保留核对修改' } })
  fireEvent.click(screen.getByRole('button', { name: '补充我的档案，并更新《已有简历》' }))
  fireEvent.click(await screen.findByRole('button', { name: '检查保存结果并继续' }))
  await waitFor(() => expect(screen.getByLabelText('姓名')).toBeEnabled())
  expect(screen.getByLabelText('姓名')).toHaveValue('保留核对修改')
  expect(screen.getByRole('button', { name: '补充我的档案，并更新《已有简历》' })).toBeEnabled()
})

it('keeps the upload control mounted when the inactive tool is collapsed', async () => {
  let resolveList
  campusData.mockImplementation(() => new Promise((resolve) => { resolveList = resolve }))
  render(<MemoryRouter><ImportPanel /></MemoryRouter>)
  await act(async () => { resolveList({ items: [] }) })
  const recovery = screen.getByText('找回导入记录（0）').closest('details')
  expect(recovery).not.toHaveAttribute('open')
  fireEvent.click(recovery.querySelector('summary'))
  expect(screen.getByRole('button', { name: '刷新记录' })).toBeVisible()
  const input = screen.getByLabelText('上传已有简历')
  const toggle = screen.getByRole('button', { name: '导入简历', exact: true })
  fireEvent.click(toggle)
  expect(input).toBeVisible()
  fireEvent.click(toggle)
  expect(input).not.toBeVisible()
  fireEvent.click(toggle)
  expect(screen.getByLabelText('上传已有简历')).toBe(input)
})

it('previews recognized items by destination and links to refreshed profile sections after one confirmation', async () => {
  campusData.mockImplementation(async (path) => path === '/imports' ? { items: [draft] } : draft)
  campusFetch.mockResolvedValue({ saved: true, data: { ...draft, saved: true, status: 'saved' } })
  const onSaved = vi.fn().mockResolvedValue(undefined)
  render(<MemoryRouter><ImportPanel profileMode onSaved={onSaved} /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '已有简历 · 请核对' }))
  expect(await screen.findByText('个人档案：姓名、1 条教育经历')).toBeVisible()
  expect(screen.getByText('经历与想法：0 段经历')).toBeVisible()
  expect(screen.getByText('技能与其他材料：1 项技能标签、其他原文材料')).toBeVisible()
  expect(screen.getByText(/不是实际写入数量/)).toBeVisible()
  expect(screen.getByLabelText('学校')).not.toBeVisible()
  expect(screen.queryByRole('link', { name: '查看个人档案' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '确认导入档案并更新《已有简历》' }))
  expect(await screen.findByRole('link', { name: '查看个人档案' })).toHaveAttribute('href', '/profile')
  expect(screen.getByRole('link', { name: '查看经历与想法' })).toHaveAttribute('href', '/profile?view=experiences')
  expect(screen.getByRole('link', { name: '查看技能与其他材料' })).toHaveAttribute('href', '/profile?view=skills')
  expect(campusFetch).toHaveBeenCalledOnce()
  expect(JSON.parse(campusFetch.mock.calls[0][1].body)).toMatchObject({ result: draft.result, resumeId: 'resume', skipIssues: false })
})

it('keeps targeted decisions visible and offers safe partial confirmation without opening details', async () => {
  const review = { ...draft, status: 'review', issues: [{ id: 'date', field: 'education.0', message: '请核对日期' }], candidates: [{ id: 'duplicate', title: '测试学校', message: '疑似重复' }] }
  campusData.mockImplementation(async (path) => path === '/imports' ? { items: [review] } : review)
  campusFetch.mockResolvedValue({ saved: true, data: { ...review, saved: true, status: 'saved' } })
  render(<MemoryRouter><ImportPanel profileMode /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '已有简历 · 请核对' }))
  const confirm = await screen.findByRole('button', { name: '确认导入档案并更新《已有简历》' })
  expect(confirm).toBeDisabled()
  expect(screen.getByRole('checkbox', { name: '已核对这处，以上结果正确' })).toBeVisible()
  fireEvent.change(screen.getByRole('combobox', { name: /疑似重复/ }), { target: { value: 'keep-existing' } })
  expect(confirm).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '先保存其余内容，跳过待核对部分' }))
  await screen.findByRole('link', { name: '查看个人档案' })
  expect(JSON.parse(campusFetch.mock.calls[0][1].body)).toMatchObject({ decisions: { duplicate: 'keep-existing' }, skipIssues: true })
})

it('retries only the profile refresh after acknowledged save and keeps editing locked until refresh succeeds', async () => {
  campusData.mockImplementation(async (path) => path === '/imports' ? { items: [draft] } : draft)
  campusFetch.mockResolvedValue({ saved: true, data: { ...draft, saved: true, status: 'saved' } })
  const onSaved = vi.fn().mockRejectedValueOnce(new Error('refresh failed')).mockResolvedValueOnce(undefined)
  const onMutationChange = vi.fn()
  render(<MemoryRouter><ImportPanel profileMode onSaved={onSaved} onMutationChange={onMutationChange} /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '已有简历 · 请核对' }))
  fireEvent.click(await screen.findByRole('button', { name: '确认导入档案并更新《已有简历》' }))
  const retry = await screen.findByRole('button', { name: '只重试刷新档案' })
  expect(screen.getByRole('alert')).toHaveTextContent('档案页面刷新失败')
  expect(screen.queryByRole('link', { name: '查看个人档案' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '检查保存结果并继续' })).not.toBeInTheDocument()
  expect(onMutationChange.mock.calls).toEqual([[true]])
  await waitFor(() => expect(retry).toBeEnabled())
  fireEvent.click(retry)
  expect(await screen.findByRole('link', { name: '查看个人档案' })).toBeVisible()
  expect(campusFetch).toHaveBeenCalledOnce()
  expect(onSaved).toHaveBeenCalledTimes(2)
  expect(onMutationChange.mock.calls).toEqual([[true], [false]])
})

it('opens a collapsed upload without remounting the input when a new shortcut is requested', async () => {
  campusData.mockResolvedValue({ items: [] })
  const view = render(<MemoryRouter><ImportPanel profileMode /></MemoryRouter>)
  await screen.findByText('找回导入记录（0）')
  const input = screen.getByLabelText('上传已有简历')
  expect(input).not.toBeVisible()
  view.rerender(<MemoryRouter><ImportPanel profileMode openRequest="shortcut-1" /></MemoryRouter>)
  expect(input).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '导入简历', exact: true }))
  expect(input).not.toBeVisible()
  view.rerender(<MemoryRouter><ImportPanel profileMode openRequest="shortcut-2" /></MemoryRouter>)
  expect(screen.getByLabelText('上传已有简历')).toBe(input)
  expect(input).toBeVisible()
})

it('does not present a frozen save plan as a saved destination or receipt', async () => {
  const pending = { ...draft, status: 'save_unknown', frozen: true, canContinue: true, changes: [{ kind: 'profile', changed: true }] }
  campusData.mockResolvedValueOnce({ items: [draft] }).mockResolvedValueOnce(draft).mockResolvedValueOnce(pending)
  campusFetch.mockRejectedValueOnce(new Error('network failed'))
  const onSaved = vi.fn()
  render(<MemoryRouter><ImportPanel profileMode onSaved={onSaved} /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '已有简历 · 请核对' }))
  fireEvent.click(await screen.findByRole('button', { name: '确认导入档案并更新《已有简历》' }))
  expect(await screen.findByRole('button', { name: '检查保存结果并继续' })).toBeEnabled()
  expect(screen.queryByRole('link', { name: '查看个人档案' })).not.toBeInTheDocument()
  expect(screen.queryByText('这次保存改了什么')).not.toBeInTheDocument()
  expect(onSaved).not.toHaveBeenCalled()
})
