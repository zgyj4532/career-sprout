import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import SectionPolish from '../SectionPolish'
import { campusData } from '../../api'
vi.mock('../../api', () => ({ campusData: vi.fn(), downloadDiagnostics: vi.fn(), errorText: () => '未完成' }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
it('never adopts an in-flight suggestion after its source changes', async () => {
  let complete
  campusData.mockReturnValue(new Promise((resolve) => { complete = resolve }))
  const adopt = vi.fn()
  const view = render(<SectionPolish source="参与课程项目" onAdopt={adopt} />)
  fireEvent.click(screen.getByRole('button', { name: '整理这段' }))
  view.rerender(<SectionPolish source="参与新的课程项目" onAdopt={adopt} />)
  await act(async () => complete({ draft: '旧建议', changes: [], questions: [] }))
  expect(screen.queryByText('旧建议')).not.toBeInTheDocument()
  expect(adopt).not.toHaveBeenCalled()
})
it('adopts into the input callback only after explicit confirmation', async () => {
  campusData.mockResolvedValue({ draft: '整理后的真实经历', changes: [], questions: [] })
  const adopt = vi.fn()
  render(<SectionPolish source="真实经历" onAdopt={adopt} />)
  fireEvent.click(screen.getByRole('button', { name: '整理这段' }))
  fireEvent.click(await screen.findByRole('button', { name: '确认事实，采纳到输入框' }))
  expect(adopt).toHaveBeenCalledWith('整理后的真实经历')
  expect(campusData).toHaveBeenCalledTimes(1)
})
