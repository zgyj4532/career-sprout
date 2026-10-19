import { useCallback, useEffect, useRef, useState } from 'react'
import { logClientEvent } from '../api'

export function audioExtension(type) {
  if (/mp4|m4a/.test(type)) return 'm4a'
  if (/ogg/.test(type)) return 'ogg'
  if (/wav/.test(type)) return 'wav'
  return 'webm'
}
const activeStates = ['requesting_permission', 'starting', 'recording', 'stopping']

export default function useAudioCapture({ maxSeconds = 180 } = {}) {
  const [state, setState] = useState('idle')
  const [seconds, setSeconds] = useState(0)
  const [capture, setCapture] = useState(null)
  const [error, setError] = useState('')
  const owner = useRef({ generation: 0, state: 'idle', stream: null, recorder: null, timer: null, mounted: true })
  const transition = useCallback((next) => {
    owner.current.state = next
    if (owner.current.mounted) setState(next)
    logClientEvent('audio.state', { state: next })
  }, [])
  const release = useCallback(() => {
    const current = owner.current
    clearInterval(current.timer)
    current.timer = null
    if (current.recorder) {
      current.recorder.onstart = null
      current.recorder.onstop = null
      current.recorder.ondataavailable = null
      current.recorder.onerror = null
      if (current.recorder.state !== 'inactive') { try { current.recorder.stop() } catch { /* Device may already be disconnected. */ } }
    }
    current.recorder = null
    current.stream?.getTracks().forEach((track) => { track.onended = null; track.stop() })
    current.stream = null
  }, [])
  const cancel = useCallback(() => {
    owner.current.generation += 1
    release()
    if (owner.current.mounted) { setCapture(null); setError('') }
    transition('cancelled')
  }, [release, transition])
  const stop = useCallback(() => {
    const current = owner.current
    if (current.state !== 'recording') return
    transition('stopping')
    clearInterval(current.timer)
    try { current.recorder.stop() } catch { release(); setError('录音设备已停止，请重新录音。'); transition('error') }
  }, [release, transition])
  const start = useCallback(async () => {
    const current = owner.current
    if (activeStates.includes(current.state)) return
    const generation = ++current.generation
    release()
    setCapture(null)
    setError('')
    setSeconds(0)
    transition('requesting_permission')
    let stream
    try {
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) throw new Error('UNSUPPORTED')
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      if (!current.mounted || generation !== current.generation) { stream.getTracks().forEach((track) => track.stop()); return }
      current.stream = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      current.recorder = recorder
      const chunks = []
      let bytes = 0
      let started = 0
      recorder.ondataavailable = ({ data }) => {
        if (generation !== current.generation || !data.size) return
        chunks.push(data)
        bytes += data.size
        if (bytes >= 8 * 1024 * 1024 && current.state === 'recording') stop()
      }
      recorder.onstart = () => {
        if (generation !== current.generation) return
        started = performance.now()
        transition('recording')
        logClientEvent('audio.recording.started')
        current.timer = setInterval(() => {
          const elapsed = Math.floor((performance.now() - started) / 1000)
          setSeconds(elapsed)
          if (elapsed >= maxSeconds) stop()
        }, 250)
      }
      recorder.onstop = () => {
        if (generation !== current.generation || !current.mounted) return
        const duration = started ? Math.min(maxSeconds, (performance.now() - started) / 1000) : 0
        const type = recorder.mimeType || chunks[0]?.type || 'audio/webm'
        const blob = new Blob(chunks, { type })
        release()
        if (blob.size >= 10 * 1024 * 1024) { setError('这段录音超过上传上限，请缩短后重录或改用文字。'); transition('error'); return }
        if (!blob.size) { setError('没有录到声音，请重新录音或改用文字。'); transition('error'); return }
        setCapture({ blob, duration, extension: audioExtension(type) })
        logClientEvent('audio.recording.stopped', { bytes: blob.size, durationMs: duration * 1000 })
        transition('captured')
      }
      recorder.onerror = () => {
        current.generation += 1
        release()
        setError('录音中断，请检查麦克风，再重新录音或使用文字。')
        transition('error')
      }
      stream.getAudioTracks().forEach((track) => { track.onended = () => { if (current.state === 'recording') stop() } })
      transition('starting')
      recorder.start(250)
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop())
      if (!current.mounted || generation !== current.generation) return
      release()
      setError(cause.name === 'NotAllowedError' ? '麦克风权限被拒绝。可在浏览器设置中允许，或改用文字。' : cause.name === 'NotFoundError' ? '没有找到麦克风，请连接设备或改用文字。' : '浏览器或设备暂不支持录音，请使用 HTTPS / 本机地址，或改用文字。')
      transition('error')
    }
  }, [maxSeconds, release, stop, transition])
  useEffect(() => {
    const current = owner.current
    current.mounted = true
    return () => { current.mounted = false; current.generation += 1; release() }
  }, [release])
  return { state, seconds, capture, error, start, stop, cancel, active: activeStates.includes(state) }
}
