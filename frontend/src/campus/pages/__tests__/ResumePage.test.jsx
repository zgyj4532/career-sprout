import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ResumePage from '../ResumePage'
import { campusData, campusFetch } from '../../api'

vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), resumeRows: (payload) => payload.data, logClientEvent: vi.fn(), downloadBlob: vi.fn(), downloadDiagnostics: vi.fn(), errorText: () => '请求未完成' }))
vi.mock('../../components/VoiceInput', () => ({ default: () => null }))
vi.mock('../../components/TargetResumes', () => ({ default: () => null }))
vi.mock('../../components/JobSelect', () => ({ default: () => null }))
const stored = { id: 'saved', title: '已保存简历', jobRole: '测试方向', originalText: '真实经历测试文本' }
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
  fireEvent.change(screen.getByLabelText('简历标题'), { target: { value: '尚未保存的标题' } })
  fireEvent.click(screen.getByRole('button', { name: '已保存简历' }))
  fireEvent.click(screen.getByRole('button', { name: '新建空白简历' }))
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(screen.getByLabelText('真实经历与简历正文')).toHaveValue('')
  expect(screen.getByLabelText('简历标题')).toHaveValue('尚未保存的标题')
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
