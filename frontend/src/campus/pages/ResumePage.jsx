import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { campusData, campusFetch, downloadBlob, logClientEvent, resumeRows } from '../api'
import { materialText } from '../material'
import RequestError from '../components/RequestError'
import VoiceReview from '../components/VoiceReview'
import TargetResumes from '../components/TargetResumes'
import JobSelect from '../components/JobSelect'
import ImportPanel from '../components/ImportPanel'
import { materialSaveOperation, saveMaterialOperation } from '../saveOperation'
import useUnsavedWork from '../hooks/useUnsavedWork'

const BLANK_DRAFT = JSON.stringify({ title: '', jobRole: '', text: '' })

export default function ResumePage() {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const saveOperation = useRef(null)
  const [saveUnknown, setSaveUnknown] = useState(false)
  const [savedContinue, setSavedContinue] = useState(null)
  const [resumes, setResumes] = useState([])
  const [jobs, setJobs] = useState([])
  const [jobsTotal, setJobsTotal] = useState(null)
  const [material, setMaterial] = useState(null)
  const [currentId, setCurrentId] = useState('')
  const [title, setTitle] = useState('')
  const [jobRole, setJobRole] = useState('')
  const [jobId, setJobId] = useState(search.get('jobId') || '')
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState(BLANK_DRAFT)
  const [suggestion, setSuggestion] = useState(null)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const busy = saving || importBusy || saveUnknown
  const [polishing, setPolishing] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const [serverRevision, setServerRevision] = useState(null)
  const [polishUnsaved, setPolishUnsaved] = useState(false)
  const revision = useRef(0)
  const polishRequest = useRef(null)
  const dirty = savedText !== JSON.stringify({ title, jobRole, text })
  const allowLeave = useUnsavedWork(dirty || saveUnknown || voiceActive)
  async function loadList() { setResumes(resumeRows(await campusFetch('/api/resumes'))) }
  async function initialize() {
    try {
      const [me, listings] = await Promise.all([campusData('/me'), campusData('/jobs?limit=50'), loadList()])
      setMaterial(me)
      const selected = search.get('jobId') || me.student.targetJobId || ''
      setJobId(selected)
      let rows = listings.items
      if (selected && !rows.some((row) => row.id === selected)) rows = [...rows, await campusData(`/jobs/${selected}`)]
      if (selected && search.get('jobRevision') && rows.find((row) => row.id === selected)?.updatedAt !== search.get('jobRevision')) {
        setJobId(''); setNote('岗位在保存后又有变化，请重新选择并核对，不会静默使用不同版本。')
      }
      setJobs(rows)
      setJobsTotal(listings.total)
      setError(null)
      if (search.get('resumeId')) await choose(search.get('resumeId'))
    } catch (err) { setError(err) }
  }
  useEffect(() => { initialize(); return () => { revision.current += 1; polishRequest.current?.abort() } }, [])
  function editText(value) { revision.current += 1; setText(value); setSuggestion(null) }
  async function choose(id) {
    if (dirty && !window.confirm('切换会放弃当前未保存的编辑，是否继续？')) return
    revision.current += 1; setSuggestion(null); setBusy(true); setError(null)
    try {
      const data = (await campusFetch(`/api/resumes/${id}`)).data
      setCurrentId(data.id || id); setTitle(data.title || ''); setJobRole(data.jobRole || ''); setText(data.originalText || '')
      setServerRevision(data.revision || 1); setPolishUnsaved(false)
      setSavedContinue(data)
      setSavedText(JSON.stringify({ title: data.title || '', jobRole: data.jobRole || '', text: data.originalText || '' }))
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function polish() {
    if (polishing || !text.trim()) return
    const version = revision.current
    const source = text
    const controller = new AbortController()
    polishRequest.current = controller
    setPolishing(true); setSuggestion(null); setError(null); setNote('')
    try {
      const result = await campusData('/resumes/polish', { method: 'POST', signal: controller.signal, body: JSON.stringify({ sourceText: source, ...(jobId ? { jobId } : {}) }) })
      if (version === revision.current) setSuggestion({ ...result, source, version })
      else setNote('输入已改变，旧建议未应用。可以根据新内容重新润色。')
      logClientEvent('resume.polish.completed')
    } catch (err) { if (!controller.signal.aborted) setError(err) } finally { if (polishRequest.current === controller) setPolishing(false) }
  }
  async function continueToInterview(saved) {
    try {
      navigate(`/interview?resumeId=${encodeURIComponent(saved.id)}&resumeRevision=${encodeURIComponent(saved.revision)}${jobId ? `&jobId=${encodeURIComponent(jobId)}` : ''}`)
    } catch (err) { setError(err); setNote('简历已保存，但尚未进入面试准备。可以继续，不会重复新建。') }
  }
  async function save(event, continuing = false) {
    event?.preventDefault()
    if (saving || importBusy || voiceActive) return
    if (!saveOperation.current && continuing && savedContinue && !dirty) { await continueToInterview(savedContinue); return }
    setBusy(true); setError(null); setNote('')
    if (!saveOperation.current) saveOperation.current = { operation: materialSaveOperation('/api/resumes', currentId, currentId ? { jobRole, originalText: text, revision: serverRevision } : { title, jobRole, originalText: text }), continuing }
    const attempt = saveOperation.current
    try {
      const data = await saveMaterialOperation(attempt.operation)
      setCurrentId(data.id); setServerRevision(data.revision); setPolishUnsaved(false)
      setText(data.originalText ?? text); setTitle(data.title ?? title); setJobRole(data.jobRole ?? jobRole)
      setSavedText(JSON.stringify({ title: data.title ?? title, jobRole: data.jobRole ?? jobRole, text: data.originalText ?? text }))
      setSavedContinue(data); setSaveUnknown(false); saveOperation.current = null
      allowLeave()
      setNote('服务器已确认保存。'); logClientEvent('resume.saved')
      if (attempt.continuing) await continueToInterview(data)
      else { try { await loadList() } catch (err) { setError(err); setNote('简历已确认保存；列表刷新失败，当前保存版本仍可继续使用。') } }
    } catch (err) {
      setError(err); setSaveUnknown(attempt.operation.unknown)
      if (attempt.operation.unknown) setNote('保存结果尚未确认。当前内容已保留，请先检查保存结果，不要重新创建。')
      else saveOperation.current = null
    } finally { setBusy(false) }
  }
  async function rename(resume) {
    const name = window.prompt('新的简历名称', resume.title || '')
    if (!name || !name.trim()) return
    setBusy(true); setError(null)
    try {
      const payload = await campusFetch(`/api/resumes/${resume.id}`, { method: 'PUT', body: JSON.stringify({ title: name.trim(), revision: resume.revision || serverRevision || 1 }) })
      if (currentId === resume.id) {
        const renamed = payload.data.title || name.trim()
        setTitle(renamed); setSavedText((previous) => JSON.stringify({ ...JSON.parse(previous), title: renamed }))
        setServerRevision(payload.data.revision || serverRevision)
        setSavedContinue((current) => current?.id === resume.id ? { ...current, title: renamed, revision: payload.data.revision } : current)
      }
      await loadList()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function remove(resume) {
    if (!window.confirm(currentId === resume.id && dirty ? '删除会放弃当前未保存的编辑，并清理此简历的版本、分享与定向稿。历史面试保留。是否继续？' : `删除《${resume.title}》及其版本、分享与定向稿？历史面试保留。`)) return
    setBusy(true); setError(null)
    try {
      await campusFetch(`/api/resumes/${resume.id}`, { method: 'DELETE' })
      if (currentId === resume.id) { revision.current += 1; setCurrentId(''); setTitle(''); setJobRole(''); setText(''); setSavedText(BLANK_DRAFT); setSuggestion(null); setServerRevision(null); setPolishUnsaved(false); setSavedContinue(null) }
      await loadList()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function download() {
    setBusy(true); setError(null)
    try { downloadBlob(await campusFetch(`/api/resumes/${currentId}/download?version=original&paperSize=A4`), `${title || '职芽简历'}.pdf`); setNote('PDF 已开始下载。请打开检查中文与排版；超出一页半会被拒绝，不会截断内容。'); logClientEvent('resume.export.completed') } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <section className="resume-page campus-form"><header className="resume-page-header"><h1 className="resume-page-title">把经历写成简历</h1><p className="resume-page-desc">做过什么？你负责哪部分？最后有什么结果？先用自己的话说清楚，不必会写 Markdown。</p></header>
    <RequestError error={error} onRetry={!material || jobsTotal === null ? initialize : undefined} />{note && <p className="campus-note" role="status">{note}</p>}
    {saveUnknown && <button type="button" className="primary" disabled={saving} onClick={() => save()}>检查保存结果并继续</button>}
    <ImportPanel initiallyOpen={search.get('import') === '1'} initialDraftId={search.get('importId') || ''} disabled={busy || dirty || voiceActive || polishing} onMutationChange={setImportBusy} onSaved={async () => { await initialize(); if (currentId) await choose(currentId) }} />
    <div className="resume-workspace"><div className="campus-form"><form className="campus-card resume-editor-card campus-form" onSubmit={(event) => save(event, true)}>
      <fieldset disabled={busy} className="campus-form campus-fieldset"><div className="resume-meta-row"><label>简历标题<input required maxLength={100} readOnly={Boolean(currentId)} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="给这份简历起个名字" /></label>{currentId && <button type="button" onClick={() => rename({ id: currentId, title, revision: serverRevision })}>修改当前简历名称</button>}<label>想尝试的岗位（可留空）<input maxLength={200} value={jobRole} onChange={(event) => { revision.current += 1; setSuggestion(null); setJobRole(event.target.value) }} placeholder="还没确定方向也可以保存简历" /></label></div>
      <details className="campus-tool"><summary>补充材料或选择目标岗位</summary><JobSelect jobs={jobs} setJobs={setJobs} total={jobsTotal} loadError={error} value={jobId} disabled={busy} onChange={(id) => { revision.current += 1; setSuggestion(null); setJobId(id); const job = jobs.find((row) => row.id === id); if (job) setJobRole(job.title) }} />
      <button type="button" disabled={!material || voiceActive} onClick={() => { const source = materialText(material); if (!source) { setNote('档案还没有可用于简历的材料。想法会保留在个人资料，不当作已完成经历。'); return } editText([text, source].filter(Boolean).join('\n\n')) }}>把已保存的档案材料加入正文</button></details>
      <label>真实经历与简历正文<textarea className="resume-textarea" maxLength={20000} value={text} onChange={(event) => editText(event.target.value)} placeholder="课程、社团、项目或工作都可以。只写实际发生的事。" /></label>
      <div className="campus-actions"><button type="button" disabled={!text.trim() || polishing || voiceActive} onClick={polish}>{polishing ? '正在润色…' : 'AI 润色建议'}</button>{polishing && <button type="button" onClick={() => { revision.current += 1; polishRequest.current?.abort(); setPolishing(false) }}>取消本次润色</button>}{polishUnsaved && <span role="status">尚未保存</span>}</div>
      {suggestion && <section className="campus-panel"><h2>核对后再采纳</h2><div className="campus-grid"><div><h3>本次原文</h3><p className="campus-preserve-text">{suggestion.source}</p></div><div><h3>AI 建议（尚未保存）</h3><p className="campus-preserve-text">{suggestion.draft}</p></div></div><h3>修改说明</h3><ul>{suggestion.changes.map((change) => <li key={change}>{change}</li>)}</ul><h3>请你补充的事实</h3><ul>{suggestion.questions.map((question) => <li key={question}>{question}</li>)}</ul><div className="campus-actions"><button type="button" onClick={() => { if (revision.current === suggestion.version) { setText(suggestion.draft); setSuggestion(null); setPolishUnsaved(true) } }}>确认事实并采纳建议</button><button type="button" onClick={() => setSuggestion(null)}>取消，保留原文</button></div></section>}
      <div className="resume-actions-bar"><button className="btn-primary" type="submit" disabled={!text.trim() || polishing || voiceActive}>{savedContinue && !dirty ? '继续准备面试' : '保存并继续'}</button><button type="button" disabled={!text.trim() || polishing || voiceActive} onClick={(event) => { if (event.currentTarget.form.reportValidity()) save(event) }}>保存简历</button><button type="button" disabled={!currentId || dirty || polishing || voiceActive} onClick={download}>下载确认版 PDF</button></div><p role="status">{dirty ? '编辑尚未保存，PDF 和定向版本使用服务器已保存内容。' : currentId ? `当前内容已保存 · 版本 ${serverRevision}` : '空白草稿，从一件真实经历开始。'} A4 通常一页，最多第二页上半页；过长请主动精简。</p>
    </fieldset></form>
    {voiceActive && <p role="status">语音输入正在处理中，请展开语音工具完成或取消；文字仍保留。</p>}<details className="campus-tool" open={voiceActive}><summary>用声音补充经历</summary><VoiceReview disabled={busy || polishing} onActiveChange={setVoiceActive} onReview={(review) => editText([text, review].filter(Boolean).join('\n\n'))} /></details>
    </div><aside className="campus-card resume-sidebar"><h2 className="resume-sidebar-title">已保存的简历</h2><button type="button" disabled={busy || voiceActive || polishing} onClick={() => { if (dirty && !window.confirm('放弃当前未保存编辑并新建？')) return; revision.current += 1; setCurrentId(''); setTitle(''); setJobRole(''); setText(''); setSavedText(BLANK_DRAFT); setSuggestion(null); setServerRevision(null); setPolishUnsaved(false); setSavedContinue(null) }}>新建空白简历</button><ul className="resume-saved-list">{resumes.map((resume) => <li key={resume.id}><button type="button" className={`resume-saved-item${currentId === resume.id ? ' is-active' : ''}`} disabled={busy || voiceActive || polishing} onClick={() => choose(resume.id)}>{resume.title}</button><details><summary>管理</summary><button type="button" disabled={busy || voiceActive || polishing} onClick={() => rename(resume)}>改名</button><button type="button" disabled={busy || voiceActive || polishing} onClick={() => remove(resume)}>删除</button></details></li>)}</ul>{!resumes.length && <p>还没有简历，不会预填虚构经历。</p>}</aside></div>
    <TargetResumes resumeId={currentId} jobId={jobId} disabled={busy || dirty || polishing || voiceActive} />
  </section>
}
