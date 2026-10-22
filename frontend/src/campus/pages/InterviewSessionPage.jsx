import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { campusFetch, logClientEvent } from '../api'
import VoiceInput from '../components/VoiceInput'
import RequestError from '../components/RequestError'
import { RoomReport } from '../components/InterviewFeedback'
import DiscoveryReport from '../components/DiscoveryReport'
import useQuestionSpeech from '../hooks/useQuestionSpeech'
import useUnsavedWork from '../hooks/useUnsavedWork'

function generationPending(item) {
  return item?.generation?.status === 'pending' && (!item.generation.leaseUntil || new Date(item.generation.leaseUntil).getTime() > Date.now())
}

export default function InterviewSessionPage() {
  const { id } = useParams()
  return <InterviewRoom key={id} id={id} />
}

function InterviewRoom({ id }) {
  const [item, setItem] = useState(null)
  const [error, setError] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [duration, setDuration] = useState(0)
  const [phase, setPhase] = useState('loading')
  const [voiceActive, setVoiceActive] = useState(false)
  const [note, setNote] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const lock = useRef(false)
  const mounted = useRef(true)
  const pendingAnswer = useRef(null)
  const captures = useRef(new Set())
  const speech = useQuestionSpeech()
  const answers = item?.answers || []
  const discovery = item?.purpose === 'discovery'
  const answerLimit = discovery ? 4000 : 20000
  const question = item?.questions?.find((row) => !answers.some((answer) => answer.questionId === row.questionId))
  const busy = phase !== 'ready'
  const last = !discovery && answers.length + 1 >= item?.totalQuestionCount

  async function canonical() {
    const data = (await campusFetch(`/api/interview/${id}`)).data
    if (!mounted.current) return null
    setItem(data)
    if (pendingAnswer.current && data.answers?.some((answer) => answer.questionId === pendingAnswer.current)) {
      pendingAnswer.current = null
      setTranscript(''); setDuration(0); captures.current.clear()
    }
    setUncertain(generationPending(data))
    if (generationPending(data)) setNote('服务器仍在处理，请稍后恢复服务器进度。')
    return data
  }
  async function load() {
    setPhase('loading'); setError(null)
    try { await canonical() } catch (err) { if (mounted.current) setError(err) } finally { if (mounted.current) setPhase('ready') }
  }
  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [id])
  useUnsavedWork(item?.status !== 'completed' && (Boolean(transcript) || voiceActive || uncertain))

  async function generate(kind, current) {
    if (!current || current.status === 'completed') return
    if (generationPending(current)) {
      setNote('服务器正在处理，请稍后恢复服务器进度。不会重复提交已保存的回答。')
      setUncertain(true)
      return
    }
    setPhase(kind === 'complete' ? 'summary' : 'next')
    try {
      await campusFetch(`/api/interview/${id}/${kind}`, { method: 'POST', body: JSON.stringify({}) })
      const saved = await canonical()
      if (generationPending(saved)) { setUncertain(true); setNote('服务器仍在处理，请恢复进度。') }
    } catch (err) {
      try {
        const saved = await canonical()
        const hasNext = saved?.questions?.some((row) => !saved.answers?.some((answer) => answer.questionId === row.questionId))
        if (saved?.status !== 'completed' && !(kind === 'continue' && hasNext)) {
          setError(err)
          if (generationPending(saved)) setUncertain(true)
          setNote('回答已经保存。请恢复进度或单独重试生成，不需要再次提交回答。')
        }
      } catch (readError) { setError(readError); setUncertain(true); setNote('生成结果尚不确定，请先恢复服务器进度。已保存的回答不会重新提交。') }
    }
  }
  async function recover() {
    if (lock.current) return
    lock.current = true; setPhase('reconciling'); setError(null)
    try {
      const data = await canonical()
      if (generationPending(data)) { setUncertain(true); setNote('服务器仍在处理，请稍后再次恢复进度。') }
      else setNote('已恢复服务器进度。未保存的文字仍保留。')
    } catch (err) { if (mounted.current) { setError(err); setUncertain(true) } } finally { lock.current = false; if (mounted.current) setPhase('ready') }
  }
  async function submit(event) {
    event.preventDefault()
    if (lock.current || voiceActive || speech.speaking || uncertain || !question || !transcript.trim() || transcript.length > answerLimit) return
    lock.current = true; setPhase('submitting'); setError(null); setNote('')
    const questionId = question.questionId
    pendingAnswer.current = questionId
    let saved
    try {
      saved = await canonical()
      if (!saved || !mounted.current) return
      if (!saved.answers?.some((answer) => answer.questionId === questionId)) {
        const form = new FormData()
        form.append('questionId', questionId); form.append('transcript', transcript.trim()); form.append('duration', String(duration)); form.append('isWarmup', 'false')
        try {
          await campusFetch(`/api/interview/${id}/answer`, { method: 'POST', body: form })
          saved = await canonical()
        } catch (err) {
          saved = await canonical()
          if (!saved?.answers?.some((answer) => answer.questionId === questionId)) { setError(err); return }
        }
      }
      if (!saved?.answers?.some((answer) => answer.questionId === questionId)) { setUncertain(true); return }
      logClientEvent('interview.answer.saved')
      if (last || (discovery && saved.answers.length >= saved.totalQuestionCount)) await generate('complete', saved)
      else if (discovery) await generate('continue', saved)
    } catch (err) {
      if (mounted.current) { setError(err); setUncertain(true); setNote('提交结果尚不确定。文字已保留，请先恢复服务器进度。') }
    } finally { lock.current = false; if (mounted.current) setPhase('ready') }
  }
  async function act(kind) {
    if (lock.current || voiceActive || speech.speaking || uncertain) return
    if (kind === 'complete' && transcript.trim() && !window.confirm('当前文字尚未保存，结束后不会计入本次内容。仍然结束吗？')) return
    lock.current = true; setError(null); setNote(''); setPhase('reconciling')
    try { await generate(kind, await canonical()) } catch (err) { if (mounted.current) { setError(err); setUncertain(true) } } finally { lock.current = false; if (mounted.current) setPhase('ready') }
  }
  if (item?.status === 'completed') return discovery ? <DiscoveryReport item={item} /> : <RoomReport item={item} />
  return <section className="campus-form campus-interview-review"><h1>{discovery ? '聊聊你感兴趣的事' : '这一次，慢慢说清楚'}</h1>
    {discovery && <p>这是了解兴趣和经历的交流，不打能力分。不想回答可以随时结束，设想也可以原样说。</p>}
    <div className="campus-progress"><span>已保存 {answers.length} / {item?.totalQuestionCount || '—'} {discovery ? '段' : '题'}</span></div>
    <RequestError error={error} onRetry={!item ? load : undefined} />
    {note && <p className="campus-note" role="status">{note}</p>}
    {busy && <p role="status">{phase === 'loading' ? '正在读取进度…' : phase === 'summary' ? '正在生成总结…' : phase === 'next' ? '正在准备下一问…' : '正在确认保存进度…'}</p>}
    {uncertain && <button type="button" disabled={busy} onClick={recover}>恢复服务器进度</button>}
    {question && <>
      <article className="campus-question-card"><div className="campus-q-index">{answers.length + 1}</div><h2>{question.question}</h2></article>
      <div className="campus-actions">{speech.speaking ? <button type="button" onClick={speech.cancel}>停止播报</button> : <button type="button" disabled={busy || voiceActive} onClick={() => speech.speak(question.question)}>朗读这道题</button>}</div>
      {speech.notice && <p role="status">{speech.notice}</p>}
      <VoiceInput key={question.questionId} disabled={busy || speech.speaking || uncertain} onActiveChange={setVoiceActive} onTranscript={(text, seconds, captureId) => {
        const key = `${question.questionId}:${captureId}`
        if (captures.current.has(key)) return
        captures.current.add(key)
        setTranscript((current) => [current, text].filter(Boolean).join('\n'))
        setDuration((current) => current + seconds)
        setNote('转写已带入同一个回答区，请校对后保存。')
      }} />
      <form className="campus-form" onSubmit={submit}><label>检查并编辑本题回答<textarea disabled={busy || uncertain} value={transcript} maxLength={answerLimit} aria-describedby="answer-limit" onChange={(event) => setTranscript(event.target.value)} placeholder="可以直接打字，也可以录音转写。" /></label><p id="answer-limit">本次每段最多{answerLimit}字。</p>{transcript.length > answerLimit && <p role="alert">回答超过{answerLimit}字，请精简或分段整理后保存；现有文字完整保留，没有截断。</p>}<div className="campus-actions"><button className="primary" type="submit" disabled={busy || voiceActive || speech.speaking || uncertain || !transcript.trim() || transcript.length > answerLimit}>{last ? '保存并查看反馈' : discovery ? '保存并继续聊' : '保存并下一题'}</button></div></form>
    </>}
    {item && !question && !uncertain && <button className="primary" type="button" disabled={busy || voiceActive} onClick={() => act(discovery && answers.length < item.totalQuestionCount ? 'continue' : 'complete')}>{discovery && answers.length < item.totalQuestionCount ? '继续交流' : '查看反馈'}</button>}
    {item && (discovery || answers.length > 0) && (question || (discovery && answers.length < item.totalQuestionCount)) && <button type="button" disabled={busy || voiceActive || speech.speaking || uncertain} onClick={() => act('complete')}>{discovery ? '结束交流，查看总结' : '提前结束，查看反馈'}</button>}
    <details><summary>已保存的回答（{answers.length}）</summary>{answers.map((answer) => <article className="campus-turn" key={answer.questionId}><h3>{answer.question}</h3><p className="campus-preserve-text">{answer.transcript}</p></article>)}</details>
  </section>
}
