import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { HistoryPage } from '../HistoryPage'
import { campusFetch } from '../../api'
vi.mock('../../api', () => ({ campusFetch: vi.fn(), errorText: () => '读取失败', downloadDiagnostics: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
it('does not display a false empty state while loading or after failure', async () => {
  let reject
  campusFetch.mockImplementation(() => new Promise((resolve, fail) => { reject = fail }))
  render(<MemoryRouter><HistoryPage /></MemoryRouter>)
  expect(screen.getByRole('status')).toHaveTextContent('正在读取')
  expect(screen.queryByText(/还没有交流或面试档案/)).not.toBeInTheDocument()
  await act(async () => reject(new Error('network unavailable')))
  expect(screen.queryByText(/还没有交流或面试档案/)).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toBeInTheDocument()
})
it('shows discovery without its legacy accidental numeric value and retains genuine legacy zero', async () => {
  campusFetch.mockResolvedValue({ data: [{ _id: 'discovery', purpose: 'discovery', status: 'completed', overallScore: 99 }, { _id: 'legacy', status: 'completed', overallScore: 0 }] })
  render(<MemoryRouter><HistoryPage /></MemoryRouter>)
  await screen.findByText(/兴趣交流 · 不评分/)
  expect(screen.queryByText(/99分/)).not.toBeInTheDocument()
  expect(screen.getByText(/旧规则成绩 · 0分/)).toBeInTheDocument()
})
it('keeps each numeric score scope and observation coverage visible without expanding records', async () => {
  campusFetch.mockResolvedValue({ data: [{ _id: 'clarity', status: 'completed', overallScore: 80, mode: 'mixed', scoreVersion: 'available-v1', scoring: { basis: ['clarity'], dimensions: { clarity: { score: 80, observed: 1, answered: 2, effectiveWeight: 1 } } } }, { _id: 'relevance', status: 'completed', overallScore: 80, mode: 'mixed', scoreVersion: 'available-v1', scoring: { basis: ['relevance'], dimensions: { relevance: { score: 80, observed: 2, answered: 2, effectiveWeight: 1 } } } }] })
  render(<MemoryRouter><HistoryPage /></MemoryRouter>)
  expect(await screen.findByText('评分范围：表达清楚')).toBeVisible()
  expect(screen.getByText('评分范围：贴题程度')).toBeVisible()
  expect(screen.getByText(/表达清楚：80；覆盖 1\/2/)).toBeVisible()
  expect(screen.getByText(/贴题程度：80；覆盖 2\/2/)).toBeVisible()
})
