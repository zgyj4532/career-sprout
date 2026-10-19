import { useEffect, useRef, useState } from 'react'
import useAudioCapture from '../hooks/useAudioCapture'
import { campusFetch, logClientEvent } from '../api'
import RequestError from './RequestError'

export default function VoiceInput({ onReview, disabled = false, onActiveChange }) {
  const audio = useAudioCapture()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [review, setReview] = useState(null)
  const request = useRef(null)
  const generation = useRef(0)
  useEffect(() => { onActiveChange?.(audio.active || busy); return () => onActiveChange?.(false) }, [audio.active, busy, onActiveChange])
  useEffect(() => () => { generation.current += 1; request.current?.abort() }, [])
  useEffect(() => { if (audio.capture) transcribe() }, [audio.capture])
  async function transcribe() {
    if (!audio.capture || busy) return
    const version = ++generation.current
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.append('audio', audio.capture.blob, `recording.${audio.capture.extension}`)
    form.append('language', 'zh')
    try {
      const result = await campusFetch('/api/interview/transcribe', { method: 'POST', body: form, signal: controller.signal })
      if (version !== generation.current) return
      setReview(result.data?.text || '')
      logClientEvent('asr.completed')
    } catch (err) { if (version === generation.current) setError(err) } finally { if (version === generation.current) setBusy(false) }
  }
  function cancel() {
    generation.current += 1
    request.current?.abort()
    audio.cancel()
    setBusy(false)
    setReview(null)
    setError(null)
  }
  return <div className="campus-voice campus-form">
    <p>每段最多3分钟，结束后自动转写，请校对文字后使用。</p>
    {audio.error && <p className="campus-error" role="alert">{audio.error}</p>}
    <RequestError error={error} onRetry={transcribe} />
    {audio.state === 'recording' && <div className="campus-recording-banner" role="status"><strong>录音已开始，请说话</strong><span className="campus-timer">{Math.floor(audio.seconds / 60)}:{String(audio.seconds % 60).padStart(2, '0')}</span><button type="button" onClick={audio.stop}>结束录音，检查文字</button></div>}
    <p role="status">{audio.state === 'requesting_permission' ? '等待麦克风授权…' : audio.state === 'starting' ? '正在准备录音…' : audio.state === 'stopping' ? '正在结束录音…' : busy ? '正在转写…' : ''}</p>
    <div className="campus-actions">
      <button type="button" onClick={() => { setReview(null); audio.start() }} disabled={disabled || audio.active || busy}>{audio.capture ? '重新录音' : '开始录音'}</button>
      {audio.capture && <button type="button" onClick={transcribe} disabled={disabled || busy}>转写这段录音</button>}
      {(audio.active || audio.capture || busy) && <button type="button" onClick={cancel}>取消这段录音</button>}
    </div>
    {review !== null && <div className="campus-form"><label>转写校对<textarea value={review} onChange={(event) => setReview(event.target.value)} /></label><button type="button" disabled={disabled || !review.trim()} onClick={() => { onReview(review, audio.capture?.duration || 0); cancel() }}>使用校对后的文字</button></div>}
  </div>
}
