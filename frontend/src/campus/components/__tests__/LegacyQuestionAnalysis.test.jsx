import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import QuestionAnalysisCard from '../../../components/interview/QuestionAnalysisCard'
vi.mock('../../../components/CopyButton', () => ({ default: () => null }))
vi.mock('framer-motion', () => ({ motion: { div: ({ children }) => <div>{children}</div> } }))
afterEach(cleanup)
it('uses only observed answer dimensions and displays unavailable breakdown values', () => {
  render(<QuestionAnalysisCard index={0} answer={{ question: 'Question', duration: 0, transcript: 'Answer', analysis: { relevance: 90, clarity: null, confidence: null } }} />)
  expect(screen.getByRole('button')).toHaveTextContent('90%')
  expect(screen.getByRole('button')).not.toHaveTextContent('30%')
  expect(screen.getByText('1/3 dimensions observed')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getAllByText('Not assessed')).toHaveLength(2)
})
it('does not create a zero or negative judgement from an entirely unscored answer', () => {
  render(<QuestionAnalysisCard index={0} answer={{ question: 'Question', analysis: { relevance: null, clarity: null, confidence: null } }} />)
  expect(screen.getByRole('button')).toHaveTextContent('Not assessed')
  expect(screen.getByRole('button')).not.toHaveTextContent('Needs Work')
  expect(screen.getByRole('button')).not.toHaveTextContent('0%')
})
it('retains a genuinely observed zero', () => {
  render(<QuestionAnalysisCard index={0} answer={{ question: 'Question', analysis: { relevance: 0, clarity: null, confidence: null } }} />)
  expect(screen.getByRole('button')).toHaveTextContent('0%')
  expect(screen.getByText('1/3 dimensions observed')).toBeInTheDocument()
})
