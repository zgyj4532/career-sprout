import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { campusFetch, logClientEvent } from '../api'
import VoiceInput from '../components/VoiceInput'
import RequestError from '../components/RequestError'
import { RoomReport } from '../components/InterviewFeedback'
import useQuestionSpeech from '../hooks/useQuestionSpeech'

export default function InterviewSessionPage() {
  const { id } = useParams()
  return <InterviewRoom key={id} id={id} />
}

function InterviewRoom({ id }) {
  const [item, setItem] = useState(null)
  const [error, setError] = useState(null)
  const [summaryError, setSummaryError] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [duration, setDuration] = useState(0)
  const [phase, setPhase] = useState('loading')
  const [voiceActive, setVoiceActive] = useState(false)
  const [note, setNote] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const lock = useRef(false)
  const mounted = useRef(true)
  const speech = useQuestionSpeech()
  const answers = item?.answers || []
  const question = item?.questions?.find((row) => !answers.some((answer) => answer.questionId === row.questionId))
  const busy = phase === 'submitting' || phase === 'summary' || phase === 'loading' || phase === 'reconciling'
  async function load() {
    setError(null)
    try { const result = await campusFetch(`/api/interview/${id}`); if (mounted.current) { setItem(result.data); setPhase('ready'); return result.data } } catch (err) { if (mounted.current) { setError(err); setPhase('ready') } }
  }
  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [id])
  async function reconcile(questionId) {
    setPhase('reconciling')
    const data = (await campusFetch(`/api/interview/${id}`)).data
    if (!mounted.current) return false
    setItem(data)
    const accepted = data.answers?.some((answer) => answer.questionId === questionId)
    setUncertain(false)
    if (accepted) { setTranscript(''); setDuration(0); setNote('') }
    return accepted
  }
  async function retryReconcile() {
    if (lock.current || !question) return
    lock.current = true; setError(null)
    try { await reconcile(question.questionId) } catch (err) { if (mounted.current) setError(err) } finally { lock.current = false; if (mounted.current) setPhase('ready') }
  }
  async function submit(event) {
    event.preventDefault()
    if (lock.current || voiceActive || speech.speaking || uncertain || !question || !transcript.trim()) return
    lock.current = true; setPhase('submitting'); setError(null); setNote('')
    const questionId = question.questionId
    try {
      // Read canonical progress before a retry too; do not send an already accepted answer.
      if (await reconcile(questionId)) return
      if (!mounted.current) return
      setPhase('submitting')
      const form = new FormData()
      form.append('questionId', questionId); form.append('transcript', transcript.trim()); form.append('duration', String(duration)); form.append('isWarmup', 'false')
      await campusFetch(`/api/interview/${id}/answer`, { method: 'POST', body: form })
      await reconcile(questionId)
      logClientEvent('interview.answer.saved')
    } catch (err) {
      if (!mounted.current) return
      try {
        const accepted = await reconcile(questionId)
        if (!accepted) setError(err)
      } catch (reconcileError) { setError(reconcileError); setUncertain(true); setNote('提交结果尚不确定。文字已保留，请先恢复服务器进度，再决定是否重试。') }
    } finally { lock.current = false; if (mounted.current) setPhase('ready') }
  }
  async function finish() {
    if (lock.current || voiceActive || speech.speaking || uncertain || !answers.length) return
    if (transcript.trim() && !window.confirm('当前文字还没有提交。结束练习不会把它计入回答，是否继续？')) return
    lock.current = true; setPhase('summary'); setSummaryError(null)
    try {
      const result = await campusFetch(`/api/interview/${id}/complete`, { method: 'POST' })
      if (!mounted.current) return
      const saved = (await campusFetch(`/api/interview/${id}`)).data
      if (!mounted.current) return
      setItem({ ...saved, overallScore: result.data.overallScore, overallFeedback: result.data.overallFeedback })
    } catch (err) { if (mounted.current) setSummaryError(err) } finally { lock.current = false; if (mounted.current) setPhase('ready') }
  }
  if (item?.status === 'completed') return <RoomReport item={item} />
  return <section className="campus-form campus-interview-review"><h1>这一次，慢慢说清楚</h1>
    <div className="campus-progress"><span>已保存 {answers.length} / {item?.totalQuestionCount || '—'} 题</span></div>
    <RequestError error={error} onRetry={uncertain ? retryReconcile : !item ? load : undefined} />
    {note && <p className="campus-note" role="status">{note}</p>}
    {busy && <p role="status">{phase === 'loading' ? '正在读取面试…' : phase === 'summary' ? '正在生成总评…' : '正在保存回答…'}</p>}
    {question && <>
      <article className="campus-question-card"><div className="campus-q-index">{answers.length + 1}</div><h2>{question.question}</h2></article>
      <div className="campus-actions">{speech.speaking ? <button type="button" onClick={speech.cancel}>停止播报</button> : <button type="button" disabled={busy || voiceActive} onClick={() => speech.speak(question.question)}>朗读这道题</button>}</div>
      {speech.notice && <p role="status">{speech.notice}</p>}
      <VoiceInput key={question.questionId} disabled={busy || speech.speaking || uncertain} onActiveChange={setVoiceActive} onReview={(text, seconds) => { setTranscript((current) => [current, text].filter(Boolean).join('\n')); setDuration(seconds); setNote('文字已带入，请确认并提交回答。') }} />
      <form className="campus-form" onSubmit={submit}><label>检查并编辑本题回答<textarea disabled={busy || voiceActive || uncertain} value={transcript} maxLength={20000} onChange={(event) => setTranscript(event.target.value)} placeholder="可以直接打字，也可以使用上方转写。" /></label><div className="campus-actions"><button className="primary" type="submit" disabled={busy || voiceActive || speech.speaking || uncertain || !transcript.trim()}>确认并提交回答</button><button type="button" disabled={busy || voiceActive || uncertain} onClick={() => { setTranscript(''); setDuration(0) }}>清空未提交文字</button></div></form>
    </>}
    {item && !question && <p>题目已答完，点击下方按钮查看总评。</p>}
    <RequestError error={summaryError} onRetry={finish} />
    {!!answers.length && <button type="button" disabled={busy || voiceActive || speech.speaking || uncertain} onClick={finish}>{summaryError ? '重新生成总评' : question ? '提前结束，生成总评' : '生成本次总评'}</button>}
    <details><summary>已保存的回答（{answers.length}）</summary>{answers.map((answer) => <article className="campus-turn" key={answer.questionId}><h3>{answer.question}</h3><p className="campus-preserve-text">{answer.transcript}</p></article>)}</details>
  </section>
}
