import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import HomePage from '../HomePage'
import { campusData, campusFetch } from '../../api'

vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), resumeRows: (payload) => payload.data, errorText: () => '读取失败', downloadDiagnostics: vi.fn() }))
vi.mock('../../components/Slogan', () => ({ default: () => <h1>职芽</h1> }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('offers import when persisted progress is genuinely empty', async () => {
  campusData.mockResolvedValue({ student: {} })
  campusFetch.mockResolvedValue({ data: [] })
  render(<MemoryRouter><HomePage /></MemoryRouter>)
  expect(await screen.findByRole('link', { name: '导入简历' })).toHaveAttribute('href', '/resume?import=1')
  expect(screen.getByRole('link', { name: '没简历也可以给我讲讲你感兴趣的事' })).toHaveAttribute('href', '/discovery')
})

it('prioritizes an unfinished discovery over existing resume work', async () => {
  campusData.mockResolvedValue({ student: {} })
  campusFetch.mockImplementation(async (path) => ({ data: path.startsWith('/api/resumes?') ? [{ id: 'resume', title: '材料' }] : [{ id: 'conversation', status: 'in_progress', purpose: 'discovery' }] }))
  render(<MemoryRouter><HomePage /></MemoryRouter>)
  expect(await screen.findByRole('link', { name: '继续上次交流' })).toHaveAttribute('href', '/interview/session/conversation')
  expect(screen.queryByRole('link', { name: '导入简历' })).not.toBeInTheDocument()
})

it('does not misrepresent failed progress loading as an empty first visit', async () => {
  campusData.mockRejectedValue(new Error('unavailable'))
  campusFetch.mockResolvedValue({ data: [] })
  render(<MemoryRouter><HomePage /></MemoryRouter>)
  await screen.findByText('读取失败')
  expect(screen.queryByRole('link', { name: '导入简历' })).not.toBeInTheDocument()
  expect(screen.queryByText('从这里开始')).not.toBeInTheDocument()
})

it('resumes an unfinished import instead of requesting another upload', async () => {
  campusData.mockResolvedValue({ items: [{ id: 'draft', status: 'save_unknown' }] })
  campusFetch.mockResolvedValue({ data: [] })
  render(<MemoryRouter><HomePage /></MemoryRouter>)
  expect(await screen.findByRole('link', { name: '继续核对上次导入' })).toHaveAttribute('href', '/resume?import=1&importId=draft')
})

it('requests the latest saved resume rather than relying on creation-order pagination', async () => {
  campusData.mockResolvedValue({ items: [] })
  campusFetch.mockImplementation(async (path) => ({ data: path === '/api/resumes?sort=-lastModified&limit=1' ? [{ id: 'edited-older-resume', title: '最近修改的简历' }] : [] }))
  render(<MemoryRouter><HomePage /></MemoryRouter>)
  expect(await screen.findByRole('link', { name: '继续整理：最近修改的简历' })).toHaveAttribute('href', '/resume?resumeId=edited-older-resume')
  expect(campusFetch).toHaveBeenCalledWith('/api/resumes?sort=-lastModified&limit=1', expect.objectContaining({ signal: expect.any(AbortSignal) }))
})
