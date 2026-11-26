import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, MemoryRouter, Route, RouterProvider, Routes, useNavigate } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import InterviewSessionPage from '../InterviewSessionPage'
import { campusFetch } from '../../api'
import UnsavedWorkProvider from '../../components/UnsavedWorkProvider'

vi.mock('../../api', () => ({ campusFetch: vi.fn(), logClientEvent: vi.fn(), errorText: () => '请求失败', downloadDiagnostics: vi.fn() }))
vi.mock('../../components/VoiceInput', () => ({ default: ({ disabled, onActiveChange, onTranscript }) => <>
  <button type="button" disabled={disabled} onClick={() => onActiveChange(true)}>开始受控录音</button>
  <button type="button" onClick={() => { onTranscript('语音补充', 1, 1); onActiveChange(false) }}>受控转写</button>
  <button type="button" onClick={() => onTranscript('语'.repeat(4001), 1, 2)}>超长受控转写</button>
</> }))
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

function room() { return render(<MemoryRouter initialEntries={['/interview/session/session']}><Routes><Route path="/interview/session/:id" element={<><Link to="/interview">退出练习</Link><InterviewSessionPage /></>} /></Routes></MemoryRouter>) }
const initial = { _id: 'session', questions: [{ questionId: 'q1', question: '真实问题' }], answers: [], totalQuestionCount: 1, status: 'in_progress' }

it('appends ASR once into the only editor without submitting', async () => {
  campusFetch.mockResolvedValue({ data: initial })
  room()
  const editor = await screen.findByLabelText('检查并编辑本题回答')
  fireEvent.change(editor, { target: { value: '原来的回答' } })
  const save = screen.getByRole('button', { name: '保存并查看反馈' })
  expect(save).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: '开始受控录音' }))
  expect(save).toBeDisabled()
  fireEvent.submit(editor.closest('form'))
  fireEvent.click(screen.getByRole('button', { name: '受控转写' }))
  fireEvent.click(screen.getByRole('button', { name: '受控转写' }))
  expect(screen.getAllByRole('textbox')).toHaveLength(1)
  expect(editor).toHaveValue('原来的回答\n语音补充')
  screen.getByRole('button', { name: '超长受控转写' }).focus()
  await userEvent.tab()
  expect(editor).toHaveFocus()
  expect(save).toBeEnabled()
  expect(campusFetch.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true)
})

it.each([false, true])('advances after confirmation and respects outside focus (moved: %s)', async (moveFocus) => {
  let acknowledge
  let saved = { ...initial, questions: [...initial.questions, { questionId: 'q2', question: '下一道问题' }], totalQuestionCount: 2 }
  campusFetch.mockImplementation(async (path, options) => {
    if (path.endsWith('/answer')) {
      await new Promise((resolve) => { acknowledge = resolve })
      saved = { ...saved, answers: [{ ...initial.questions[0], transcript: options.body.get('transcript') }] }
    }
    return { data: saved }
  })
  room()
  fireEvent.change(await screen.findByLabelText('检查并编辑本题回答'), { target: { value: '第一题已确认的回答' } })
  const save = screen.getByRole('button', { name: '保存并下一题' })
  save.focus()
  fireEvent.click(save)
  await waitFor(() => expect(acknowledge).toBeTypeOf('function'))
  const exit = screen.getByRole('link', { name: '退出练习' })
  if (moveFocus) exit.focus()
  await act(async () => { acknowledge() })
  const nextQuestion = await screen.findByRole('heading', { name: '下一道问题' })
  expect(moveFocus ? exit : nextQuestion).toHaveFocus()
  expect(screen.getByLabelText('检查并编辑本题回答')).toHaveValue('')
  expect(screen.getByRole('button', { name: '保存并查看反馈' })).toBeDisabled()
  expect(screen.getByText('第一题已确认的回答')).not.toBeVisible()
  // jsdom does not implement the native summary activation.
  screen.getByText('已保存的回答（1）').parentElement.open = true
  expect(screen.getByText('第一题已确认的回答')).toBeVisible()
})

