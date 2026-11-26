import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { campusData, campusFetch, downloadBlob, logClientEvent, resumeRows } from '../api'
import { materialText } from '../material'
import RequestError from '../components/RequestError'
import VoiceReview from '../components/VoiceReview'
import TargetResumes from '../components/TargetResumes'
import JobSelect from '../components/JobSelect'
import ImportPanel from '../components/ImportPanel'
import { materialSaveOperation, saveMaterialOperation } from '../saveOperation'
import useUnsavedWork from '../hooks/useUnsavedWork'
import useMobileWorkspaceView from '../hooks/useMobileWorkspaceView'
import WorkspaceHeading from '../art/WorkspaceHeading'
import './ResumePage.css'

const BLANK_DRAFT = JSON.stringify({ title: '', jobRole: '', text: '' })

const RESUME_VIEWS = { edit: '编辑简历', import: '导入简历', versions: '已保存版本' }
const RESUME_LEAVES = { materials: '补充材料与岗位', review: 'AI 润色与检查' }

const POLISH_MODES = [
  { id: 'general', label: '综合润色', hint: '在不改变真实经历与程度限定的前提下，让表达更清晰简洁。', button: 'AI 润色建议' },
  { id: 'star_achievements', label: 'STAR 核心成果(3条)', hint: '结合岗位 JD 提炼最多 3 条匹配成果，采用 STAR 句式并保留真实量化数据。', button: '提炼 STAR 核心成果' },
  { id: 'project_compact', label: '项目栏精简(2行)', hint: '突出项目价值与贡献，压缩到 2 行以内，贴合互联网/运营等行业表达。', button: '生成 2 行项目精简稿' },
  { id: 'hr_critique', label: 'HR 挑刺与删空话', hint: '站在 HR 视角挑出短板、删掉空话套话，标注与目标岗位弱相关的经历。', button: '开始 HR 视角检查' },
  { id: 'profile_summary', label: '个人简介(3句话)', hint: '根据目标岗位与真实经历生成 3 句话以内的个人简介，突出核心竞争力。', button: '生成 3 句话个人简介' },
  { id: 'quantify_value', label: '成果量化与价值转化', hint: '把职责转化为成果表达；有数据突出指标，无数据提炼工作价值并引导补充。', button: '转化成果与工作价值' },
  { id: 'interview_questions', label: '预测面试追问(5题)', hint: '基于这份简历预测面试官会追问的 5 个问题并附回答思路（只读参考，不改正文）。', button: '预测 5 道面试追问' },
  { id: 'layout_reorder', label: '排版与顺序优化', hint: '优化模块逻辑与段落顺序，优先展示与目标岗位匹配的能力和核心经历。', button: '优化排版与段落顺序' },
]

const CRITIQUE_LABELS = {
  shortcoming: '短板提示',
  fluff: '空话套话',
  irrelevant: '岗位弱相关',
}

