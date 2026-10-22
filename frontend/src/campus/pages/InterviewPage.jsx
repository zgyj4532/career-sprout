import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { campusData, campusFetch, resumeRows } from '../api'
import { materialText } from '../material'
import RequestError from '../components/RequestError'
import JobSelect from '../components/JobSelect'
import { useCampusSession } from '../auth'
import { emptyPrep, loadInterviewPrep, saveInterviewPrep, persistInterviewPrep } from '../import/interviewPrep'

export default function InterviewPage() {
  const { status } = useCampusSession()
  return <InterviewPreparation key={status?.user?.uid || 'signed-out'} uid={status?.user?.uid} />
}

function InterviewPreparation({ uid }) {
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const location = useLocation()
  const currentLocation = useRef(location.key)
  useLayoutEffect(() => {
    currentLocation.current = location.key
    return () => { currentLocation.current = null }
  }, [location.key])
  const [resumes, setResumes] = useState([])
  const [jobs, setJobs] = useState([])
  const [jobsTotal, setJobsTotal] = useState(null)
  const [resumeId, setResumeId] = useState('')
  const [jobId, setJobId] = useState(search.get('jobId') || '')
  const [jobRole, setJobRole] = useState('')
  const [text, setText] = useState('')
  const [me, setMe] = useState(null)
  const [mode, setMode] = useState('mixed')
  const [count, setCount] = useState(4)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [manualRole, setManualRole] = useState('')
  const [savedJobTitle, setSavedJobTitle] = useState('')
  const [ready, setReady] = useState(false)
  const [preparedUid, setPreparedUid] = useState('')
  const [prepNote, setPrepNote] = useState('')
  const [recoveryNote, setRecoveryNote] = useState('')
  const saveQueue = useRef(Promise.resolve())
  const loadGeneration = useRef(0)
  const startLock = useRef(false)
  const active = useRef(true)
  const [jobInvalid, setJobInvalid] = useState(false)
  const [sourceInvalid, setSourceInvalid] = useState(false)
  const prep = { jobRole, manualRole, mode, count, resumeId, text, jobId, savedJobTitle }
  function persist(value) {
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => { if (active.current) return persistInterviewPrep(value) })
    return saveQueue.current
  }
  function consumeSelections() {
    if ((!sourceInvalid && (search.has('resumeId') || search.has('resumeRevision'))) || (!jobInvalid && (search.has('jobId') || search.has('jobRevision')))) {
      setSearch((current) => {
        const next = new URLSearchParams(current)
        if (!sourceInvalid) { next.delete('resumeId'); next.delete('resumeRevision') }
        if (!jobInvalid) { next.delete('jobId'); next.delete('jobRevision') }
        return next
      }, { replace: true })
    }
  }
  async function load() {
    const generation = ++loadGeneration.current
    setReady(false); setError(null)
    try {
      const [material, documents, listing, serverPrep] = await Promise.all([campusData('/me'), campusFetch('/api/resumes?sort=-lastModified&limit=100'), campusData('/jobs?limit=50'), campusData('/me/interview-prep')])
      if (generation !== loadGeneration.current) return
      const previousPrep = loadInterviewPrep(uid) || serverPrep
      const restored = previousPrep || emptyPrep()
      const savedResumes = resumeRows(documents).filter((row) => typeof row.originalText === 'string' && row.originalText.trim() && !row.deleting)
      let page = 1
      let hasNextPage = documents.meta?.hasNextPage
      while (!savedResumes.length && hasNextPage) {
        const next = await campusFetch(`/api/resumes?sort=-lastModified&limit=100&page=${++page}`)
        if (generation !== loadGeneration.current) return
        savedResumes.push(...resumeRows(next).filter((row) => typeof row.originalText === 'string' && row.originalText.trim() && !row.deleting))
        hasNextPage = next.meta?.hasNextPage
      }
      const requestedResumeId = search.get('resumeId') || restored.resumeId
      if (requestedResumeId && !savedResumes.some((row) => row.id === requestedResumeId)) {
        try {
          const source = (await campusFetch(`/api/resumes/${requestedResumeId}`)).data
          if (typeof source?.originalText === 'string' && source.originalText.trim() && !source.deleting) savedResumes.push({ ...source, id: source.id || requestedResumeId })
        } catch (err) { if (err.status !== 404) throw err }
      }
      if (generation !== loadGeneration.current) return
      setMe(material); setResumes(savedResumes)
      const selected = search.get('jobId') || restored.jobId || (!previousPrep ? material.student.targetJobId : '') || ''
      let rows = listing.items
      if (selected && !rows.some((row) => row.id === selected)) {
        try { rows = [...rows, await campusData(`/jobs/${selected}`)] } catch (err) { if (err.status !== 404) throw err; setPrepNote('原岗位已不可用，请重新选择；手填方向和经历仍保留。') }
      }
      if (generation !== loadGeneration.current) return
      const selectedJob = rows.find((row) => row.id === selected)
      const staleJob = selectedJob && search.get('jobRevision') && String(selectedJob.updatedAt) !== search.get('jobRevision')
      setJobInvalid(Boolean(selected && (!selectedJob || staleJob)))
      if (staleJob) setPrepNote('岗位版本已变化，请重新选择确认当前岗位；不会自动使用旧版本。')
      setJobs(rows); setJobId(selectedJob ? selected : ''); setJobRole(selectedJob?.title || restored.manualRole || (!selected ? restored.jobRole : '') || '')
      setSavedJobTitle(selectedJob?.title || ''); setManualRole(restored.manualRole || '')
      const requestedResume = search.get('resumeId') || restored.resumeId
      const requestedRevision = search.get('resumeRevision')
      const selectedResume = savedResumes.find((row) => row.id === requestedResume)
      const staleRevision = selectedResume && requestedRevision && String(selectedResume.revision) !== requestedRevision
      const invalid = Boolean(requestedResume && (!selectedResume || staleRevision))
      const recentResume = !previousPrep && !requestedResume && !restored.text ? [...savedResumes].sort((a, b) => new Date(b.lastModified || b.createdAt || 0) - new Date(a.lastModified || a.createdAt || 0))[0] : null
      setSourceInvalid(invalid)
      if (invalid) setRecoveryNote(staleRevision ? '刚保存的简历版本已变化，请明确重新选择当前版本；不会静默使用其他版本。' : '原来选择的简历已不可用，已取消选择。准备单中的文字与练习设置仍保留，请重新选择简历或使用下方文字。')
      else if (recentResume) setRecoveryNote(`已带入最近保存的简历：${recentResume.title}。可以修改选择，不会自动开始。`)
      setResumeId(invalid ? '' : selectedResume?.id || recentResume?.id || ''); setText(restored.text || ''); setMode(restored.mode); setCount(restored.count); setReady(true)
      setPreparedUid(uid)
      setJobsTotal(listing.total)
      setError(null)
    } catch (err) { if (generation === loadGeneration.current) setError(err) }
  }
  useEffect(() => { active.current = true; if (uid) load(); return () => { active.current = false; loadGeneration.current += 1 } }, [uid])
  useEffect(() => {
    if (!ready || !uid || preparedUid !== uid) return undefined
    let current = true
    const origin = location.key
    const mayApply = () => current && active.current && currentLocation.current === origin
    try { saveInterviewPrep(uid, prep); consumeSelections() } catch { setPrepNote('浏览器无法保留本地准备单，请使用“保存准备单”后再离开。') }
    const timer = setTimeout(() => {
      persist(prep).then(() => {
        if (!mayApply()) return
        consumeSelections(); setPrepNote('准备单已保存在当前账号下。')
      }).catch((err) => { if (mayApply()) setError(err) })
    }, 500)
    return () => { current = false; clearTimeout(timer) }
  }, [ready, preparedUid, uid, jobRole, manualRole, mode, count, resumeId, text, jobId, savedJobTitle, sourceInvalid, jobInvalid])
  async function leaveForJob() {
    setBusy(true); setError(null)
    try { saveInterviewPrep(uid, prep); await persist(prep); navigate('/jd?from=interview') } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function start(event) {
    event.preventDefault()
    if (startLock.current || busy || sourceInvalid || jobInvalid) return
    startLock.current = true
    setBusy(true); setError(null)
    try {
      await persist(prep)
      const result = await campusFetch('/api/interview/start', { method: 'POST', body: JSON.stringify({ jobRole, industry: '校园职业探索', experienceLevel: me?.profile.studyStage || 'student', questionCount: count, language: 'zh', mode, skipWarmup: true, ...(resumeId ? { resumeId, resumeRevision: resumes.find((row) => row.id === resumeId)?.revision } : { resumeText: text }), ...(jobId ? { jobId } : {}) }) })
      navigate(`/interview/session/${result.data.interviewId}`)
    } catch (err) { setError(err); setBusy(false) } finally { startLock.current = false }
  }
  return <section className="campus-form"><h1>用真实经历练面试</h1><p>选好简历或填写经历，即可开始。支持打字和录音回答。</p>
    <RequestError error={error} onRetry={!me || jobsTotal === null ? load : undefined} />
    {!ready && !error && <p role="status">正在读取你的材料和准备单…</p>}
    {prepNote && <p role="status">{prepNote}</p>}
    {recoveryNote && <p role="status">{recoveryNote}</p>}
    <div className="campus-actions"><button type="button" disabled={busy || !ready} onClick={leaveForJob}>上传岗位截图，保留这张准备单</button><button type="button" disabled={busy || !ready} onClick={() => persist(prep).then(() => setPrepNote('准备单已保存，可以离开后继续。')).catch(setError)}>保存准备单</button></div>
    <form onSubmit={start} className="campus-form"><fieldset disabled={busy || !ready} className="campus-form campus-fieldset"><legend>这次想练什么</legend>
      <JobSelect jobs={jobs} setJobs={setJobs} total={jobsTotal} loadError={error} value={jobId} disabled={busy} onChange={(id) => { setJobId(id); setJobInvalid(false); const job = jobs.find((row) => row.id === id); setSavedJobTitle(job?.title || ''); setJobRole(job?.title || manualRole) }} />
      {!jobId && <label>岗位或探索方向<input required maxLength={150} value={jobRole} onChange={(event) => { setJobRole(event.target.value); setManualRole(event.target.value); setJobInvalid(false) }} placeholder="例如你正在探索的工作方向" /></label>}
      {savedJobTitle && <p>这次使用已保存岗位：{savedJobTitle}。{manualRole && <span>原来手填的方向：{manualRole}</span>}</p>}
      {jobInvalid && jobId && <button type="button" onClick={() => { setJobInvalid(false); setPrepNote('已明确选择当前岗位版本。') }}>确认使用当前岗位版本</button>}
      <label>使用哪份已保存简历<select value={resumeId} onChange={(event) => { setResumeId(event.target.value); setSourceInvalid(false); setRecoveryNote('') }}><option value="">使用下方文字，不选择简历</option>{resumes.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
      {!resumeId && <><button type="button" disabled={!me} onClick={() => { if (text && !window.confirm('用已保存的档案替换当前准备文字？')) return; setText(materialText(me, { includeIdeas: true })); setSourceInvalid(false) }}>使用已保存的档案材料</button><label>这次带入的真实经历<textarea maxLength={20000} value={text} onChange={(event) => { setText(event.target.value); setSourceInvalid(false) }} placeholder="课程、社团或项目中，你实际做过的事情" /></label>{sourceInvalid && <button type="button" onClick={() => setSourceInvalid(false)}>明确改用当前文字，不使用失效简历</button>}</>}
      <details><summary>练习设置：{mode === 'technical' ? '专业与技术' : mode === 'behavioral' ? '经历与表达' : '综合练习'} · {count}题</summary>
        <label>练习类型<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="mixed">综合练习</option><option value="behavioral">经历与表达</option><option value="technical">专业与技术</option></select></label>
        <label>题数<select value={count} onChange={(event) => setCount(Number(event.target.value))}>{[2, 4, 6, 8].map((value) => <option key={value} value={value}>{value} 题</option>)}</select></label>
      </details>
      <button className="primary" type="submit" disabled={sourceInvalid || jobInvalid || !jobRole.trim()}>{busy ? '正在准备题目…' : '开始中文面试'}</button>
    </fieldset></form><Link to="/history">查看以前的练习</Link>
  </section>
}
