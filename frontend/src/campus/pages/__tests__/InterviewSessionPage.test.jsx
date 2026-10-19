import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import InterviewSessionPage from '../InterviewSessionPage'
import { campusFetch } from '../../api'

vi.mock('../../api', () => ({ campusFetch: vi.fn(), logClientEvent: vi.fn(), errorText: () => '请求失败', downloadDiagnostics: vi.fn() }))
vi.mock('../../components/VoiceInput', () => ({ default: () => <div>受控语音测试</div> }))
vi.mock('../../hooks/useQuestionSpeech', () => ({ default: () => ({ speaking: false, notice: '', speak: vi.fn(), cancel: vi.fn() }) }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
function SwitchSession() { const navigate = useNavigate(); return <button onClick={() => navigate('/interview/session/new')}>切换测试会话</button> }
it('ignores an old session response arriving after navigation', async () => {
  let resolveOld
  campusFetch.mockImplementation((path) => path.endsWith('/old') ? new Promise((resolve) => { resolveOld = resolve }) : Promise.resolve({ data: { questions: [{ questionId: 'new-question', question: '新会话题目' }], answers: [], totalQuestionCount: 2, status: 'in_progress' } }))
  render(<MemoryRouter initialEntries={['/interview/session/old']}><SwitchSession /><Routes><Route path="/interview/session/:id" element={<InterviewSessionPage />} /></Routes></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: '切换测试会话' }))
  await screen.findByRole('heading', { name: '新会话题目' })
  await act(async () => { resolveOld({ data: { questions: [{ questionId: 'old-question', question: '旧会话题目' }], answers: [] } }) })
  expect(screen.queryByText('旧会话题目')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '新会话题目' })).toBeInTheDocument()
})
