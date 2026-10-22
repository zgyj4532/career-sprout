import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import JobsPage from '../JobsPage'
import { campusData, campusFetch } from '../../api'

const navigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (original) => ({ ...await original(), useNavigate: () => navigate }))
vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), errorText: () => '请求未完成', downloadDiagnostics: vi.fn() }))
vi.mock('../../auth', () => ({ useCampusSession: () => ({ status: { user: { uid: 'owner' } } }) }))
vi.mock('../../components/JobImageImport', () => ({ default: () => null }))
const saved = { id: 'job', creatorUid: 'owner', company: '合成企业', title: '合成岗位', description: '真实岗位要求', source: '', authorKind: 'student', status: 'draft', requirements: [], availability: {}, updatedAt: '2026-10-21T01:00:00.000Z' }
beforeEach(() => {
  localStorage.clear()
  campusData.mockImplementation(async (path) => path.startsWith('/jobs?') ? { items: [saved], total: 1 } : path === '/jobs/job' ? saved : path === '/jobs/job/gap' ? null : {})
  campusFetch.mockResolvedValue({ data: saved })
})
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('saves edits with the loaded token and navigates with the acknowledged job version', async () => {
  const acknowledged = { ...saved, description: '新要求', updatedAt: '2026-10-21T02:00:00.000Z' }
  campusFetch.mockResolvedValue({ data: acknowledged })
  render(<MemoryRouter initialEntries={['/jd?from=interview']}><JobsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: /合成岗位/ }))
  fireEvent.change(await screen.findByLabelText('岗位描述'), { target: { value: '新要求' } })
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
  fireEvent.change(await screen.findByLabelText('岗位描述'), { target: { value: '尚未保存的要求' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并继续', exact: true }))
  await waitFor(() => expect(screen.getByLabelText('岗位描述')).toBeEnabled())
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
  expect(screen.getByLabelText('岗位描述')).toBeEnabled()
  expect(screen.queryByRole('button', { name: '检查保存结果并继续' })).not.toBeInTheDocument()
  expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1)
})
