import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { campusData, campusFetch, resumeRows } from '../api'
import { materialText } from '../material'
import RequestError from '../components/RequestError'
import JobSelect from '../components/JobSelect'

export default function InterviewPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
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
  async function load() {
    try {
      const [material, documents, listing] = await Promise.all([campusData('/me'), campusFetch('/api/resumes'), campusData('/jobs?limit=50')])
      setMe(material); setResumes(resumeRows(documents))
      const selected = search.get('jobId') || material.student.targetJobId || ''
      let rows = listing.items
      if (selected && !rows.some((row) => row.id === selected)) rows = [...rows, await campusData(`/jobs/${selected}`)]
      setJobs(rows); setJobId(selected); setJobRole(rows.find((row) => row.id === selected)?.title || '')
      setJobsTotal(listing.total)
      setError(null)
    } catch (err) { setError(err) }
  }
  useEffect(() => { load() }, [])
  async function start(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    try {
      const result = await campusFetch('/api/interview/start', { method: 'POST', body: JSON.stringify({ jobRole, industry: '校园职业探索', experienceLevel: me?.profile.studyStage || 'student', questionCount: count, language: 'zh', mode, skipWarmup: true, ...(resumeId ? { resumeId } : { resumeText: text }), ...(jobId ? { jobId } : {}) }) })
      navigate(`/interview/session/${result.data.interviewId}`)
    } catch (err) { setError(err); setBusy(false) }
  }
  return <section className="campus-form"><h1>用真实经历练面试</h1><p>选好简历或填写经历，即可开始。支持打字和录音回答。</p>
    <RequestError error={error} onRetry={!me || jobsTotal === null ? load : undefined} />
    <form onSubmit={start} className="campus-form"><fieldset disabled={busy} className="campus-form campus-fieldset"><legend>这次想练什么</legend>
      <JobSelect jobs={jobs} setJobs={setJobs} total={jobsTotal} loadError={error} value={jobId} disabled={busy} onChange={(id) => { setJobId(id); const job = jobs.find((row) => row.id === id); if (job) setJobRole(job.title) }} />
      <label>岗位或探索方向<input required maxLength={200} value={jobRole} onChange={(event) => setJobRole(event.target.value)} placeholder="例如你正在探索的工作方向" /></label>
      <label>使用哪份已保存简历<select value={resumeId} onChange={(event) => setResumeId(event.target.value)}><option value="">使用下方文字，不选择简历</option>{resumes.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
      {!resumeId && <><button type="button" disabled={!me} onClick={() => setText(materialText(me))}>使用已保存的档案材料</button><label>这次带入的真实经历<textarea maxLength={20000} value={text} onChange={(event) => setText(event.target.value)} placeholder="课程、社团或项目中，你实际做过的事情" /></label></>}
      <label>练习类型<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="mixed">综合练习</option><option value="behavioral">经历与表达</option><option value="technical">专业与技术</option></select></label>
      <label>题数<select value={count} onChange={(event) => setCount(Number(event.target.value))}>{[2, 4, 6, 8].map((value) => <option key={value} value={value}>{value} 题</option>)}</select></label>
      <button className="primary" type="submit">{busy ? '正在准备题目…' : '开始中文面试'}</button>
    </fieldset></form><Link to="/history">查看以前的练习</Link>
  </section>
}
