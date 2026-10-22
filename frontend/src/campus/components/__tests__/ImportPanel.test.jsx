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