export default function ResumePage() {
  const [search] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const importId = search.get('importId') || ''
  const linkedView = search.get('import') === '1' || importId ? 'import' : 'edit'
  const { isMobile, mobileView, openMobileView } = useMobileWorkspaceView()
  const [selectedView, setSelectedView] = useState(null)
  const rememberedTab = location.state?.resumeTab
  const baseView = selectedView?.locationKey === location.key ? selectedView.id :
    (isMobile && Object.hasOwn(RESUME_VIEWS, rememberedTab) ? rememberedTab : linkedView)
  const view = (isMobile && mobileView) || baseView
  const leaf = Boolean(RESUME_LEAVES[view])
  const viewHeading = useRef(null)
  const voiceTool = useRef(null)
  const compressionHeading = useRef(null)
  const resultHeading = useRef(null)
  const pendingEditorFocus = useRef(null)
  const focusView = useRef(false)
  const previousView = useRef(view)
  const viewIntent = useRef(0)
  useLayoutEffect(() => () => { viewIntent.current += 1 }, [location.key, view])
  useEffect(() => {
    const target = pendingEditorFocus.current
    pendingEditorFocus.current = null
    if (target && view === 'edit') {
      if (target === 'voice') showVoiceControls()
      else compressionHeading.current?.focus()
    } else if (focusView.current || (isMobile && previousView.current !== view)) {
      if (isMobile) {
        viewHeading.current?.focus({ preventScroll: true })
        if (window.scrollY) window.scrollTo(0, 0)
      } else viewHeading.current?.focus()
    }
    focusView.current = false
    previousView.current = view
  }, [isMobile, view])
  function showView(id) {
    if (id === view) return
    viewIntent.current += 1
    focusView.current = true
    if (RESUME_LEAVES[id]) {
      // A leaf pushed from an overview can return to that exact history entry.
      const resumeBaseTab = leaf ? location.state?.resumeBaseTab : view
      openMobileView(id, { replace: leaf, state: { ...location.state, resumeBaseTab } })
    } else if (leaf) {
      if (id === location.state?.resumeBaseTab) navigate(-1)
      else openMobileView('', { replace: true, state: { ...location.state, resumeBaseTab: null, resumeTab: id } })
    } else if (isMobile && !search.has('panel')) {
      const { pathname, search: query, hash, state } = location
      navigate({ pathname, search: query, hash }, { replace: true, state: { ...state, resumeTab: id } })
    } else setSelectedView({ id, locationKey: location.key })
  }
  function showVoiceControls() {
    const tool = voiceTool.current
    if (!tool) return
    tool.open = true
    tool.querySelector('summary')?.focus({ preventScroll: true })
    tool.scrollIntoView?.({ block: 'start' })
  }
  function returnToEditor(target) {
    pendingEditorFocus.current = target
    showView('edit')
  }
  const saveOperation = useRef(null)
  const [saveUnknown, setSaveUnknown] = useState(false)
  const [savedContinue, setSavedContinue] = useState(null)
  const [resumes, setResumes] = useState(null)
  const [jobs, setJobs] = useState([])
  const [jobsTotal, setJobsTotal] = useState(null)
  const [material, setMaterial] = useState(null)
  const [currentId, setCurrentId] = useState('')
  const [title, setTitle] = useState('')
  const [jobRole, setJobRole] = useState('')
  const [jobId, setJobId] = useState(search.get('jobId') || '')
  const [customJd, setCustomJd] = useState('')
  const [polishMode, setPolishMode] = useState('general')
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState(BLANK_DRAFT)
  const [suggestion, setSuggestion] = useState(null)
  useEffect(() => {
    if (isMobile && view === 'review' && suggestion) resultHeading.current?.focus()
  }, [isMobile, view, suggestion])
  const [compression, setCompression] = useState(null)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importWork, setImportWork] = useState(null)
  const [targetWork, setTargetWork] = useState(null)
  const busy = saving || importBusy || saveUnknown
  const editorLocked = busy || importWork === 'working'
  const [polishing, setPolishing] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const [serverRevision, setServerRevision] = useState(null)
  const recordLocked = editorLocked || voiceActive || polishing
  const [polishUnsaved, setPolishUnsaved] = useState(false)
  const revision = useRef(0)
  const polishRequest = useRef(null)
  const dirty = savedText !== JSON.stringify({ title, jobRole, text })
  const allowLeave = useUnsavedWork(dirty || saveUnknown || voiceActive)
  const activeMode = POLISH_MODES.find((item) => item.id === polishMode) || POLISH_MODES[0]
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
  function editText(value) { revision.current += 1; setText(value); setSuggestion(null); setCompression(null) }
  function applyRecord(data, id) {
    revision.current += 1; setSuggestion(null); setCompression(null)
    setCurrentId(data.id || id); setTitle(data.title || ''); setJobRole(data.jobRole || ''); setText(data.originalText || '')
    setServerRevision(data.revision || 1); setPolishUnsaved(false); setSavedContinue(data)
    setSavedText(JSON.stringify({ title: data.title || '', jobRole: data.jobRole || '', text: data.originalText || '' }))
  }
  async function choose(id, openEditor = false) {
    const sameRecord = id === currentId
    if (openEditor && sameRecord && dirty) { showView('edit'); return }
    if (dirty && !window.confirm('切换会放弃当前未保存的编辑，是否继续？')) return
    const intent = viewIntent.current
    setBusy(true); setError(null)
    try {
      const data = (await campusFetch(`/api/resumes/${id}`)).data
      if (!sameRecord || (data.revision || 1) !== serverRevision) applyRecord(data, id)
      if (openEditor && intent === viewIntent.current) showView('edit')
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  function startBlank() {
    if (dirty && !window.confirm('放弃当前未保存编辑并新建？')) return
    revision.current += 1; setCurrentId(''); setTitle(''); setJobRole(''); setText(''); setSavedText(BLANK_DRAFT); setSuggestion(null); setCompression(null); setServerRevision(null); setPolishUnsaved(false); setSavedContinue(null)
    showView('edit')
  }
  async function refreshAfterImport() {
    const refreshes = [campusData('/me').then(setMaterial), loadList()]
    if (currentId) refreshes.push(campusFetch(`/api/resumes/${currentId}`).then(({ data }) => {
      if ((data.revision || 1) !== serverRevision) applyRecord(data, currentId)
    }))
    const results = await Promise.allSettled(refreshes)
    const failure = results.find((result) => result.status === 'rejected')
    if (failure) setError(failure.reason)
  }
  async function polish() {
    if (polishing || !text.trim()) return
    const version = revision.current
    const source = text
    const requestedMode = polishMode
    const controller = new AbortController()
    polishRequest.current = controller
    setPolishing(true); setSuggestion(null); setError(null); setNote('')
    try {
      const payload = {
        sourceText: source,
        ...(jobId ? { jobId } : {}),
        ...(requestedMode !== 'general' ? { mode: requestedMode } : {}),
        ...(jobRole.trim() ? { jobRole: jobRole.trim() } : {}),
        ...(customJd.trim() ? { jobDescription: customJd.trim() } : {}),
      }
      const result = await campusData('/resumes/polish', { method: 'POST', signal: controller.signal, body: JSON.stringify(payload) })
      if (version === revision.current) setSuggestion({ ...result, mode: result.mode || requestedMode, source, version })
      else setNote('输入已改变，旧建议未应用。可以根据新内容重新润色。')
      logClientEvent('resume.polish.completed')
    } catch (err) { if (!controller.signal.aborted) setError(err) } finally { if (polishRequest.current === controller) setPolishing(false) }
  }
  function adoptDraft(nextText) {
    if (!suggestion || revision.current !== suggestion.version) return
    revision.current += 1
    setText(nextText)
    setSuggestion(null)
    setPolishUnsaved(true)
    if (isMobile) showView('edit')
  }
  async function continueToInterview(saved) {
    try {
      navigate(`/interview?resumeId=${encodeURIComponent(saved.id)}&resumeRevision=${encodeURIComponent(saved.revision)}${jobId ? `&jobId=${encodeURIComponent(jobId)}` : ''}`)
    } catch (err) { setError(err); setNote('简历已保存，但尚未进入面试准备。可以继续，不会重复新建。') }
  }
  async function save(event, continuing = false) {
    event?.preventDefault()
    if (saving || importBusy || importWork === 'working' || voiceActive) return
    if (!saveOperation.current && continuing && savedContinue && !dirty) { await continueToInterview(savedContinue); return }
    setBusy(true); setError(null); setNote('')
    if (!saveOperation.current) saveOperation.current = { operation: materialSaveOperation('/api/resumes', currentId, currentId ? { jobRole, originalText: text, revision: serverRevision } : { title, jobRole, originalText: text }), continuing, intent: viewIntent.current }
    const attempt = saveOperation.current
    try {
      const data = await saveMaterialOperation(attempt.operation)
      setCurrentId(data.id); setServerRevision(data.revision); setPolishUnsaved(false)
      setText(data.originalText ?? text); setTitle(data.title ?? title); setJobRole(data.jobRole ?? jobRole)
      setSavedText(JSON.stringify({ title: data.title ?? title, jobRole: data.jobRole ?? jobRole, text: data.originalText ?? text }))
      setSavedContinue(data); setSaveUnknown(false); saveOperation.current = null
      allowLeave()
      setNote('服务器已确认保存。'); logClientEvent('resume.saved')
      if (attempt.continuing && attempt.intent === viewIntent.current) await continueToInterview(data)
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
      if (currentId === resume.id) { revision.current += 1; setCurrentId(''); setTitle(''); setJobRole(''); setText(''); setSavedText(BLANK_DRAFT); setSuggestion(null); setCompression(null); setServerRevision(null); setPolishUnsaved(false); setSavedContinue(null) }
      await loadList()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function download() {
    setBusy(true); setError(null); setCompression(null); setNote('正在生成并检查 PDF；过长时会自动尝试按原文段落压缩。')
    try {
      const { data } = await campusFetch(`/api/resumes/${currentId}/download?version=original&paperSize=A4`, { headers: { Accept: 'application/json' } })
      const binary = atob(data.pdf)
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${title || '职芽简历'}.pdf`)
      setCompression(data.compression)
      setNote(data.compression ? '已下载压缩版 PDF，原简历未更改。请核对下方原文、压缩稿和省略内容；可将压缩稿放入编辑器修改。' : 'PDF 已开始下载，请打开检查中文与排版。')
      logClientEvent('resume.export.completed')
    } catch (err) { setNote('未完成导出，已保存的原文未更改。'); setError(err) } finally { setBusy(false) }
  }
  const reviewView = isMobile ? 'review' : 'edit'
  const editorActions = <div className="resume-actions-bar">
    <button form="resume-editor-form" className="btn-primary" type="submit" disabled={!text.trim() || polishing || voiceActive}>{savedContinue && !dirty ? '继续准备面试' : '保存并继续'}</button>
    <button form="resume-editor-form" type="button" disabled={!text.trim() || polishing || voiceActive} onClick={(event) => { if (event.currentTarget.form.reportValidity()) save(event) }}>保存简历</button>
    <button type="button" disabled={!currentId || dirty || polishing || voiceActive} onClick={download}>下载确认版 PDF</button>
  </div>
  const compressionReview = compression && <section className="campus-panel campus-form">
    <h2 tabIndex={isMobile ? -1 : undefined} ref={compressionHeading}>压缩稿与原文对照</h2>
    <p>压缩稿未保存到原简历；请核对省略内容是否影响事实和上下文。</p>
    <div className="campus-grid"><div><h3>原文</h3><p className="campus-preserve-text">{compression.original}</p></div><div><h3>压缩稿</h3><p className="campus-preserve-text">{compression.draft}</p></div></div>
    <h3>修改对照</h3><ul>{compression.changes.map((change, index) => <li key={index} className="campus-preserve-text">{change}</li>)}</ul>
    <button type="button" disabled={recordLocked || dirty} onClick={editCompressedCopy}>作为新简历修改压缩稿</button>
  </section>
  function changePolishMode(id) {
    revision.current += 1; setSuggestion(null); setPolishMode(id)
  }
  function dismissSuggestion() {
    setSuggestion(null)
    if (isMobile) viewHeading.current?.focus()
  }
  function editCompressedCopy() {
    setCurrentId(''); setTitle(`${title.slice(0, 95)} 压缩稿`); setServerRevision(null)
    setSavedContinue(null); setSavedText(BLANK_DRAFT); editText(compression.draft)
    setNote('压缩稿已作为新简历草稿放入编辑器，尚未保存；原简历不会被覆盖。')
    if (isMobile) {
      viewHeading.current?.focus({ preventScroll: true })
      if (window.scrollY) window.scrollTo(0, 0)
    }
  }
  return <section className="resume-page campus-form">
    {isMobile ? <h1 className="resume-mobile-title">简历</h1> : <WorkspaceHeading kind="resume" title="把经历写成简历" description="先写一件你做过的事：你负责什么，最后做成了什么。" />}
    {leaf
      ? <button className="resume-leaf-back" type="button" onClick={() => showView('edit')}>← 返回编辑简历</button>
      : <div className="resume-view-switch" role="group" aria-label="简历工作区">
        {Object.entries(RESUME_VIEWS).map(([id, label]) => <button key={id} type="button" aria-pressed={id === view} aria-controls={`resume-view-${id}`} onClick={() => showView(id)}>{label}</button>)}
      </div>}
    <RequestError error={error} onRetry={(!material || jobsTotal === null || resumes === null) && !editorLocked ? initialize : undefined} />
    {note && <p className="campus-note" role="status">{note}</p>}
    {saveUnknown && <button type="button" className="primary" disabled={saving || importWork === 'working'} onClick={() => save()}>检查保存结果并继续</button>}
    {saving && <p role="status">正在处理简历，请稍候…</p>}
    {dirty && view !== 'edit' && !leaf && <p role="status">简历还没保存。回到编辑页可以继续写。</p>}
    {view !== reviewView && (polishing || suggestion) && (!isMobile || view !== 'edit') && (isMobile
      ? <button className="resume-work-link" type="button" onClick={() => showView('review')}>{polishing ? '查看 AI 润色进度' : '核对待处理的 AI 建议'}</button>
      : <p role="status">{polishing ? 'AI 正在润色' : '有 AI 建议待核对'}，返回编辑简历查看。</p>)}
    {view !== 'edit' && voiceActive && (isMobile
      ? <button className="resume-work-link" type="button" onClick={() => returnToEditor('voice')}>返回录音或校对</button>
      : <p role="status">语音录制或校对尚未完成，返回编辑简历查看。</p>)}
    {view !== 'edit' && compression && (isMobile
      ? <button className="resume-work-link" type="button" onClick={() => returnToEditor('compression')}>核对 PDF 压缩稿</button>
      : <p role="status">有 PDF 压缩稿待核对，返回编辑简历查看。</p>)}
    {importWork && view !== 'import' && (isMobile
      ? <button className="resume-work-link" type="button" onClick={() => showView('import')}>{importWork === 'recovery' ? '检查导入结果' : importWork === 'editing' ? '返回未保存的导入结果' : '查看导入进度'}</button>
      : <p role="status">{importWork === 'recovery' ? '导入结果尚未确认，返回导入简历检查。' : importWork === 'editing' ? '导入结果有尚未保存的编辑，返回导入简历核对。' : '正在处理导入，返回导入简历查看进度。'}</p>)}
    {targetWork && view !== 'versions' && (isMobile
      ? <button className="resume-work-link" type="button" onClick={() => showView('versions')}>{targetWork === 'working' ? '查看定向版本进度' : '返回未保存的定向版本'}</button>
      : <p role="status">{targetWork === 'working' ? '正在处理定向版本' : '定向版本有尚未保存的编辑'}，返回已保存版本查看。</p>)}
    {/* The editor and both leaves share one form; hiding a view never remounts its controls. */}
    <section id="resume-view-edit" className="campus-form" aria-labelledby={`resume-heading-${leaf ? view : 'edit'}`} hidden={view !== 'edit' && !leaf}>
      <h2 id="resume-heading-edit" className="resume-edit-heading" tabIndex={-1} ref={view === 'edit' ? viewHeading : null} hidden={leaf}>编辑简历</h2>
      {leaf && <h2 id={`resume-heading-${view}`} tabIndex={-1} ref={viewHeading}>{RESUME_LEAVES[view]}</h2>}
      {!isMobile && compressionReview}
    <form id="resume-editor-form" className="campus-card resume-editor-card campus-form" noValidate={leaf} onSubmit={(event) => {
      if (leaf) event.preventDefault()
      else save(event, true)
    }}>
      <fieldset disabled={editorLocked} className="campus-form campus-fieldset">
      <div className="resume-meta-row" hidden={leaf}>
        <div>
          <label>简历标题<input required maxLength={100} readOnly={Boolean(currentId)} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="给这份简历起个名字" /></label>
          {currentId && <button type="button" disabled={recordLocked} onClick={() => rename({ id: currentId, title, revision: serverRevision })}>修改当前简历名称</button>}
        </div>
        <label>想尝试的岗位（可留空）<input maxLength={200} value={jobRole} onChange={(event) => { revision.current += 1; setSuggestion(null); setJobRole(event.target.value) }} placeholder="还没确定方向也可以保存简历" /></label>
      </div>
      <details id="resume-view-materials" className="campus-tool resume-materials" open={isMobile ? true : undefined} hidden={isMobile && view !== 'materials'}>
        <summary hidden={isMobile}>补充材料、选择岗位或临时粘贴招聘要求（JD）</summary>
        <div className="resume-material-fields">
          <JobSelect jobs={jobs} setJobs={setJobs} total={jobsTotal} loadError={error} value={jobId} disabled={editorLocked} onChange={(id) => { revision.current += 1; setSuggestion(null); setJobId(id); const job = jobs.find((row) => row.id === id); if (job) setJobRole(job.title) }} />
          <label>临时粘贴岗位 JD 要求（可选，不新建岗位也可用于本次 AI 润色与诊断）<textarea rows={4} maxLength={10000} value={customJd} onChange={(event) => { revision.current += 1; setSuggestion(null); setCustomJd(event.target.value) }} placeholder="粘贴招聘职责与任职要求，帮助 AI 提炼匹配的 STAR 成果、个人简介或做 HR 视角检查。" /></label>
          <button type="button" disabled={!material || voiceActive} onClick={() => { const source = materialText(material); if (!source) { setNote('档案还没有可用于简历的材料。想法会保留在个人资料，不当作已完成经历。'); return } editText([text, source].filter(Boolean).join('\n\n')); if (isMobile) showView('edit') }}>把已保存的档案材料加入正文</button>
        </div>
      </details>
      <label hidden={leaf}>真实经历与简历正文<textarea className="resume-textarea" maxLength={20000} value={text} onChange={(event) => editText(event.target.value)} placeholder="课程、社团、项目或工作都可以。只写实际发生的事。" /></label>
      <div id="resume-view-review" className="resume-review" hidden={isMobile && view !== 'review'}>
      <div className="resume-polish-box" hidden={isMobile && Boolean(suggestion)}>
        {isMobile ? <label>润色或检查方式<select value={polishMode} disabled={polishing || voiceActive} onChange={(event) => changePolishMode(event.target.value)}>
          {POLISH_MODES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select></label> : <div className="resume-polish-modes" role="group" aria-label="AI 润色与辅导场景">
          {POLISH_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={polishMode === item.id}
              disabled={polishing || voiceActive}
              className={`resume-mode-chip${polishMode === item.id ? ' is-selected' : ''}`}
              onClick={() => changePolishMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>}
        <p className="resume-label-hint">{activeMode.hint}</p>
        {isMobile && !text.trim() && <p>先返回编辑简历，写下真实经历，再使用 AI 润色或检查。</p>}
        {isMobile && voiceActive && <p>请先完成或取消录音、校对，再使用 AI 润色或检查。</p>}
        <div className="campus-actions"><button type="button" disabled={!text.trim() || polishing || voiceActive} onClick={polish}>{polishing ? '正在润色…' : activeMode.button}</button>{polishing && <button type="button" onClick={() => { revision.current += 1; polishRequest.current?.abort(); setPolishing(false) }}>取消本次润色</button>}{polishUnsaved && <span role="status">尚未保存</span>}</div>
      </div>
      {suggestion && suggestion.mode === 'interview_questions' && <section className="campus-panel">
        <h2 tabIndex={isMobile ? -1 : undefined} ref={resultHeading}>基于简历的面试追问预测（只读参考，不改写简历）</h2>
        <ol className="resume-interview-list">
          {(suggestion.interviewQuestions || []).map((item, index) => (
            <li key={`${index}-${item.question}`} className="resume-interview-item">
              <strong>{item.question}</strong>
              {item.sourceExcerpt && <p className="resume-label-hint campus-preserve-text">触发依据：{item.sourceExcerpt}</p>}
              <p className="campus-preserve-text">回答思路：{item.approach}</p>
            </li>
          ))}
        </ol>
        <div className="campus-actions"><button type="button" onClick={dismissSuggestion}>收起预测问题</button></div>
      </section>}
      {suggestion && suggestion.mode !== 'interview_questions' && <section className="campus-panel"><h2 tabIndex={isMobile ? -1 : undefined} ref={resultHeading}>核对后再采纳</h2>
        {(suggestion.critiques || []).length > 0 && <div className="resume-critique-box"><h3>HR 视角问题标注</h3><ul className="resume-critique-list">{suggestion.critiques.map((item, index) => <li key={`${index}-${item.kind}`}><span className={`resume-critique-tag is-${item.kind}`}>{CRITIQUE_LABELS[item.kind] || '诊断'}</span>{item.excerpt ? `「${item.excerpt}」：` : ''}{item.advice}</li>)}</ul></div>}
        <div className="campus-grid"><div><h3>本次原文</h3><p className="campus-preserve-text">{suggestion.source}</p></div><div><h3>AI 建议（尚未保存）</h3><p className="campus-preserve-text">{suggestion.draft}</p></div></div>
        {(suggestion.changes || []).length > 0 && <><h3>修改说明</h3><ul>{suggestion.changes.map((change) => <li key={change}>{change}</li>)}</ul></>}
        {(suggestion.questions || []).length > 0 && <><h3>请你补充的事实</h3><ul>{suggestion.questions.map((question) => <li key={question}>{question}</li>)}</ul></>}
        <div className="campus-actions">
          {suggestion.mode === 'profile_summary' && <button type="button" onClick={() => adoptDraft(`## 个人简介\n${suggestion.draft}\n\n${suggestion.source}`)}>插入到简历开头</button>}
          <button type="button" onClick={() => adoptDraft(suggestion.draft)}>确认事实并采纳建议</button>
          <button type="button" onClick={dismissSuggestion}>取消，保留原文</button>
        </div>
      </section>}
      </div>
      {!isMobile && editorActions}
      {!leaf && <p role="status">{dirty ? '编辑尚未保存，PDF 和定向版本使用服务器已保存内容。' : currentId ? `当前内容已保存 · 版本 ${serverRevision}` : '空白草稿，从一件真实经历开始。'} A4 最多第二页上半页；超长时自动尝试压缩并重新检查。</p>}
    </fieldset></form>
      {isMobile && !leaf && <div className="resume-mobile-tools" role="group" aria-label="简历工具">
        <button type="button" aria-controls="resume-view-materials" onClick={() => showView('materials')}>{RESUME_LEAVES.materials}</button>
        <button type="button" aria-controls="resume-view-review" onClick={() => showView('review')}>{polishing ? '查看 AI 润色进度' : suggestion ? '核对待处理的 AI 建议' : RESUME_LEAVES.review}</button>
        <button type="button" aria-controls="resume-voice-tool" onClick={showVoiceControls}>{voiceActive ? '继续录音或校对' : '用声音补充经历'}</button>
        {compression && <button type="button" onClick={() => compressionHeading.current?.focus()}>核对 PDF 压缩稿</button>}
      </div>}
    {voiceActive && view === 'edit' && !isMobile && <p role="status">语音输入正在处理中，请展开语音工具完成或取消；文字仍保留。</p>}
    <details id="resume-voice-tool" ref={voiceTool} className="campus-tool" open={voiceActive} hidden={leaf}>
      <summary>{isMobile ? '录音与文字校对' : '用声音补充经历'}</summary>
      <VoiceReview disabled={editorLocked || polishing} onActiveChange={setVoiceActive} onReview={(review) => editText([text, review].filter(Boolean).join('\n\n'))} />
    </details>
    {isMobile && !leaf && compressionReview}
    {isMobile && !leaf && <fieldset disabled={editorLocked} className="campus-fieldset">{editorActions}</fieldset>}
    </section>
    <section id="resume-view-import" className="campus-form campus-panel" aria-labelledby="resume-heading-import" hidden={view !== 'import'}>
      <h2 id="resume-heading-import" tabIndex={-1} ref={view === 'import' ? viewHeading : null}>导入简历</h2>
      {dirty && <p>请先保存当前编辑或明确放弃后再导入，避免覆盖尚未保存的内容。</p>}
      {!dirty && (busy || voiceActive || polishing) && !importWork && <p role="status">请先完成编辑简历中的操作，再继续导入。</p>}
      <ImportPanel initialDraftId={importId} disabled={busy || dirty || voiceActive || polishing} onMutationChange={setImportBusy} onWorkChange={setImportWork} onSaved={refreshAfterImport} onViewResumes={() => showView('versions')} />
    </section>
    <section id="resume-view-versions" className="campus-form" aria-labelledby="resume-heading-versions" hidden={view !== 'versions'}>
      <div className="campus-panel resume-versions-card">
        <h2 id="resume-heading-versions" tabIndex={-1} ref={view === 'versions' ? viewHeading : null}>已保存的简历</h2>
        <p>打开原始简历继续编辑，或从已保存内容生成独立的企业定向版本。</p>
        <button type="button" disabled={recordLocked} onClick={startBlank}>新建空白简历</button>
        {resumes?.length > 0 && <ul className="resume-version-list">{resumes.map((resume) => <li key={resume.id}>
          <button type="button" className={`resume-saved-item${currentId === resume.id ? ' is-active' : ''}`} disabled={recordLocked} aria-current={currentId === resume.id ? 'true' : undefined} onClick={() => choose(resume.id, true)}>{resume.title}</button>
          <details><summary>管理</summary><div className="campus-actions"><button type="button" disabled={recordLocked} onClick={() => rename(resume)}>改名</button><button type="button" disabled={recordLocked} onClick={() => remove(resume)}>删除</button></div></details>
        </li>)}</ul>}
        {resumes?.length === 0 && <p>还没有已保存的简历。</p>}
        {resumes === null && !error && <p role="status">正在读取已保存的简历…</p>}
      </div>
      <TargetResumes resumeId={currentId} jobId={jobId} disabled={recordLocked || dirty} onWorkChange={setTargetWork} />
    </section>
  </section>
}
