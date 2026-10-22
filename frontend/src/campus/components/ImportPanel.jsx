import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { campusData, campusFetch, downloadBlob } from '../api'
import ImportConfirm from './ImportConfirm'
import RequestError from './RequestError'
import useUnsavedWork from '../hooks/useUnsavedWork'

const TYPES = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
export default function ImportPanel({ disabled, onSaved, onMutationChange, initiallyOpen = false, initialDraftId = '' }) {
  const [expanded, setExpanded] = useState(initiallyOpen)
  const [drafts, setDrafts] = useState([])
  const [draftTotal, setDraftTotal] = useState(0)
  const [draftPage, setDraftPage] = useState(1)
  const [loadingList, setLoadingList] = useState(false)
  const [draft, setDraft] = useState(null)
  const [result, setResult] = useState(null)
  const [decisions, setDecisions] = useState({})
  const [resumeId, setResumeId] = useState('')
  const [resumeTitle, setResumeTitle] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const confirmation = useRef(null)
  const dirty = draft && JSON.stringify(result) !== JSON.stringify(draft.result || null)
  useUnsavedWork(Boolean(dirty) || busy || ['saving', 'save_unknown'].includes(draft?.status))
  async function list(reset = true) {
    const page = reset ? 1 : draftPage + 1
    setLoadingList(true)
    try {
      const data = await campusData(page === 1 ? '/imports' : `/imports?page=${page}&limit=20`)
      setDrafts((current) => reset ? data.items : [...current, ...data.items.filter((row) => !current.some((old) => old.id === row.id))])
      setDraftTotal(data.total ?? data.items.length); setDraftPage(data.page || page)
    } finally { setLoadingList(false) }
  }
  useEffect(() => { list().catch(setError) }, [])
  useEffect(() => { if (initialDraftId) open(initialDraftId) }, [initialDraftId])
  function receive(data) {
    if (data.id !== draft?.id) confirmation.current = null
    setDraft(data); setResult(data.result || null); setDecisions({})
    setResumeId(data.resumeId || (data.resumeChoices?.length === 1 ? data.resumeChoices[0].id : ''))
    setResumeTitle(data.resumeTitle || '导入的简历')
  }
  function canLeave() { return !dirty || window.confirm('放弃这次尚未保存的结果修改？原件和服务器上的整理结果仍保留。') }
  async function open(id) {
    if (!canLeave()) return
    setBusy(true); setError(null); setNote('')
    try { receive(await campusData(`/imports/${id}`)) } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function upload(file) {
    if (!file || busy || disabled || !canLeave()) return
    const type = TYPES[file.name.split('.').pop().toLowerCase()]
    if (!type) { setNote('只接受文字型 PDF、DOCX、PNG、JPEG 或 WEBP。'); return }
    if (file.size > 10 * 1024 * 1024) { setNote('文件超过 10MB，请压缩后再上传。'); return }
    setBusy(true); setError(null); setNote('正在收取文件…')
    try {
      const data = (await campusFetch('/api/campus/imports', { method: 'POST', headers: { 'Content-Type': type, 'X-File-Name': encodeURIComponent(file.name) }, body: file })).data
      receive(data); setNote('原件已收好，正在整理。')
      if (!data.result && ['received', 'parsed'].includes(data.status) && data.canContinue) receive(await campusData(`/imports/${data.id}/continue`, { method: 'POST' }))
      setNote(''); await list()
    } catch (err) { setError(err); setNote('如果服务器已收下文件，可从下方导入记录继续，不必重复上传。'); list().catch(() => {}) }
    finally { setBusy(false) }
  }
  async function act(action, body) {
    if (busy || !draft) return
    setBusy(true); onMutationChange?.(true); setError(null); setNote('')
    if (action === 'confirm' && body) confirmation.current = body
    try {
      const submitted = action === 'confirm' ? body || confirmation.current : body
      const payload = await campusFetch(`/api/campus/imports/${draft.id}/${action}`, { method: 'POST', ...(submitted ? { body: JSON.stringify(submitted) } : {}) })
      receive({ ...payload.data, saved: payload.saved ?? payload.data?.saved, cachePending: payload.cachePending ?? payload.data?.cachePending })
      if (payload.saved || action === 'restore') {
        setNote(action === 'restore' ? payload.cachePending ? '内容已恢复，缓存刷新尚未完成。' : '已恢复导入前的内容。' : payload.cachePending ? '资料已保存，缓存刷新尚未完成。无需再次保存。' : '档案与简历已保存。')
        await onSaved?.()
      }
      await list()
    } catch (err) {
      setError(err)
      if (action === 'confirm' || action === 'restore') {
        try {
          const current = await campusData(`/imports/${draft.id}`)
          if (current.frozen || current.saved || ['saving', 'save_unknown', 'restoring', 'restored'].includes(current.status)) {
            receive(current)
            if (current.saved || current.status === 'restored') await onSaved?.()
          } else {
            setDraft(current)
            confirmation.current = null
          }
        } catch {
          setDraft((current) => ({ ...current, frozen: true, status: action === 'restore' ? 'restoring' : 'save_unknown', saved: action === 'restore', canContinue: true, phase: action === 'restore' ? '恢复结果未知，可以继续恢复' : '保存结果未知' }))
        }
      }
    } finally { setBusy(false); onMutationChange?.(false) }
  }
  async function discard() {
    if (!window.confirm('丢弃这份导入的原件、提取文字和整理结果？已保存到档案与简历的内容不会因此删除。')) return
    setBusy(true); setError(null)
    try { await campusData(`/imports/${draft.id}`, { method: 'DELETE' }); setDraft(null); setResult(null); await list() } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function source() {
    setError(null)
    try { downloadBlob(await campusFetch(`/api/campus/imports/${draft.id}/source`, { responseType: 'blob' }), draft.filename || draft.originalName || `导入原件.${draft.kind || 'pdf'}`) } catch (err) { setError(err) }
  }
  const saved = draft?.saved || draft?.status === 'saved'
  return <section className="campus-panel campus-form"><button type="button" aria-expanded={expanded || Boolean(draft)} disabled={Boolean(draft)} onClick={() => setExpanded((value) => !value)}>导入简历{draftTotal ? ` · ${draftTotal} 份记录` : ''}</button>
    <div hidden={!expanded && !draft}><p>支持文字型 PDF、DOCX 和图片。扫描 PDF 请改传原始图片。</p><label>上传已有简历<input type="file" accept=".pdf,.docx,image/png,image/jpeg,image/webp" disabled={disabled || busy} onChange={(event) => { upload(event.target.files?.[0]); event.target.value = '' }} /></label></div>
    <RequestError error={error} onRetry={() => list().catch(setError)} />{note && <p role="status">{note}</p>}{busy && !draft && <p role="status">正在处理导入，请保留页面…</p>}
    {draft && <><ImportConfirm key={draft.id} draft={draft} result={result} onChange={setResult} decisions={decisions} onDecision={(id, value) => setDecisions((current) => ({ ...current, [id]: value }))} resumeId={resumeId} onResume={(id) => { setResumeId(id); setResumeTitle(draft.resumeChoices.find((row) => row.id === id)?.title || '') }} resumeTitle={resumeTitle} onTitle={setResumeTitle} onSave={(skipIssues) => act('confirm', { result, decisions, ...(resumeId ? { resumeId } : { resumeTitle }), skipIssues })} onContinue={() => { if (draft.status === 'save_unknown' || draft.status === 'saving') act('confirm'); else if (canLeave()) act('continue') }} onSource={source} busy={busy || disabled} />
      {draft.changes?.length > 0 && <details><summary>这次保存改了什么</summary><ul>{draft.changes.map((change, index) => <li key={index}>{({ profile: '基本档案', student: '成长材料', resume: '简历' })[change.kind] || change.kind}：{change.changed ? change.created ? '新建' : '补充内容' : '保留原内容'}</li>)}</ul></details>}
      {saved && <div className="campus-actions"><Link to="/resume">去看简历</Link><Link to="/interview">继续准备面试</Link><button type="button" disabled={busy || disabled} onClick={() => { if (window.confirm('恢复这次导入前的内容？如果之后有人工修改，系统会拒绝覆盖。')) act('restore') }}>恢复导入前的版本</button></div>}
      {draft.cachePending && <button type="button" disabled={busy || disabled} onClick={() => act('cache')}>只重试刷新缓存</button>}
      <div className="campus-actions"><button type="button" disabled={busy || !dirty} onClick={() => { if (canLeave()) setResult(draft.result || null) }}>放弃本次结果编辑</button><button type="button" disabled={busy || disabled} onClick={discard}>丢弃这份导入与原件</button></div>
    </>}
    <details open={!draft && draftTotal > 0}><summary>找回导入记录（{draftTotal}）</summary><button type="button" disabled={busy || loadingList} onClick={() => list().catch(setError)}>刷新记录</button><ul>{drafts.map((row) => <li key={row.id}><button type="button" disabled={busy || disabled} onClick={() => open(row.id)}>{row.filename || row.resumeTitle || '已有材料'} · {row.phase || row.status}</button></li>)}</ul>{drafts.length < draftTotal && <button type="button" disabled={busy || loadingList} onClick={() => list(false).catch(setError)}>{loadingList ? '正在加载…' : '加载更多导入记录'}</button>}</details>
  </section>
}
