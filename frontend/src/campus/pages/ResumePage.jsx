import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { campusData, campusFetch, downloadBlob, logClientEvent, resumeRows } from '../api'
import { materialText } from '../material'
import RequestError from '../components/RequestError'
import VoiceInput from '../components/VoiceInput'
import TargetResumes from '../components/TargetResumes'
import JobSelect from '../components/JobSelect'

const BLANK_DRAFT = JSON.stringify({ title: '', jobRole: '', text: '' })

export default function ResumePage() {
  const [search] = useSearchParams()
  const [resumes, setResumes] = useState([])
  const [jobs, setJobs] = useState([])
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
  const [busy, setBusy] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const revision = useRef(0)
  const polishRequest = useRef(null)
  const dirty = savedText !== JSON.stringify({ title, jobRole, text })
  async function loadList() { setResumes(resumeRows(await campusFetch('/api/resumes'))) }
  async function initialize() {
    try {
      const [me, listings] = await Promise.all([campusData('/me'), campusData('/jobs?limit=50'), loadList()])
      setMaterial(me)
      const selected = search.get('jobId') || me.student.targetJobId || ''
      setJobId(selected)
      let rows = listings.items
      if (selected && !rows.some((row) => row.id === selected)) rows = [...rows, await campusData(`/jobs/${selected}`)]
      setJobs(rows)
      setError(null)
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
  async function save(event) {
    event.preventDefault()
    if (busy || voiceActive) return
    setBusy(true); setError(null); setNote('')
    try {
      const payload = await campusFetch(`/api/resumes${currentId ? `/${currentId}` : ''}`, { method: currentId ? 'PUT' : 'POST', body: JSON.stringify({ title, jobRole, originalText: text }) })
      const id = payload.data.id
      setCurrentId(id)
      const data = (await campusFetch(`/api/resumes/${id}`)).data
      setText(data.originalText || ''); setTitle(data.title || ''); setJobRole(data.jobRole || '')
      setSavedText(JSON.stringify({ title: data.title || '', jobRole: data.jobRole || '', text: data.originalText || '' }))
      setNote('已保存，并重新读取服务器上的确认内容。'); logClientEvent('resume.saved'); await loadList()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function download() {
    setBusy(true); setError(null)
    try { downloadBlob(await campusFetch(`/api/resumes/${currentId}/download?version=original&paperSize=A4`), `${title || '职芽简历'}.pdf`); setNote('PDF 已开始下载。请打开检查中文与排版；超出一页半会被拒绝，不会截断内容。'); logClientEvent('resume.export.completed') } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <section className="resume-page campus-form"><header className="resume-page-header"><h1 className="resume-page-title">把经历写成简历</h1><p className="resume-page-desc">做过什么？你负责哪部分？最后有什么结果？先用自己的话说清楚，不必会写 Markdown。</p></header>
    <RequestError error={error} onRetry={!material ? initialize : undefined} />{note && <p className="campus-note" role="status">{note}</p>}
    <div className="resume-workspace"><div className="campus-form"><form className="campus-card resume-editor-card campus-form" onSubmit={save}>
      <fieldset disabled={busy} className="campus-form campus-fieldset"><div className="resume-meta-row"><label>简历标题<input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="给这份简历起个名字" /></label><label>想尝试的岗位（可留空）<input maxLength={200} value={jobRole} onChange={(event) => setJobRole(event.target.value)} placeholder="还没确定方向也可以保存简历" /></label></div>
      <JobSelect jobs={jobs} setJobs={setJobs} value={jobId} disabled={busy} onChange={(id) => { revision.current += 1; setSuggestion(null); setJobId(id); const job = jobs.find((row) => row.id === id); if (job) setJobRole(job.title) }} />
      <button type="button" disabled={!material || voiceActive} onClick={() => { const source = materialText(material); if (!source) { setNote('档案还没有材料，请先记录一件真实做过的事。'); return } editText([text, source].filter(Boolean).join('\n\n')) }}>把已保存的档案材料加入正文</button>
      <label>真实经历与简历正文<textarea className="resume-textarea" maxLength={20000} value={text} onChange={(event) => editText(event.target.value)} placeholder="课程、社团、项目或工作都可以。只写实际发生的事。" /></label>
      <div className="campus-actions"><button type="button" disabled={!text.trim() || polishing || voiceActive} onClick={polish}>{polishing ? '正在整理建议…' : 'AI 整理与润色'}</button>{polishing && <button type="button" onClick={() => { revision.current += 1; polishRequest.current?.abort(); setPolishing(false) }}>取消本次润色</button>}</div>
      {suggestion && <section className="campus-panel"><h2>核对后再采纳</h2><div className="campus-grid"><div><h3>本次原文</h3><p className="campus-preserve-text">{suggestion.source}</p></div><div><h3>AI 建议（尚未保存）</h3><p className="campus-preserve-text">{suggestion.draft}</p></div></div><h3>修改说明</h3><ul>{suggestion.changes.map((change) => <li key={change}>{change}</li>)}</ul><h3>请你补充的事实</h3><ul>{suggestion.questions.map((question) => <li key={question}>{question}</li>)}</ul><div className="campus-actions"><button type="button" onClick={() => { if (revision.current === suggestion.version) editText(suggestion.draft) }}>确认事实并采纳建议</button><button type="button" onClick={() => setSuggestion(null)}>取消，保留原文</button></div></section>}
      <div className="resume-actions-bar"><button className="btn-primary" type="submit" disabled={!text.trim() || polishing || voiceActive}>保存简历</button><button className="btn-secondary" type="button" disabled={!currentId || dirty || polishing || voiceActive} onClick={download}>下载确认版 PDF</button></div><p>{dirty ? '编辑尚未保存，PDF 和定向版本使用服务器已保存内容。' : currentId ? '当前内容已保存。' : '空白草稿，从一件真实经历开始。'} A4 通常一页，最多第二页上半页；过长请主动精简。</p>
    </fieldset></form>
    <section className="campus-panel"><h2>用声音补充经历</h2><VoiceInput disabled={busy || polishing} onActiveChange={setVoiceActive} onReview={(review) => editText([text, review].filter(Boolean).join('\n\n'))} /></section>
    </div><aside className="campus-card resume-sidebar"><h2 className="resume-sidebar-title">已保存的简历</h2><button type="button" disabled={busy || voiceActive || polishing} onClick={() => { if (dirty && !window.confirm('放弃当前未保存编辑并新建？')) return; revision.current += 1; setCurrentId(''); setTitle(''); setJobRole(''); setText(''); setSavedText(BLANK_DRAFT); setSuggestion(null) }}>新建空白简历</button><ul className="resume-saved-list">{resumes.map((resume) => <li key={resume.id}><button type="button" className={`resume-saved-item${currentId === resume.id ? ' is-active' : ''}`} disabled={busy || voiceActive || polishing} onClick={() => choose(resume.id)}>{resume.title}</button></li>)}</ul>{!resumes.length && <p>还没有简历，不会预填虚构经历。</p>}<Link to="/interview">使用已保存简历练面试</Link></aside></div>
    <TargetResumes resumeId={currentId} jobId={jobId} disabled={busy || dirty || polishing || voiceActive} />
  </section>
}
