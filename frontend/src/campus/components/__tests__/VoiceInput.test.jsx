import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VoiceInput from '../VoiceInput'
import VoiceReview from '../VoiceReview'
import { campusFetch } from '../../api'

vi.mock('../../hooks/useAudioCapture', () => {
  const capture = { blob: new Blob(['audio']), extension: 'webm', duration: 1 }
  return { default: () => ({ state: 'captured', active: false, capture, error: '', start: vi.fn(), stop: vi.fn(), cancel: vi.fn() }) }
})
vi.mock('../../api', () => ({ campusFetch: vi.fn(), logClientEvent: vi.fn(), errorText: () => '请求未完成', downloadDiagnostics: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('transcript review', () => {
  it('keeps the editor after clearing text and never adopts without explicit confirmation', async () => {
    campusFetch.mockResolvedValue({ data: { text: '合成测试回答' } })
    const onReview = vi.fn()
    render(<VoiceReview onReview={onReview} />)
    const input = await screen.findByLabelText('转写校对')
    expect(onReview).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByLabelText('转写校对')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '使用校对后的文字' })).toBeDisabled()
    fireEvent.change(input, { target: { value: '已校对' } })
    fireEvent.click(screen.getByRole('button', { name: '使用校对后的文字' }))
    await waitFor(() => expect(onReview).toHaveBeenCalledWith('已校对', 1))
  })
  it('delivers each capture once without creating another editor', async () => {
    campusFetch.mockResolvedValue({ data: { text: '追加的文字' } })
    const onTranscript = vi.fn()
    render(<VoiceInput onTranscript={onTranscript} />)
    await waitFor(() => expect(onTranscript).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(onTranscript).toHaveBeenCalledWith('追加的文字', 1, expect.any(Number))
  })
  it('ignores a transcription arriving after cancellation', async () => {
    let resolve
    campusFetch.mockImplementation(() => new Promise((done) => { resolve = done }))
    const onTranscript = vi.fn()
    render(<VoiceInput onTranscript={onTranscript} />)
    await waitFor(() => expect(campusFetch).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: '取消这段录音' }))
    resolve({ data: { text: '迟到的转写' } })
    await waitFor(() => expect(screen.queryByText('正在转写…')).not.toBeInTheDocument())
    expect(onTranscript).not.toHaveBeenCalled()
  })
  it('blocks failed-capture retry while the parent is saving and restores retry afterward', async () => {
    campusFetch.mockRejectedValueOnce(new Error('transcription unavailable')).mockResolvedValueOnce({ data: { text: '恢复的转写' } })
    const onTranscript = vi.fn()
    const view = render(<VoiceInput onTranscript={onTranscript} />)
    await screen.findByRole('button', { name: '重试' })
    view.rerender(<VoiceInput disabled onTranscript={onTranscript} />)
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
    expect(campusFetch).toHaveBeenCalledTimes(1)
    expect(onTranscript).not.toHaveBeenCalled()
    view.rerender(<VoiceInput onTranscript={onTranscript} />)
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('恢复的转写', 1, expect.any(Number)))
    expect(campusFetch).toHaveBeenCalledTimes(2)
  })
})
