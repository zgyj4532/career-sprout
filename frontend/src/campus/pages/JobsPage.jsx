import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { campusData } from '../api'
import { useCampusSession } from '../auth'
import { SKILL_LEVELS } from '../material'
import RequestError from '../components/RequestError'
import GapView from '../components/GapView'
import JobImageImport from '../components/JobImageImport'
import WorkspaceHeading from '../art/WorkspaceHeading'
import { continueWithJob, loadInterviewPrep } from '../import/interviewPrep'
import { materialSaveOperation, saveMaterialOperation } from '../saveOperation'
import useUnsavedWork from '../hooks/useUnsavedWork'
import useMobileWorkspaceView from '../hooks/useMobileWorkspaceView'
import { safeValidationDetails } from '../validation'
import './JobsPage.css'

const PAGE_SIZE = 20
const emptyJob = () => ({ company: '', title: '', description: '', source: '', authorKind: 'student', status: 'draft', availability: { startDate: null, endDate: null, daysPerWeek: null }, requirements: [] })

export default function JobsPage() {
  const { status } = useCampusSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [search] = useSearchParams()
  const fromInterview = search.get('from') === 'interview'
  const screenshotEntry = search.get('entry') === 'screenshot'
  const { isMobile, mobileView, openMobileView } = useMobileWorkspaceView()
  const jobIdParam = search.get('jobId') || ''
  const linkedJobId = /^[a-zA-Z0-9_-]+$/.test(jobIdParam) ? jobIdParam : ''
  const manualEntry = search.get('edit') === 'new'
  const previousEntry = useRef(null)
  const [view, setView] = useState(() => screenshotEntry ? 'screenshot' : linkedJobId || manualEntry ? 'editor' : 'list')
  const [hasOpenedScreenshot, setHasOpenedScreenshot] = useState(view === 'screenshot')
  const [reviewingSource, setReviewingSource] = useState(false)
  const [hasLocalScreenshots, setHasLocalScreenshots] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [listPending, setListPending] = useState(true)
  const [listFailure, setListFailure] = useState(null)
  const [job, setJob] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [gap, setGap] = useState(null)
  const [gapError, setGapError] = useState(null)
  const [suggestion, setSuggestion] = useState(null)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [working, setBusy] = useState(false)
  const [saveUnknown, setSaveUnknown] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [parkedSave, setParkedSave] = useState(null)
  const pendingSave = useRef(null)
  const pendingJobAddress = useRef(null)
  const restoreParked = useRef(false)
  const latestLocation = useRef(location)
  const listHeading = useRef(null)
  const listBoard = useRef(null)
  const screenshotHeading = useRef(null)
  const editorHeading = useRef(null)
  const listReturn = useRef(null)
  const listRequest = useRef(null)
  const sourceReturn = useRef(null)
  const editorForm = useRef(null)
  const pendingInvalidField = useRef(null)
  const leafReturn = useRef(null)
  const leaf = isMobile && view === 'editor' && job && (mobileView !== 'gap' || job.id) ? mobileView : ''
  const busy = working || saveUnknown
  const allowLeave = useUnsavedWork(dirty || saveUnknown)
  const allowScreenshotNavigation = useUnsavedWork(hasLocalScreenshots, location.key)
  const revision = useRef(0)
  const [imageDraftId, setImageDraftId] = useState('')
  const canEdit = job && (!job.id || job.creatorUid === status?.user?.uid)
  const load = useCallback(async (requestedPage) => {
    listRequest.current?.abort()
    const controller = new AbortController()
    listRequest.current = controller
    const { signal } = controller
    setListPending(true); setListFailure(null)
    try {
      const data = await campusData(`/jobs?page=${requestedPage}&limit=${PAGE_SIZE}`, { signal })
      if (!signal.aborted) { setItems(data.items); setTotal(data.total); setPage(requestedPage); setLoaded(true) }
    } catch (err) { if (!signal.aborted) setListFailure({ error: err, page: requestedPage }) }
    finally { if (!signal.aborted) setListPending(false) }
  }, [])
  useEffect(() => {
    load(1)
    return () => listRequest.current?.abort()
  }, [load])
  useLayoutEffect(() => () => {
    previousEntry.current = null
    revision.current += 1
  }, [])
  useLayoutEffect(() => {
    latestLocation.current = location
    return () => { latestLocation.current = null }
  }, [location])

  useLayoutEffect(() => {
    if (view === 'list') {
      const previous = listReturn.current
      if (!previous) return
      const origin = previous.element
      const target = listBoard.current?.contains(origin) && !origin.disabled ? origin : listHeading.current
      target?.focus({ preventScroll: true })
      if (previous.top || window.scrollY) window.scrollTo(0, target === origin ? previous.top : 0)
    } else if (view === 'editor' && !leaf && sourceReturn.current) {
      const { element, top } = sourceReturn.current
      sourceReturn.current = null
      element.focus({ preventScroll: true })
      if (top || window.scrollY) window.scrollTo(0, top)
    } else {
      if (view === 'editor') {
        const pending = pendingInvalidField.current
        if (pending?.leaf === leaf) {
          pendingInvalidField.current = null
          if (pending.field.isConnected) {
            pending.field.focus()
            if (pending.report) pending.field.reportValidity()
            return
          }
        }
        if (!leaf && leafReturn.current) {
          const { element, top } = leafReturn.current
          leafReturn.current = null
          if (element.isConnected && !element.disabled) {
            element.focus({ preventScroll: true })
            if (top || window.scrollY) window.scrollTo(0, top)
            return
          }
        }
      }
      const heading = view === 'screenshot' ? screenshotHeading.current : editorHeading.current
      heading?.focus({ preventScroll: true })
      if (window.scrollY) window.scrollTo(0, 0)
    }
  }, [view, leaf])

  function rememberList(element) {
    listReturn.current = { element, top: window.scrollY }
  }
  const clearEditor = useCallback(() => {
    revision.current += 1
    pendingInvalidField.current = null
    leafReturn.current = null
    pendingSave.current = null
    setSaveUnknown(false)
    setJob(null); setSelectedId(null); setDirty(false); setImageDraftId('')
    setGap(null); setGapError(null); setSuggestion(null); setError(null); setNote('')
  }, [])
  function showList() {
    if (busy || (dirty && !window.confirm('返回岗位列表会放弃未保存的编辑，是否继续？'))) return
    if (dirty) allowLeave()
    if (screenshotEntry || linkedJobId || manualEntry || mobileView) {
      const params = new URLSearchParams(search)
      // Returning within Jobs retains the screenshot workspace and local files.
      allowScreenshotNavigation()
      params.delete('entry')
      params.delete('jobId')
      params.delete('edit')
      params.delete('panel')
      if (location.state?.jobsEditorFromList && !mobileView) {
        navigate(-1)
        return
      }
      navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash }, { replace: true, state: location.state })
      if (!screenshotEntry && !linkedJobId && !manualEntry) {
        clearEditor(); setReviewingSource(false); setView('list')
      }
      return
    }
    if (!listReturn.current) rememberList(null)
    clearEditor(); setReviewingSource(false); setView('list')
  }
  function openLinkedEditor(id) {
    const params = new URLSearchParams(search)
    params.delete('panel')
    if (id) {
      params.set('jobId', id)
      params.delete('edit')
    } else {
      params.delete('jobId')
      params.set('edit', 'new')
    }
    // The screenshot importer remains mounted and retains its local files.
    allowScreenshotNavigation()
    navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash }, { state: { ...location.state, jobsEditorFromList: true } })
  }
  function startManual(element) {
    rememberList(element)
    if (isMobile) { openLinkedEditor(); return }
    clearEditor(); setJob(emptyJob()); setView('editor')
  }
  function startScreenshot(element) {
    rememberList(element)
    if (!isMobile) { setHasOpenedScreenshot(true); setView('screenshot'); return }
    const params = new URLSearchParams(search)
    params.set('entry', 'screenshot')
    params.delete('panel')
    allowScreenshotNavigation()
    navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash }, { state: { ...location.state, jobsEditorFromList: true } })
  }
  function chooseImageJob(candidate, draftId) {
    if (busy || (dirty && !window.confirm('用这个岗位替换尚未保存的编辑？截图原件仍保留。'))) return
    sourceReturn.current = null
    clearEditor(); setImageDraftId(draftId)
    setJob({ ...emptyJob(), company: candidate.company || '', title: candidate.title || '', description: candidate.description || '', source: `截图 ${(candidate.sourcePages || []).join('、')}；${[candidate.city, candidate.batch, candidate.deadline].filter(Boolean).join('；')}`, availability: candidate.availability || emptyJob().availability, requirements: candidate.requirements || [] })
    setDirty(true); setNote('已带入岗位草稿。核对原图，保存后才用于面试。'); setReviewingSource(false); setView('editor')
  }
  function change(key, value) { revision.current += 1; setDirty(true); setSuggestion(null); setJob((current) => ({ ...current, [key]: value })) }
  const readGap = useCallback(async (id, version = revision.current, afterSave = false) => {
    setGapError(null)
    try {
      const result = await campusData(`/jobs/${id}/gap`)
      if (version === revision.current) setGap(result)
    } catch (err) {
      if (version === revision.current) setGapError({ error: err, afterSave })
    }
  }, [])
  const open = useCallback(async (id) => {
    const version = ++revision.current
    setSelectedId(id); setView('editor'); setError(null); setBusy(true)
    try {
      const data = await campusData(`/jobs/${id}`)
      if (version !== revision.current) return
      setJob(data)
      await readGap(id, version)
    } catch (err) { if (version === revision.current) setError(err) }
    finally { if (version === revision.current) setBusy(false) }
  }, [readGap])
  useLayoutEffect(() => {
    // Only editor identity changes reload data; panel history retains the mounted draft.
    const previous = previousEntry.current
    if (working) return
    previousEntry.current = { screenshotEntry, linkedJobId, manualEntry, location }
    if (!restoreParked.current && previous?.screenshotEntry === screenshotEntry && previous?.linkedJobId === linkedJobId && previous?.manualEntry === manualEntry) return
    if (!restoreParked.current && view === 'editor' && linkedJobId && !screenshotEntry && linkedJobId === job?.id) return
    if (!previous && !screenshotEntry && !linkedJobId && !manualEntry) return
    sourceReturn.current = null
    if (saveUnknown && pendingSave.current) {
      setParkedSave({ attempt: pendingSave.current, imageDraftId, job, error, location: previous?.location ?? location })
    }
    clearEditor(); setReviewingSource(false)
    listReturn.current ??= view === 'list' ? { element: document.activeElement, top: window.scrollY } : { element: null, top: 0 }
    if (restoreParked.current && parkedSave) {
      restoreParked.current = false
      pendingSave.current = parkedSave.attempt
      setJob(parkedSave.job); setImageDraftId(parkedSave.imageDraftId); setError(parkedSave.error)
      setDirty(true); setSaveUnknown(true); setView('editor'); setParkedSave(null)
    } else if (screenshotEntry) {
      setHasOpenedScreenshot(true); setView('screenshot')
    } else if (linkedJobId) {
      open(linkedJobId)
    } else if (manualEntry) {
      setJob(emptyJob()); setView('editor')
    } else {
      setView('list')
    }
  }, [clearEditor, error, imageDraftId, job, linkedJobId, location, manualEntry, open, parkedSave, saveUnknown, screenshotEntry, view, working])
  useEffect(() => {
    if (pendingJobAddress.current?.key !== location.key || pendingJobAddress.current?.id !== job?.id || !isMobile || view !== 'editor' || linkedJobId || busy || dirty) return
    pendingJobAddress.current = null
    const params = new URLSearchParams(location.search)
    params.delete('edit')
    params.delete('entry')
    params.set('jobId', job.id)
    // Bind the acknowledged save to the URL without remounting the current editor.
    allowScreenshotNavigation()
    navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash }, {
      replace: true,
      state: location.state,
    })
  }, [allowScreenshotNavigation, busy, dirty, isMobile, job?.id, linkedJobId, location, navigate, view])
  async function retryGap() {
    if (busy) return
    setBusy(true)
    try { await readGap(job.id, revision.current, gapError.afterSave) } finally { setBusy(false) }
  }
  async function analyze() {
    if (busy) return
    const version = revision.current
    setBusy(true); setError(null)
    try {
      const data = await campusData('/jobs/analyze', { method: 'POST', body: JSON.stringify({ description: job.description }) })
      if (version === revision.current) setSuggestion(data)
      else setNote('岗位内容已修改，旧分析未应用。请重新分析。')
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  function openLeaf(panel, element) {
    if (element) leafReturn.current = { element, top: window.scrollY }
    // A new job has one history entry until acknowledged, so promoting it
    // cannot leave a second, stale blank draft in Back/Forward history.
    const replace = Boolean(leaf) || !linkedJobId
    openMobileView(panel, { replace, state: { ...location.state, jobsLeafFromEditor: Boolean(linkedJobId && (!leaf || location.state?.jobsLeafFromEditor)) } })
  }
  function closeLeaf() {
    if (location.state?.jobsLeafFromEditor) navigate(-1)
    else openMobileView('', { replace: true, state: location.state })
  }
  function reopenParkedSave() {
    const { pathname, search, hash, state } = parkedSave.location
    restoreParked.current = true
    if (view === 'list') rememberList(null)
    allowScreenshotNavigation()
    navigate({ pathname, search, hash }, { state: { ...state, jobsEditorFromList: view === 'list', jobsLeafFromEditor: false } })
  }
  function revealInvalidField(field, report = true) {
    const disclosure = field.closest('details')
    const destination = disclosure ? 'requirements' : ''
    if (isMobile && destination !== leaf) {
      pendingInvalidField.current = { field, leaf: destination, report }
      if (destination) openLeaf(destination)
      else closeLeaf()
    } else {
      if (disclosure) disclosure.open = true
      field.focus()
      if (report) field.reportValidity()
    }
  }
  function validateEditor() {
    const field = [...editorForm.current.elements].find((control) => control.willValidate && !control.validity.valid)
    if (!field) return true
    revealInvalidField(field)
    return false
  }
  async function save(event, destination = fromInterview ? 'interview' : null) {
    event?.preventDefault()
    if (working || !job || parkedSave) return
    if (!pendingSave.current && !dirty && job.id && destination) {
      setBusy(true); setError(null)
      try { await continueSaved(job, destination, location.key) } finally { setBusy(false) }
      return
    }
    if (!pendingSave.current && (!canEdit || !validateEditor())) return
    setBusy(true); setError(null); setNote('')
    if (!pendingSave.current) {
      const { company, title, description, source, authorKind, availability, requirements, status: publication } = job
      pendingSave.current = { operation: materialSaveOperation('/api/campus/jobs', job.id, { company, title, description, source, authorKind: authorKind === 'teacher' ? 'student' : authorKind, availability, requirements, status: imageDraftId ? 'draft' : publication, ...(job.id ? { expectedUpdatedAt: job.updatedAt } : {}) }), destination }
    }
    const attempt = pendingSave.current
    try {
      const data = await saveMaterialOperation(attempt.operation)
      if (isMobile && !job.id) pendingJobAddress.current = { key: location.key, id: data.id }
      setJob(data); setDirty(false); setSaveUnknown(false); pendingSave.current = null; setNote('岗位已保存。')
      allowLeave()
      if (imageDraftId) {
        try { await campusData(`/jobs/images/${imageDraftId}/saved`, { method: 'POST', body: JSON.stringify({ jobId: data.id }) }) }
        catch (err) { setError(err); setNote('岗位已保存；截图记录尚未标记完成，原图仍保留。') }
      }
      if (attempt.destination && latestLocation.current?.key === location.key) await continueSaved(data, attempt.destination, location.key)
      else { setGap(null); await Promise.all([load(page), readGap(data.id, revision.current, true)]) }
    } catch (err) {
      setError(err); setSaveUnknown(attempt.operation.unknown)
      if (attempt.operation.unknown) setNote('保存结果未知，编辑仍保留。请检查保存结果，不要重复新建岗位。')
      else pendingSave.current = null
    } finally { setBusy(false) }
  }
  async function continueSaved(saved, destination, sourceKey) {
    if (destination === 'interview') { await returnToInterview(saved, sourceKey); return }
    try { navigate(`/resume?jobId=${encodeURIComponent(saved.id)}&jobRevision=${encodeURIComponent(saved.updatedAt)}`) }
    catch (err) { setError(err); setNote('岗位已保存，跳转没有完成。再次继续即可，不会重复新建。') }
  }
  async function returnToInterview(saved, sourceKey) {
    try {
      const prep = loadInterviewPrep(status?.user?.uid) || await campusData('/me/interview-prep')
      await continueWithJob(status?.user?.uid, prep, saved)
      if (latestLocation.current?.key === sourceKey) navigate(`/interview?jobId=${encodeURIComponent(saved.id)}&jobRevision=${encodeURIComponent(saved.updatedAt)}`)
    } catch (err) { setError(err); setNote('岗位已保存，但还没有返回面试。可以再次使用此岗位继续面试，无需重复新建。') }
  }
  async function selectTarget() {
    setBusy(true); setError(null)
    try { const me = await campusData('/me'); await campusData('/me', { method: 'PUT', body: JSON.stringify({ targetJobId: job.id, expectedUpdatedAt: me.student.updatedAt ?? null }) }); setNote('已设为当前方向，简历与面试会读取这个选择。') } catch (err) { setError(err) } finally { setBusy(false) }
  }
  function requirement(index, key, value) { change('requirements', job.requirements.map((row, i) => i === index ? { ...row, [key]: value } : row)) }
  const requirementError = error?.code === 'VALIDATION_FAILED' && safeValidationDetails(error.details).find(({ field }) => /^(requirements|availability)(\.|$)/.test(field))
  function correctRequirements() {
    const [section, key, field] = requirementError.field.split('.')
    const form = editorForm.current
    const target = form.elements.namedItem(section === 'availability' ? `availability.${key || 'endDate'}` : `requirements.${key || 0}.${field || 'name'}`)
    revealInvalidField(target || form.elements.namedItem('requirements.0.name') || form.querySelector('.jobs-requirements input'), false)
  }
  return <section className="jobs-page campus-form">
    <WorkspaceHeading kind="jobs" title="找个方向" description="浏览已录入的岗位，或添加你找到的机会。AI 整理的要求由你确认。" />
    {fromInterview && <p><Link to="/interview">取消录入，回到原来的面试准备单</Link></p>}
    {parkedSave && <div className="campus-panel">
      <p role="status">上一次岗位保存尚未确认。请先恢复保存结果，再保存其他岗位。</p>
      <button className="primary" type="button" disabled={busy || dirty} onClick={reopenParkedSave}>返回待确认的岗位</button>
    </div>}
    <section ref={listBoard} className="jobs-board campus-form" hidden={view !== 'list'} aria-labelledby="jobs-list-heading">
      <div className="jobs-board-bar">
        <h2 id="jobs-list-heading" ref={listHeading} tabIndex={-1}>浏览岗位{loaded ? `（${total}）` : ''}</h2>
        <div className="campus-actions">
          <button className="primary" type="button" onClick={(event) => startManual(event.currentTarget)}>录入一个岗位</button>
          <button type="button" onClick={(event) => startScreenshot(event.currentTarget)}>从岗位截图整理</button>
        </div>
      </div>
      <RequestError error={listFailure?.error} onRetry={() => load(listFailure.page)} />
      {listPending && <p role="status">正在读取岗位…</p>}
      {loaded && !listPending && !listFailure && !items.length && <p className="jobs-empty-state">还没有岗位。上传截图或手动录入一个。</p>}
      {items.length > 0 && <ul className="jobs-rows">{items.map((row) => <li key={row.id}>
        <button className="jobs-row" type="button" disabled={listPending} onClick={(event) => { rememberList(event.currentTarget); if (isMobile) openLinkedEditor(row.id); else open(row.id) }}>
          <span className="jobs-row-main"><strong>{row.title}</strong><span>{row.company}</span></span>
          <span className="jobs-row-status">{row.status === 'draft' ? '自己的草稿' : '已发布'}</span>
          <span className="jobs-row-arrow" aria-hidden="true">→</span>
        </button>
      </li>)}</ul>}
      {loaded && total > PAGE_SIZE && <nav className="jobs-pagination" aria-label="岗位列表分页">
        <button type="button" disabled={listPending || page === 1} onClick={() => load(page - 1)}>上一页</button>
        <span aria-live="polite">第 {page} / {Math.ceil(total / PAGE_SIZE)} 页</span>
        <button type="button" disabled={listPending || page * PAGE_SIZE >= total} onClick={() => load(page + 1)}>下一页</button>
      </nav>}
    </section>
    <section className="jobs-task campus-form" hidden={view !== 'screenshot'} aria-labelledby="jobs-screenshot-heading">
      <div className="jobs-board-bar">
        <h2 id="jobs-screenshot-heading" ref={screenshotHeading} tabIndex={-1}>从岗位截图整理</h2>
        <button type="button" onClick={reviewingSource ? () => { setReviewingSource(false); setView('editor') } : showList}>{reviewingSource ? '返回岗位编辑' : '返回岗位列表'}</button>
      </div>
      {hasOpenedScreenshot && <JobImageImport disabled={busy} onChoose={chooseImageJob} reviewDraftId={reviewingSource ? imageDraftId : ''} onLocalFilesChange={setHasLocalScreenshots} />}
    </section>
    {(view === 'editor' || reviewingSource) && <section className="jobs-task campus-form" hidden={view !== 'editor'} aria-labelledby="jobs-editor-heading">
      <div className="jobs-board-bar">
        <h2 id="jobs-editor-heading" ref={editorHeading} tabIndex={-1}>{leaf === 'requirements' ? '时间与技能要求' : leaf === 'gap' ? '岗位匹配' : job?.id ? job.title : selectedId ? '岗位详情' : '录入岗位'}</h2>
        <button type="button" disabled={leaf ? working : busy} onClick={leaf ? closeLeaf : showList}>{leaf ? '返回岗位详情' : '返回岗位列表'}</button>
      </div>
    <RequestError error={error} onRetry={!job && selectedId ? () => open(selectedId) : undefined} />
    {requirementError && canEdit && <button className="jobs-back" type="button" disabled={busy} onClick={correctRequirements}>修改时间与技能要求</button>}
    {note && <p role="status" className="campus-note">{note}</p>}
    {!job && working && <p role="status">正在读取岗位详情…</p>}
    {saveUnknown && <button className="primary" type="button" disabled={working} onClick={() => save()}>检查保存结果并继续</button>}
    {dirty && <p role="status">岗位有未保存的编辑；继续前会先保存，不会静默使用旧内容。</p>}
    {job && isMobile && <nav className="jobs-leaf-nav" aria-label="岗位详情视图" hidden={Boolean(leaf)}>
      <button type="button" onClick={(event) => openLeaf('requirements', event.currentTarget)}>时间与技能要求（{job.requirements.length} 项技能）</button>
      {job.id && <button type="button" onClick={(event) => openLeaf('gap', event.currentTarget)}>查看岗位匹配</button>}
    </nav>}
    {job && isMobile && canEdit && !saveUnknown && <button type="submit" form="jobs-editor-form" className="primary" disabled={busy || Boolean(parkedSave)}>{fromInterview ? '保存并继续' : '保存岗位'}</button>}
    {imageDraftId && <button className="jobs-back" type="button" hidden={Boolean(leaf)} disabled={busy} onClick={(event) => { sourceReturn.current = { element: event.currentTarget, top: window.scrollY }; setReviewingSource(true); setView('screenshot') }}>核对截图原件</button>}
    {job && <form id="jobs-editor-form" ref={editorForm} className="campus-form" noValidate onSubmit={save} hidden={leaf === 'gap'}><fieldset disabled={!canEdit || busy || Boolean(parkedSave)} className="campus-form campus-fieldset"><legend hidden={Boolean(leaf)}>{canEdit ? '岗位资料' : '岗位详情（仅发布者可编辑）'}</legend>
      <div className="jobs-layout-contents" hidden={Boolean(leaf)}>
      <div className="campus-grid"><label>企业<input required maxLength={150} value={job.company} onChange={(event) => change('company', event.target.value)} /></label><label>岗位<input required maxLength={150} value={job.title} onChange={(event) => change('title', event.target.value)} /></label></div>
      <label>岗位描述<textarea required maxLength={20000} value={job.description} onChange={(event) => change('description', event.target.value)} /></label><label>来源说明<input maxLength={500} value={job.source} onChange={(event) => change('source', event.target.value)} /></label>
      <label>录入身份（不授予权限）<select value={job.authorKind === 'teacher' ? 'student' : job.authorKind} onChange={(event) => change('authorKind', event.target.value)}><option value="student">学生</option><option value="alumni">校友</option></select></label>
      </div>
      <details className="campus-tool jobs-requirements" hidden={isMobile && leaf !== 'requirements'} open={isMobile && leaf === 'requirements' ? true : undefined}>
      <summary hidden={isMobile}>时间与技能要求（{job.requirements.length} 项技能）</summary>
      <h2>时间要求</h2><div className="campus-grid">{[['startDate', '开始日期'], ['endDate', '结束日期']].map(([key, label]) => <label key={key}>{label}<input type="date" name={`availability.${key}`} value={job.availability?.[key] || ''} onChange={(event) => change('availability', { ...job.availability, [key]: event.target.value || null })} /></label>)}</div><label>每周天数<input type="number" name="availability.daysPerWeek" min="1" max="7" value={job.availability?.daysPerWeek ?? ''} onChange={(event) => change('availability', { ...job.availability, daysPerWeek: event.target.value ? Number(event.target.value) : null })} /></label>
      <h2>确认的技能要求</h2>{job.requirements.map((row, index) => <div className="campus-panel" key={index}><label>技能<input name={`requirements.${index}.name`} required maxLength={80} value={row.name} onChange={(event) => requirement(index, 'name', event.target.value)} /></label><label>程度<select name={`requirements.${index}.level`} value={row.level} onChange={(event) => requirement(index, 'level', Number(event.target.value))}>{SKILL_LEVELS.map((label, level) => <option key={label} value={level}>{label}</option>)}</select></label><label className="campus-check"><input name={`requirements.${index}.required`} type="checkbox" checked={row.required} onChange={(event) => requirement(index, 'required', event.target.checked)} />必需技能</label><label>依据原文<input name={`requirements.${index}.evidence`} value={row.evidence} maxLength={1000} onChange={(event) => requirement(index, 'evidence', event.target.value)} /></label><button type="button" onClick={() => change('requirements', job.requirements.filter((_, i) => i !== index))}>移除要求</button></div>)}
      <div className="campus-actions"><button type="button" onClick={() => change('requirements', [...job.requirements, { name: '', level: 1, required: true, evidence: '' }])}>手动添加技能</button><button type="button" disabled={!job.description.trim()} onClick={analyze}>AI 分析岗位要求</button></div>
      </details>
      <div className="jobs-layout-contents" hidden={Boolean(leaf)}>
        {imageDraftId ? <p>截图导入只保存为自己的私有草稿。</p> : <label>发布状态<select value={job.status} onChange={(event) => change('status', event.target.value)}><option value="draft">仅保存为自己的草稿</option><option value="published">发布供其他人查看</option></select></label>}
      </div>
      {!isMobile && canEdit && <button type="submit" className="primary" disabled={Boolean(parkedSave)}>{fromInterview ? '保存并继续' : '保存岗位'}</button>}
    </fieldset>
      {suggestion && <section className="campus-panel" hidden={isMobile && leaf !== 'requirements'}>
        <h3>待确认的 AI 建议</h3>
        <ul>{suggestion.requirements.map((row, index) => <li key={index}><strong>{row.name} · {SKILL_LEVELS[row.level]}</strong><p>{row.evidence || '缺少原文依据，请人工核对'}</p></li>)}</ul>
        <ul>{suggestion.questions.map((question) => <li key={question}>{question}</li>)}</ul>
        <div className="campus-actions">
          <button type="button" disabled={busy} onClick={() => change('requirements', suggestion.requirements)}>确认采用这些要求</button>
          <button type="button" disabled={busy} onClick={() => setSuggestion(null)}>取消建议</button>
        </div>
      </section>}
    </form>}
    {fromInterview && job?.id && <button type="button" hidden={Boolean(leaf)} disabled={busy || dirty || Boolean(parkedSave)} onClick={() => save(null, 'interview')}>使用已保存岗位继续面试</button>}
    {job?.id && <>
      {gapError?.afterSave && isMobile && leaf !== 'gap' && <p role="status">岗位已确认保存；匹配信息刷新失败，当前保存版本仍可继续使用。</p>}
      <div className="jobs-layout-contents" hidden={isMobile && leaf !== 'gap'}>
      <RequestError error={gapError?.error} onRetry={busy ? undefined : retryGap} />
      {gapError?.afterSave && <p role="status">岗位已确认保存；匹配信息刷新失败，当前保存版本仍可继续使用。</p>}
      {leaf === 'gap' && !gap && !gapError && <p role="status">{working ? '正在读取岗位匹配…' : '暂无岗位匹配信息。'}</p>}
      <GapView gap={gap} />
      </div>
      <div className="campus-actions" hidden={leaf === 'requirements'}>
        <div className="jobs-layout-contents" hidden={isMobile && leaf !== 'gap'}>
          <button type="button" disabled={busy || dirty} onClick={selectTarget}>设为当前探索方向</button>
          <Link className="button" to="/profile?view=skills">补充技能自评</Link>
          <Link className="button" to="/profile">补充可实习时间</Link>
        </div>
        <div className="jobs-layout-contents" hidden={Boolean(leaf)}>
        <button type="button" disabled={busy || Boolean(parkedSave)} onClick={() => save(null, 'resume')}>{dirty ? '保存并继续做简历' : '使用此岗位做简历'}</button>
        {!fromInterview && <button type="button" disabled={busy || Boolean(parkedSave)} onClick={() => save(null, 'interview')}>{dirty ? '保存并继续面试' : '使用此岗位练面试'}</button>}
        </div>
      </div>
    </>}
    </section>}
  </section>
}
