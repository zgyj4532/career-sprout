import { useState } from 'react'
import { campusFetch, downloadBlob } from '../api'
import RequestError from './RequestError'
import useUnsavedWork from '../hooks/useUnsavedWork'

export default function TeacherCompressionReview({ jobId, review, onDirtyChange }) {
  const paragraphs = review.original.split(/\n\s*\n/).filter((part) => part.trim())
  const draftParagraphs = review.draft.split(/\n\s*\n/).filter((part) => part.trim())
  let next = 0
  const initial = paragraphs.flatMap((paragraph, index) => paragraph === draftParagraphs[next] ? (next += 1, [index]) : [])
  const [selected, setSelected] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const dirty = selected.join(',') !== initial.join(',')
  useUnsavedWork(dirty)
  async function regenerate() {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const blob = await campusFetch(`/api/campus/teacher/jobs/${jobId}/targets/${review.targetId}/review-export`, { method: 'POST', body: JSON.stringify({ revision: review.revision, selected }) })
      downloadBlob(blob, '职芽-调整后定向简历.pdf')
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <section className="campus-panel"><h4>压缩对照与调整 · 版本 {review.revision}</h4>
    <p>原定向稿不会被修改。勾选保留的完整原文段落以调整压缩稿；标题、否定和必要限定需保留。重新生成时会检查授权、版本和实际 PDF 篇幅。</p>
    <details><summary>查看原定向稿</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{review.original}</pre></details>
    <details><summary>查看自动压缩的修改对照</summary><ul>{review.changes.map((change, index) => <li key={index}>{change}</li>)}</ul></details>
    <RequestError error={error} />
    <fieldset disabled={busy}><legend>调整保留的段落</legend>{paragraphs.map((paragraph, index) => <label className="campus-check" key={index}><input type="checkbox" checked={selected.includes(index)} onChange={(event) => { const updated = event.target.checked ? [...selected, index].sort((a, b) => a - b) : selected.filter((item) => item !== index); setSelected(updated); onDirtyChange(review.targetId, updated.join(',') !== initial.join(',')) }} /><span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{paragraph}</span></label>)}</fieldset>
    <button type="button" disabled={busy || !selected.length} onClick={regenerate}>{busy ? '正在重新生成 PDF…' : '按调整重新生成 PDF'}</button>
  </section>
}
