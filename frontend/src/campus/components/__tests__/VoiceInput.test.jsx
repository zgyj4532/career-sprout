import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VoiceInput from '../VoiceInput'
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
    render(<VoiceInput onReview={onReview} />)
    const input = await screen.findByLabelText('转写校对')
    expect(onReview).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByLabelText('转写校对')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '使用校对后的文字' })).toBeDisabled()
    fireEvent.change(input, { target: { value: '已校对' } })
    fireEvent.click(screen.getByRole('button', { name: '使用校对后的文字' }))
    await waitFor(() => expect(onReview).toHaveBeenCalledWith('已校对', 1))
  })
})
