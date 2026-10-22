import { useEffect, useRef, useState } from 'react'
import { campusData } from '../api'
import RequestError from './RequestError'
import useUnsavedWork from '../hooks/useUnsavedWork'

function TargetEditor({ target, onChanged }) {
  const [draft, setDraft] = useState(target.draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const dirty = draft !== target.draft
  useUnsavedWork(dirty)
  const stale = target.stale || error?.code === 'JOB_CHANGED' || error?.code === 'SOURCE_CHANGED'
  async function persist(approve) {
    if (busy || stale) return
    setBusy(true); setError(null)
    try {
      const updated = await campusData(`/me/targets/${target.id}${approve ? '/approve' : ''}`, { method: approve ? 'POST' : 'PATCH', body: JSON.stringify(approve ? { revision: target.revision } : { draft, revision: target.revision }) })
      onChanged(updated)
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <article className="campus-panel"><h3>{target.company || '企业定向版本'} · {target.title || target.jobTitle || '所选岗位'}</h3><p>版本 {target.revision} · {stale ? '依据已变化，此版本不能确认或导出' : target.approved && !dirty ? '已确认，可在授权范围内导出' : '尚未确认，不能供教师导出'}</p>
    <RequestError error={error} />
    {stale && <p className="campus-note">原始简历或岗位要求已变化。请先复制要保留的文字，再在上方选择最新的原始简历和对应岗位，重新生成定向版本并核对事实。旧版本仅供对照，不能重新确认。</p>}
    {dirty && <p role="status">定向稿有未保存修改。</p>}
    <details open={dirty}><summary>查看或编辑此版本</summary>
    <label>定向简历正文<textarea disabled={busy} readOnly={stale} value={draft} maxLength={20000} onChange={(event) => setDraft(event.target.value)} /></label>
    <ul>{(target.changes || []).map((change) => <li key={change}>{change}</li>)}</ul><ul>{(target.questions || []).map((question) => <li key={question}>{question}</li>)}</ul>
    <div className="campus-actions"><button type="button" disabled={busy || stale || !dirty || !draft.trim()} onClick={() => persist(false)}>保存修改（取消旧确认）</button><button type="button" disabled={busy || stale || dirty || target.approved} onClick={() => persist(true)}>确认此版本的事实，允许授权教师导出</button><button type="button" disabled={busy || !dirty} onClick={() => setDraft(target.draft)}>放弃未保存修改</button></div>
    </details>
    {error?.status === 409 && !stale && <p>服务器版本已变化。请先复制你要保留的文字，再刷新页面读取最新版本；不会自动覆盖你的编辑。</p>}
  </article>
}
export default function TargetResumes({ resumeId, jobId, disabled }) {
  const [targets, setTargets] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const listVersion = useRef(0)
  async function load() {
    const version = ++listVersion.current
    try { const rows = await campusData('/me/targets'); if (version === listVersion.current) { setTargets(rows); setError(null) } } catch (err) { if (version === listVersion.current) setError(err) }
  }
  useEffect(() => { load(); return () => { listVersion.current += 1 } }, [])
  async function generate() {
    if (busy) return
    listVersion.current += 1
    setBusy(true); setError(null)
    try { const target = await campusData(`/me/resumes/${resumeId}/target`, { method: 'POST', body: JSON.stringify({ jobId }) }); setTargets((current) => [target, ...current.filter((row) => row.id !== target.id)]) } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <section className="campus-form"><h2>企业定向简历</h2><RequestError error={error} onRetry={load} />
    <details className="campus-tool"><summary>为岗位生成独立版本</summary><p>使用已保存的简历，不改原件；核对事实后单独确认教师导出权限。</p><button type="button" disabled={disabled || busy || !resumeId || !jobId} onClick={generate}>{busy ? '正在生成定向版本…' : '为所选岗位生成定向版本'}</button>
    {(!resumeId || !jobId) && <p>请先保存并选择简历，再选择目标岗位。</p>}</details>
    {targets.map((target) => <TargetEditor key={`${target.id}:${target.revision}`} target={target} onChanged={(updated) => { listVersion.current += 1; setTargets((current) => current.map((row) => row.id === updated.id ? updated : row)) }} />)}
  </section>
}