it('retains the draft on canceled exit and allows explicit departure', async () => {
  campusFetch.mockResolvedValue({ data: initial })
  const router = createMemoryRouter([{ path: '*', element: <UnsavedWorkProvider>
    <Routes>
      <Route path="/interview/session/:id" element={<><Link to="/interview">退出练习</Link><InterviewSessionPage /></>} />
      <Route path="/interview" element={<h1>准备面试</h1>} />
    </Routes>
  </UnsavedWorkProvider> }], { initialEntries: ['/interview/session/session'] })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const view = render(<RouterProvider router={router} />)
  try {
    const editor = await screen.findByLabelText('检查并编辑本题回答')
    fireEvent.change(editor, { target: { value: '尚未确认的回答' } })
    fireEvent.click(screen.getByRole('link', { name: '退出练习' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(editor).toHaveValue('尚未确认的回答')

    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('link', { name: '退出练习' }))
    expect(await screen.findByRole('heading', { name: '准备面试' })).toBeInTheDocument()
    expect(campusFetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  } finally {
    view.unmount()
    router.dispose()
    confirm.mockRestore()
  }
})

it('reconciles lost final-answer and completion responses without duplicate submissions', async () => {
  let saved = initial
  campusFetch.mockImplementation(async (path, options) => {
    if (path.endsWith('/answer')) { saved = { ...saved, answers: [{ questionId: 'q1', question: '真实问题', transcript: '我的回答' }] }; throw new Error('lost answer response') }
    if (path.endsWith('/complete')) { saved = { ...saved, status: 'completed', overallScore: 0, overallFeedback: { summary: '已完成反馈' } }; throw new Error('lost completion response') }
    if (!options) return { data: saved }
    throw new Error(path)
  })
  room()
  fireEvent.change(await screen.findByLabelText('检查并编辑本题回答'), { target: { value: '我的回答' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并查看反馈' }))
  await screen.findByText('已完成反馈')
  expect(campusFetch.mock.calls.filter(([path]) => path.endsWith('/answer'))).toHaveLength(1)
  expect(campusFetch.mock.calls.filter(([path]) => path.endsWith('/complete'))).toHaveLength(1)
})

it('keeps text and requires canonical recovery when answer outcome is unknown', async () => {
  let unavailable = false
  campusFetch.mockImplementation(async (path) => {
    if (path.endsWith('/answer')) { unavailable = true; throw new Error('network') }
    if (unavailable) throw new Error('read unavailable')
    return { data: initial }
  })
  room()
  const editor = await screen.findByLabelText('检查并编辑本题回答')
  fireEvent.change(editor, { target: { value: '不能丢失的文字' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并查看反馈' }))
  const recover = await screen.findByRole('button', { name: '恢复服务器进度' })
  expect(editor).toHaveValue('不能丢失的文字')
  const save = screen.getByRole('button', { name: '保存并查看反馈' })
  expect(save).toBeDisabled()
  unavailable = false
  fireEvent.click(recover)
  await waitFor(() => expect(save).toBeEnabled())
  expect(editor).toHaveValue('不能丢失的文字')
  expect(campusFetch.mock.calls.filter(([path]) => path.endsWith('/answer'))).toHaveLength(1)
})

it('does not repost an accepted discovery answer when next generation fails', async () => {
  let saved = { ...initial, purpose: 'discovery', totalQuestionCount: 3 }
  campusFetch.mockImplementation(async (path) => {
    if (path.endsWith('/answer')) { saved = { ...saved, answers: [{ questionId: 'q1', transcript: '只是一个设想' }] }; return { data: saved } }
    if (path.endsWith('/continue')) throw new Error('provider unavailable')
    return { data: saved }
  })
  room()
  fireEvent.change(await screen.findByLabelText('检查并编辑本题回答'), { target: { value: '只是一个设想' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并继续聊' }))
  const retry = await screen.findByRole('button', { name: '继续交流' })
  await waitFor(() => expect(retry).not.toBeDisabled())
  fireEvent.click(retry)
  await waitFor(() => expect(campusFetch.mock.calls.filter(([path]) => path.endsWith('/continue'))).toHaveLength(2))
  expect(campusFetch.mock.calls.filter(([path]) => path.endsWith('/answer'))).toHaveLength(1)
})

it.each([['discovery', 4000, true], ['interview', 20000, false]])('preserves overlong ASR and applies the %s answer limit', async (purpose, limit, blocked) => {
  campusFetch.mockResolvedValue({ data: { ...initial, purpose, totalQuestionCount: 3 } })
  room()
  const editor = await screen.findByLabelText('检查并编辑本题回答')
  expect(editor).toHaveAttribute('maxlength', String(limit))
  fireEvent.click(screen.getByRole('button', { name: '超长受控转写' }))
  expect(editor).toHaveValue('语'.repeat(4001))
  const save = screen.getByRole('button', { name: purpose === 'discovery' ? '保存并继续聊' : '保存并下一题' })
  if (blocked) {
    expect(save).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('请精简或分段整理后保存')
    fireEvent.submit(editor.closest('form'))
    expect(campusFetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
    fireEvent.change(editor, { target: { value: '已经精简的回答' } })
    expect(save).not.toBeDisabled()
  } else expect(save).not.toBeDisabled()
})
