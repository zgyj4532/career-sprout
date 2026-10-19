import { useCallback, useEffect, useRef, useState } from 'react'

export default function useQuestionSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const [notice, setNotice] = useState('')
  const [voices, setVoices] = useState([])
  const pending = useRef(null)
  const mounted = useRef(true)
  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel()
    pending.current?.()
    pending.current = null
    if (mounted.current) setSpeaking(false)
  }, [])
  useEffect(() => {
    mounted.current = true
    const synth = window.speechSynthesis
    const update = () => setVoices(synth?.getVoices() || [])
    update()
    synth?.addEventListener('voiceschanged', update)
    return () => { mounted.current = false; synth?.removeEventListener('voiceschanged', update); cancel() }
  }, [cancel])
  const speak = useCallback((text) => {
    cancel()
    setNotice('')
    const synth = window.speechSynthesis
    const voice = (synth?.getVoices() || voices).find((row) => /^zh/i.test(row.lang))
    if (!synth || !voice) { setNotice('当前没有可用的中文播报音色。请阅读题目，仍可录音或打字。'); return Promise.resolve() }
    setSpeaking(true)
    return new Promise((resolve) => {
      let settled = false
      const finish = () => { if (settled) return; settled = true; clearTimeout(timer); pending.current = null; if (mounted.current) setSpeaking(false); resolve() }
      const timer = setTimeout(() => { synth.cancel(); if (mounted.current) setNotice('播报已超时停止，请直接阅读题目。'); finish() }, 90000)
      pending.current = finish
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.voice = voice
      utterance.lang = voice.lang
      utterance.rate = 0.95
      utterance.onend = finish
      utterance.onerror = () => { if (mounted.current) setNotice('播报未完成，请阅读题目或重听。'); finish() }
      synth.speak(utterance)
    })
  }, [cancel, voices])
  return { speaking, notice, speak, cancel }
}
