import { act, renderHook, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useAudioCapture from '../useAudioCapture'

let recorder
class Recorder {
  static isTypeSupported(type) { return type === 'audio/mp4' }
  constructor() { this.state = 'inactive'; this.mimeType = 'audio/mp4'; recorder = this }
  start() { this.state = 'recording' }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) }); this.onstop?.() }
}
const stream = () => { const track = { stop: vi.fn(), onended: null }; return { track, getTracks: () => [track], getAudioTracks: () => [track] } }
beforeEach(() => { vi.stubGlobal('MediaRecorder', Recorder) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('useAudioCapture ownership', () => {
  it('reports recording only after the real start event and releases on stop', async () => {
    const media = stream()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(media) } })
    const { result } = renderHook(() => useAudioCapture())
    await act(() => result.current.start())
    expect(result.current.state).toBe('starting')
    act(() => recorder.onstart())
    expect(result.current.state).toBe('recording')
    act(() => result.current.stop())
    expect(result.current.state).toBe('captured')
    expect(result.current.capture.extension).toBe('m4a')
    expect(media.track.stop).toHaveBeenCalled()
  })
  it('releases permission results arriving after cancellation', async () => {
    const media = stream()
    let resolve
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(() => new Promise((done) => { resolve = done })) } })
    const { result } = renderHook(() => useAudioCapture())
    let pending
    act(() => { pending = result.current.start() })
    act(() => result.current.cancel())
    await act(async () => { resolve(media); await pending })
    expect(media.track.stop).toHaveBeenCalled()
    expect(result.current.state).toBe('cancelled')
    expect(result.current.capture).toBeNull()
  })
  it('releases permission results after unmount and ignores double starts', async () => {
    const media = stream()
    let resolve
    const getUserMedia = vi.fn(() => new Promise((done) => { resolve = done }))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    const { result, unmount } = renderHook(() => useAudioCapture())
    let pending
    act(() => { pending = result.current.start(); result.current.start() })
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    unmount()
    await act(async () => { resolve(media); await pending })
    expect(media.track.stop).toHaveBeenCalled()
  })
  it('rejects an oversized final recording rather than uploading it', async () => {
    const media = stream()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(media) } })
    const { result } = renderHook(() => useAudioCapture())
    await act(() => result.current.start())
    act(() => recorder.onstart())
    act(() => recorder.ondataavailable({ data: new Blob([new Uint8Array(10 * 1024 * 1024)]) }))
    expect(result.current.state).toBe('error')
    expect(result.current.capture).toBeNull()
    expect(media.track.stop).toHaveBeenCalled()
  })
})
