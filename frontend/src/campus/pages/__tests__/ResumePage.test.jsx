import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ResumePage from '../ResumePage'
import { campusData, campusFetch } from '../../api'
const navigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (original) => ({ ...await original(), useNavigate: () => navigate }))

vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), resumeRows: (payload) => payload.data, logClientEvent: vi.fn(), downloadBlob: vi.fn(), downloadDiagnostics: vi.fn(), errorText: () => '请求未完成' }))
vi.mock('../../components/VoiceReview', () => ({ default: () => null }))
vi.mock('../../components/TargetResumes', () => ({ default: () => null }))
vi.mock('../../components/JobSelect', () => ({ default: () => null }))
vi.mock('../../components/ImportPanel', () => ({ default: () => null }))
const stored = { id: 'saved', title: '已保存简历', jobRole: '测试方向', originalText: '真实经历测试文本', revision: 3, contentRevision: 2 }
beforeEach(() => {
  campusData.mockImplementation((path) => Promise.resolve(path === '/me' ? { profile: {}, student: { targetJobId: null } } : { items: [] }))
  campusFetch.mockImplementation((path) => Promise.resolve({ data: path === '/api/resumes' ? [stored] : stored }))
})
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks() })
const open = () => render(<MemoryRouter><ResumePage /></MemoryRouter>)

it('does not prompt when replacing an untouched blank draft', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  open()
  fireEvent.click(await screen.findByRole('button', { name: '已保存简历' }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText))
  expect(confirm).not.toHaveBeenCalled()
})
it('keeps cleared body and changed metadata when discarding is cancelled', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  open()
  fireEvent.click(await screen.findByRole('button', { name: '已保存简历' }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText))
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: '' } })
  expect(screen.getByLabelText('简历标题')).toHaveAttribute('readonly')
  fireEvent.click(screen.getByRole('button', { name: '已保存简历' }))
  fireEvent.click(screen.getByRole('button', { name: '新建空白简历' }))
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue('')
  expect(screen.getByLabelText('简历标题')).toHaveValue(stored.title)
  expect(screen.getByLabelText('想尝试的岗位（可留空）')).toHaveValue(stored.jobRole)
})
it('guards metadata-only edits on an otherwise blank draft', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  open()
  await screen.findByRole('button', { name: '已保存简历' })
  fireEvent.change(screen.getByLabelText('简历标题'), { target: { value: '仅有标题' } })
  fireEvent.click(screen.getByRole('button', { name: '新建空白简历' }))
  expect(confirm).toHaveBeenCalledOnce()
  expect(screen.getByLabelText('简历标题')).toHaveValue('仅有标题')
})

it('sends the server revision without title in a body save', async () => {
  open()
  fireEvent.click(await screen.findByRole('button', { name: stored.title }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText))
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
  fireEvent.click(await screen.findByRole('button', { name: stored.title }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText))
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: '正在写的内容' } })
  screen.getAllByText('管理', { selector: 'summary' }).forEach((summary) => fireEvent.click(summary))
  fireEvent.click(screen.getAllByRole('button', { name: '改名', exact: true })[1])
  await waitFor(() => expect(campusFetch).toHaveBeenCalledWith('/api/resumes/other', expect.objectContaining({ method: 'PUT' })))
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue('正在写的内容')
})

it('uses the acknowledged saved version when continuing, not a speculative reread', async () => {
  const saved = { ...stored, originalText: '刚保存的经历', revision: 4 }
  campusFetch.mockImplementation((path, options) => Promise.resolve({ data: path === '/api/resumes' ? [stored] : options?.method === 'PUT' ? saved : stored }))
  const view = render(<MemoryRouter><ResumePage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: stored.title }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText))
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
  fireEvent.click(await screen.findByRole('button', { name: stored.title }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText))
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
  fireEvent.click(await screen.findByRole('button', { name: stored.title }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText))
  fireEvent.change(screen.getByLabelText('真实经历与简历正文'), { target: { value: acknowledged.originalText } })
  fireEvent.click(screen.getByRole('button', { name: '保存简历', exact: true }))
  await screen.findByText(/列表刷新失败/)
  expect(screen.getByLabelText('真实经历与简历正文')).toBeEnabled()
  expect(screen.queryByRole('button', { name: '检查保存结果并继续' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '继续准备面试' }))
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/interview?resumeId=saved&resumeRevision=4'))
  expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1)
})

it('shows the compression comparison and opens a new unsaved resume without replacing the source', async () => {
  campusFetch.mockImplementation((path) => Promise.resolve({ data: path === '/api/resumes' ? [stored] : path.includes('/download?') ? {
    pdf: 'JVBERg==', compression: { original: stored.originalText, draft: '保留的真实经历', changes: ['省略一段'] },
  } : stored }))
  open()
  fireEvent.click(await screen.findByRole('button', { name: stored.title }))
  await waitFor(() => expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue(stored.originalText))
  fireEvent.click(screen.getByRole('button', { name: '下载确认版 PDF' }))
  await screen.findByText('省略一段')
  expect(screen.getByText(stored.originalText)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '作为新简历修改压缩稿' }))
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue('保留的真实经历')
  expect(screen.getByLabelText('简历标题')).not.toHaveAttribute('readonly')
  expect(screen.getByRole('button', { name: '下载确认版 PDF' })).toBeDisabled()
  expect(campusFetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
})
