import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import DiscoveryReport from '../DiscoveryReport'
import { campusFetch } from '../../api'

vi.mock('../../api', () => ({ campusFetch: vi.fn(), errorText: () => '请求未完成', downloadDiagnostics: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
const candidate = { id: 'idea', kind: 'experience', value: '想做校园地图', state: 'idea', source: { questionId: 'q1', excerpt: '想做校园地图' } }
const item = { _id: 'session', purpose: 'discovery', answers: [{ questionId: 'q1', transcript: '想做校园地图' }], discovery: { summary: '讨论了一个设想', advice: ['补充你想解决的问题'], candidates: [candidate] } }
const record = { status: 'unconfirmed', candidates: [candidate], expected: { collegeStudent: null, major: '' }, frozen: null }
function report(value = item) { render(<MemoryRouter><DiscoveryReport item={value} /></MemoryRouter>) }

it('skips without writing profile and never displays an ability score', async () => {
  campusFetch.mockResolvedValue({ data: record })
  report()
  fireEvent.click(await screen.findByRole('button', { name: '暂不保存' }))
  expect(campusFetch.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  expect(screen.queryByText(/本次成绩/)).not.toBeInTheDocument()
})

it('keeps edited candidates on a failed save and reconciles lost success without another POST', async () => {
  let completed = false
  let attempt = 0
  campusFetch.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') {
      attempt += 1
      if (attempt === 2) completed = true
      throw new Error('response unavailable')
    }
    return { data: completed ? { ...record, status: 'completed' } : record }
  })
  report()
  fireEvent.change(await screen.findByLabelText('经历或想法'), { target: { value: '想先访问同学再设计地图' } })
  fireEvent.click(screen.getByRole('button', { name: '保存到个人资料' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '保存到个人资料' })).not.toBeDisabled())
  expect(screen.getByLabelText('经历或想法')).toHaveValue('想先访问同学再设计地图')
  fireEvent.click(screen.getByRole('button', { name: '保存到个人资料' }))
  await screen.findByText(/已保存到个人资料/)
  const posts = campusFetch.mock.calls.filter(([, options]) => options?.method === 'POST')
  expect(posts).toHaveLength(2)
  expect(JSON.parse(posts[1][1].body).candidates).toEqual([{ id: 'idea', value: '想先访问同学再设计地图', state: 'idea' }])
})

it('recovers immutable partial edits while allowing explicit unresolved target conflict choice', async () => {
  const major = { id: 'major', kind: 'major', value: '计算机', source: { questionId: 'q1', excerpt: '计算机' } }
  const frozen = { candidates: [{ id: 'major', value: '软件工程' }], expected: { collegeStudent: null, major: '旧专业' }, resolutions: {} }
  campusFetch.mockResolvedValue({ data: { ...record, status: 'partial', candidates: [major], frozen, expected: { collegeStudent: null, major: '数学' }, steps: { student: true } } })
  report()
  const input = await screen.findByLabelText('专业')
  expect(input).toHaveValue('软件工程')
  expect(input).toBeDisabled()
  const resolve = screen.getByLabelText(/已有专业/)
  expect(resolve).not.toBeDisabled()
  fireEvent.change(resolve, { target: { value: 'keep' } })
  fireEvent.click(screen.getByRole('button', { name: '继续保存已确认资料' }))
  await waitFor(() => expect(campusFetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(true))
  const body = JSON.parse(campusFetch.mock.calls.find(([, options]) => options?.method === 'POST')[1].body)
  expect(body).toEqual({ candidates: frozen.candidates, expected: { collegeStudent: null, major: '数学' }, resolutions: { major: 'keep' } })
})

it('makes no extraction or confirmation request for a zero-answer conversation', () => {
  report({ ...item, answers: [], discovery: { summary: '', advice: [], candidates: [] } })
  expect(campusFetch).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: '保存到个人资料' })).not.toBeInTheDocument()
})

it('uses acknowledged completed confirmation without depending on another read', async () => {
  let reads = 0
  campusFetch.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') return { data: { ...record, status: 'completed', cachePending: true } }
    if (++reads > 1) throw new Error('refresh unavailable')
    return { data: record }
  })
  report()
  fireEvent.click(await screen.findByRole('button', { name: '保存到个人资料' }))
  await screen.findByText(/已保存到个人资料/)
  expect(screen.getByText(/资料已保存，但缓存刷新尚未完成/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '恢复资料保存进度' })).not.toBeInTheDocument()
  expect(reads).toBe(1)
})

it('shows conservative extraction omissions without presenting a failed save', async () => {
  campusFetch.mockResolvedValue({ data: record })
  report({ ...item, discovery: { ...item.discovery, uncertainties: ['身份归属不明确，未写入候选资料。'] } })
  expect(screen.getByText('身份归属不明确，未写入候选资料。')).toBeVisible()
  await screen.findByRole('button', { name: '保存到个人资料' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
