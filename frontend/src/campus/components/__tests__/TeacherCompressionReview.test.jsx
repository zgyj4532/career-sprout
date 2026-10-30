import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import TeacherCompressionReview from '../TeacherCompressionReview'
import { campusFetch, downloadBlob } from '../../api'

vi.mock('../../api', () => ({ campusFetch: vi.fn(), downloadBlob: vi.fn(), downloadDiagnostics: vi.fn(), errorText: (error) => error.message }))
vi.mock('../../hooks/useUnsavedWork', () => ({ default: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('preserves the source, submits only selected source paragraphs and retains edits on failure', async () => {
  const review = { targetId: 'target', revision: 3, original: '姓名\n\n课程经历\n\n项目经历', draft: '姓名\n\n课程经历', changes: ['省略项目经历'] }
  const changed = vi.fn()
  campusFetch.mockRejectedValueOnce(new Error('授权已变化'))
  render(<TeacherCompressionReview jobId="job" review={review} onDirtyChange={changed} />)
  expect(screen.getByText((_text, element) => element.tagName === 'PRE' && element.textContent === review.original)).toBeInTheDocument()
  fireEvent.click(screen.getByLabelText('课程经历'))
  fireEvent.click(screen.getByLabelText('项目经历'))
  fireEvent.click(screen.getByRole('button', { name: '按调整重新生成 PDF' }))
  await screen.findByText('授权已变化')
  expect(screen.getByLabelText('项目经历')).toBeChecked()
  expect(campusFetch).toHaveBeenCalledWith('/api/campus/teacher/jobs/job/targets/target/review-export', expect.objectContaining({ body: JSON.stringify({ revision: 3, selected: [0, 2] }) }))
  expect(downloadBlob).not.toHaveBeenCalled()
  expect(changed).toHaveBeenLastCalledWith('target', true)
  campusFetch.mockResolvedValueOnce(new Blob(['pdf']))
  fireEvent.click(screen.getByRole('button', { name: '按调整重新生成 PDF' }))
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce())
})
