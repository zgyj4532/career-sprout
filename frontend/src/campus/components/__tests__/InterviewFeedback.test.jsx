import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { RoomReport, ScoreBasis } from '../InterviewFeedback'
import { comparisonKey, interviewScore } from '../../../utils/interviewScores'
import { analyzePerformance } from '../../../utils/interviewAnalyzer'

afterEach(cleanup)
const score = { purpose: 'interview', mode: 'mixed', scoreVersion: 'available-v1', overallScore: 0, scoring: { overallScore: 0, comparisonKey: 'available-v1:mixed:clarity', basis: ['clarity'], dimensions: { clarity: { score: 0, observed: 1, answered: 2, effectiveWeight: 1 }, expression: { score: null, observed: 0, answered: 2, effectiveWeight: 0 } } } }
it('preserves true zero and missing dimensions from the canonical report', () => {
  render(<MemoryRouter><RoomReport item={{ ...score, answers: [], overallFeedback: { recommendations: ['先补充具体行动'] } }} /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: '本次成绩：0分' })).toBeInTheDocument()
  expect(screen.getByText(/实际表达观察：未测；覆盖 0\/2/)).toBeInTheDocument()
  expect(screen.getByText(/表达清楚：0；覆盖 1\/2/)).toBeInTheDocument()
})
it('does not manufacture a total when every observation is missing', () => {
  render(<MemoryRouter><RoomReport item={{ ...score, overallScore: 0, scoring: { ...score.scoring, overallScore: null, basis: [], dimensions: {} } }} /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: '本次成绩：暂无可用总分' })).toBeInTheDocument()
})
it('labels legacy values and excludes discovery from all comparisons', () => {
  render(<ScoreBasis item={{ overallScore: 0 }} />)
  expect(screen.getByText(/旧规则成绩/)).toBeInTheDocument()
  expect(interviewScore({ overallScore: 0 })).toBe(0)
  expect(interviewScore({ ...score, purpose: 'discovery' })).toBeNull()
  expect(comparisonKey({ ...score, purpose: 'discovery' })).toBeNull()
  expect(comparisonKey(score)).not.toBe(comparisonKey({ overallScore: 0, mode: 'mixed' }))
})
it('does not infer weaknesses from missing dimensions or compare incompatible scopes', () => {
  expect(analyzePerformance([{ ...score, communication: null, technicalAccuracy: null, confidence: null }]).weaknesses).toEqual([])
  expect(analyzePerformance([{ ...score, communication: 0 }, { overallScore: 100, mode: 'mixed', communication: 100 }]).improvement).toBeNull()
})
it('reveals missing points and reference answers after only one disclosure', () => {
  render(<MemoryRouter><RoomReport item={{ ...score, answers: [{ questionId: 'q1', question: '问题', transcript: '回答', analysis: { whatWasMissing: ['缺少行动依据'], idealAnswer: '说明实际采取的行动' } }] }} /></MemoryRouter>)
  const summary = screen.getByText('逐题查看回答与反馈（1）')
  fireEvent.click(summary)
  // jsdom does not implement the native details default action.
  summary.parentElement.open = true
  const missing = screen.getByText('缺少行动依据')
  const reference = screen.getByText('说明实际采取的行动', { exact: false })
  expect(missing).toBeVisible()
  expect(reference).toBeVisible()
  expect(missing.closest('details')).toBe(summary.parentElement)
  expect(reference.closest('details')).toBe(summary.parentElement)
})

it('shows one actionable recommendation while preserving complete secondary feedback behind one disclosure', () => {
  const first = '先讲清楚你实际负责的工作。'.repeat(12)
  const second = '下一次补充具体约束与选择。'.repeat(12)
  const overview = '这是本次完整总结。'.repeat(20)
  render(<MemoryRouter><RoomReport item={{ ...score, answers: [], overallFeedback: { summary: overview, recommendations: [first, second, first], areasToImprove: ['补充验证过程'], topStrengths: ['目标说明清楚'] } }} /></MemoryRouter>)
  expect(screen.getByText(first)).toBeVisible()
  expect(screen.getAllByText(first)).toHaveLength(1)
  expect(screen.getByRole('heading', { name: '本次成绩：0分' })).toBeVisible()
  expect(screen.getByText('评分范围：表达清楚')).toBeVisible()
  expect(screen.getByText('回答覆盖：表达清楚 1/2')).toBeVisible()
  const secondary = [second, overview, '补充验证过程', '目标说明清楚']
  secondary.forEach((text) => expect(screen.getByText(text)).not.toBeVisible())
  const summary = screen.getByText('更多建议与本次表现')
  fireEvent.click(summary)
  summary.parentElement.open = true
  secondary.forEach((text) => {
    expect(screen.getByText(text)).toBeVisible()
    expect(screen.getByText(text).closest('details')).toBe(summary.parentElement)
  })
  expect(screen.getAllByText(first)).toHaveLength(1)
})
