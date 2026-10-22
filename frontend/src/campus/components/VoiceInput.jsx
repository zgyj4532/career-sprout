import { useEffect, useRef, useState } from 'react'
import useAudioCapture from '../hooks/useAudioCapture'
import { campusFetch, logClientEvent } from '../api'
import RequestError from './RequestError'

export default function VoiceInput({ onTranscript, disabled = false, onActiveChange }) {
  const audio = useAudioCapture()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [delivered, setDelivered] = useState(false)
  const request = useRef(null)
  const generation = useRef(0)
  const callback = useRef(onTranscript)
  callback.current = onTranscript
  useEffect(() => { onActiveChange?.(audio.active || busy); return () => onActiveChange?.(false) }, [audio.active, busy, onActiveChange])
  useEffect(() => () => { generation.current += 1; request.current?.abort() }, [])
  useEffect(() => { if (audio.capture) transcribe(audio.capture) }, [audio.capture])
  async function transcribe(capture = audio.capture) {
    if (disabled || !capture || request.current || delivered) return
    const version = ++generation.current
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setError(null)
    const form = new FormData()
    form.append('audio', capture.blob, `recording.${capture.extension}`)
    form.append('language', 'zh')
    try {
      const result = await campusFetch('/api/interview/transcribe', { method: 'POST', body: form, signal: controller.signal })
      if (version !== generation.current) return
      const text = result.data?.text
      if (typeof text !== 'string' || !text.trim()) { setError({ code: 'ASR_EMPTY' }); return }
      callback.current(text, capture.duration || 0, version)
      setDelivered(true)
      logClientEvent('asr.completed')
    } catch (err) { if (version === generation.current) setError(err) } finally {
      if (request.current === controller) { request.current = null; setBusy(false) }
    }
  }
  function cancel() {
    generation.current += 1
    request.current?.abort()
    audio.cancel()
    setDelivered(false); setError(null)
  }
  return <div className="campus-voice campus-form">
    <p>每段最多3分钟。转写只带入文字，请校对后再保存；也可以直接打字。</p>
    {audio.error && <p className="campus-error" role="alert">{audio.error}</p>}
    <RequestError error={error} onRetry={disabled || busy ? undefined : () => transcribe()} />
    {audio.state === 'recording' && <div className="campus-recording-banner" role="status"><strong>录音已开始，请说话</strong><span className="campus-timer">{Math.floor(audio.seconds / 60)}:{String(audio.seconds % 60).padStart(2, '0')}</span><button type="button" onClick={audio.stop}>结束录音，检查文字</button></div>}
    <p role="status">{audio.state === 'requesting_permission' ? '等待麦克风授权…' : audio.state === 'starting' ? '正在准备录音…' : audio.state === 'stopping' ? '正在结束录音…' : busy ? '正在转写…' : delivered ? '转写已带入编辑区，尚未保存。' : ''}</p>
    <div className="campus-actions">
      <button type="button" onClick={() => { setDelivered(false); setError(null); audio.start() }} disabled={disabled || audio.active || busy}>{audio.capture ? '再录一段' : '开始录音'}</button>
      {(audio.active || audio.capture || busy) && <button type="button" onClick={cancel}>取消这段录音</button>}
    </div>
  </div>
}
