import { expect, it } from 'vitest'
import { normalizeProgress, progressFor, updateDifficulty } from '../../utils/interviewDifficulty'

const result = (mode, basis, score) => ({ purpose: 'interview', mode, scoreVersion: 'available-v1', scoring: { overallScore: score, comparisonKey: `available-v1:${mode}:${basis}`, basis: [basis] } })
it('retains historical progress without adding it into a new scoring scope', () => {
  const legacy = { level: 'Advanced', streak: 2, failCount: 0, totalScore: 900, completedInterviews: 10, averageScore: 90 }
  const record = result('mixed', 'clarity', 80)
  const ledger = updateDifficulty(record, legacy)
  expect(ledger.legacy).toEqual(legacy)
  expect(progressFor(record, ledger)).toMatchObject({ level: 'Beginner', streak: 1, totalScore: 80, completedInterviews: 1, averageScore: 80 })
  expect(normalizeProgress(ledger)).toBe(ledger)
})
it('keeps mode and observation-basis streaks independent', () => {
  const mixed = result('mixed', 'clarity', 90)
  const technical = result('technical', 'clarity', 10)
  const relevance = result('mixed', 'relevance', 0)
  let ledger = updateDifficulty(mixed, null)
  ledger = updateDifficulty(mixed, ledger)
  ledger = updateDifficulty(technical, ledger)
  ledger = updateDifficulty(relevance, ledger)
  expect(progressFor(mixed, ledger)).toMatchObject({ streak: 2, failCount: 0, averageScore: 90 })
  expect(progressFor(technical, ledger)).toMatchObject({ streak: 0, failCount: 1, averageScore: 10 })
  expect(progressFor(relevance, ledger)).toMatchObject({ streak: 0, failCount: 1, averageScore: 0 })
  ledger = updateDifficulty(mixed, ledger)
  expect(progressFor(mixed, ledger).level).toBe('Intermediate')
  expect(progressFor(technical, ledger).level).toBe('Beginner')
})
it('does not count unscored or discovery results toward adaptive progress', () => {
  const record = result('mixed', 'clarity', 90)
  const ledger = updateDifficulty(record, null)
  expect(updateDifficulty(result('mixed', '', null), ledger)).toBe(ledger)
  expect(updateDifficulty({ ...record, purpose: 'discovery' }, ledger)).toBe(ledger)
})
