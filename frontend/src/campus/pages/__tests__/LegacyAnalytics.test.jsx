import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import Analytics from '../../../pages/Analytics'
import { interviewApi } from '../../../services/api'
vi.mock('../../../services/api', () => ({ interviewApi: { getAnalytics: vi.fn() } }))
vi.mock('../../../utils/logger', () => ({ default: { log: vi.fn() } }))
vi.mock('recharts', () => {
  const EmptyChart = () => null
  const Container = ({ children }) => <div>{children}</div>
  return { LineChart: EmptyChart, Line: EmptyChart, CartesianGrid: EmptyChart, XAxis: EmptyChart, YAxis: EmptyChart, Tooltip: EmptyChart, Legend: EmptyChart, ResponsiveContainer: Container, RadarChart: EmptyChart, PolarGrid: EmptyChart, PolarAngleAxis: EmptyChart, PolarRadiusAxis: EmptyChart, Radar: EmptyChart }
})
afterEach(() => { cleanup(); vi.clearAllMocks() })
const unscored = { _id: 'unscored', date: '2026-10-21', scoreVersion: 'available-v1', mode: 'mixed', overallScore: null, scoring: { overallScore: null, basis: [], comparisonKey: 'available-v1:mixed:' }, communication: null, confidence: null, technicalAccuracy: null }
it.each([false, true])('lists real unscored formal sessions with scored records present=%s', async (withScored) => {
  const scored = { ...unscored, _id: 'scored', date: '2026-10-20', overallScore: 80, scoring: { overallScore: 80, basis: ['clarity'], comparisonKey: 'available-v1:mixed:clarity' }, communication: 80 }
  interviewApi.getAnalytics.mockResolvedValue({ data: { sessions: withScored ? [scored, unscored] : [unscored] } })
  render(<MemoryRouter><Analytics /></MemoryRouter>)
  expect(await screen.findByText('Overall score: Not assessed')).toBeInTheDocument()
  expect(screen.queryByText('No interview history available yet.')).not.toBeInTheDocument()
  const sessionsCard = screen.getByText('Sessions').parentElement.parentElement
  expect(within(sessionsCard).getByText(withScored ? '2' : '1')).toBeInTheDocument()
  const averageCard = screen.getByText('Avg. Score').parentElement.parentElement
  expect(within(averageCard).getByText(withScored ? '80%' : 'Not assessed')).toBeInTheDocument()
})
