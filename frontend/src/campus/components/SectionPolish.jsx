import { useEffect, useRef, useState } from 'react'
import { campusData } from '../api'
import RequestError from './RequestError'

export default function SectionPolish({ source, onAdopt, disabled, maxLength = 20000 }) {
  const [suggestion, setSuggestion] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const current = useRef(source)
  const pending = useRef(null)
  useEffect(() => { current.current = source; setSuggestion(null); pending.current?.abort(); setBusy(false) }, [source])
  useEffect(() => () => pending.current?.abort(), [])
  async function polish() {
    const original = source
    const controller = new AbortController()
    pending.current = controller
    setBusy(true); setError(null); setSuggestion(null)
    try {
      const result = await campusData('/resumes/polish', { method: 'POST', signal: controller.signal, body: JSON.stringify({ sourceText: original }) })
      if (!controller.signal.aborted && current.current === original) setSuggestion({ ...result, source: original })
    } catch (err) { if (!controller.signal.aborted) setError(err) }
    finally { if (pending.current === controller) setBusy(false) }
  }
  return <div className="section-polish">
    <button type="button" disabled={disabled || busy || !source?.trim() || source.length > 20000} onClick={polish}>{busy ? '正在整理这段…' : '整理这段'}</button>
    {busy && <button type="button" onClick={() => { pending.current?.abort(); setBusy(false) }}>取消整理</button>}
    <RequestError error={error} />
    {suggestion && suggestion.source === source && <section className="campus-panel"><h3>这段的建议（尚未保存）</h3><p className="campus-preserve-text">{suggestion.draft}</p>
      <ul>{suggestion.changes.map((item) => <li key={item}>{item}</li>)}</ul><ul>{suggestion.questions.map((item) => <li key={item}>{item}</li>)}</ul>
      {suggestion.draft.length > maxLength && <p role="status">建议超过此处的长度限制，请保留原文或手动精简。</p>}
      <button type="button" disabled={disabled || suggestion.draft.length > maxLength} onClick={() => { if (current.current !== suggestion.source) return; onAdopt(suggestion.draft); setSuggestion(null) }}>确认事实，采纳到输入框</button>
      <button type="button" onClick={() => setSuggestion(null)}>保留原文</button>
    </section>}
  </div>
}
