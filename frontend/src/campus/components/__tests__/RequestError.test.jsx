import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import RequestError from '../RequestError'
import { CampusApiError } from '../../api'

afterEach(cleanup)
it('renders known field corrections while excluding raw inputs and unknown paths', () => {
  const error = new CampusApiError('请检查填写内容。', 400, { code: 'VALIDATION_FAILED', details: [
    { field: 'skillAssessments', code: 'custom', message: 'PRIVATE_INPUT', input: 'PRIVATE_INPUT' },
    { field: 'availability', code: 'custom' },
    { field: 'experiences.0.title', code: 'too_big' },
    { field: 'PRIVATE_FIELD', code: 'custom' },
    { field: 'title', code: 'PRIVATE_CODE' },
  ] })
  render(<RequestError error={error} />)
  expect(screen.getByText(/技能名称不能重复/)).toBeInTheDocument()
  expect(screen.getByText(/开始日期不能晚于结束日期/)).toBeInTheDocument()
  expect(screen.getByText(/经历 · 第 1 项 · 名称/)).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/PRIVATE_INPUT|PRIVATE_FIELD|PRIVATE_CODE/)
  expect(error.details).toHaveLength(3)
})
it('bounds validation detail projection before presentation', () => {
  const error = new CampusApiError('请检查填写内容。', 400, { code: 'VALIDATION_FAILED', details: Array.from({ length: 50 }, () => ({ field: 'title', code: 'too_big' })) })
  expect(error.details).toHaveLength(12)
})
