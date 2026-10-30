import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { campusData, downloadBlob } from '../api'
import { useCampusSession } from '../auth'
import { SKILL_LEVELS, TIME_LABELS } from '../material'
import RequestError from '../components/RequestError'
import JobSelect from '../components/JobSelect'
import TeacherClasses from '../components/TeacherClasses'
import TeacherCompressionReview from '../components/TeacherCompressionReview'

export default function TeacherPage() {
  const { status, error: sessionError, refresh } = useCampusSession()
  const [jobs, setJobs] = useState([])
  const [jobsTotal, setJobsTotal] = useState(null)
  const [jobId, setJobId] = useState('')
  const [candidates, setCandidates] = useState(null)
  const [results, setResults] = useState({})
  const [selected, setSelected] = useState([])
  const [exportResults, setExportResults] = useState(null)
  const [reviews, setReviews] = useState([])
  const [dirtyReviews, setDirtyReviews] = useState({})
  const [reviewBatch, setReviewBatch] = useState(0)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const generation = useRef(0)
  async function loadJobs() {
    setError(null)
    try { const data = await campusData('/jobs?limit=50'); setJobs(data.items); setJobsTotal(data.total) } catch (err) { setError(err) }
  }
  useEffect(() => {
    if (!status?.user?.isTeacher) return
    loadJobs()
    return () => { generation.current += 1 }
  }, [status?.user?.isTeacher])
  async function generate(id, students, version) {
    for (let index = 0; index < students.length; index += 1) {
      if (version !== generation.current) return
      const student = students[index]
      setProgress(`正在生成 ${index + 1} / ${students.length}：${student.displayName}`)
      try {
        const [result] = await campusData(`/teacher/jobs/${id}/generate`, { method: 'POST', body: JSON.stringify({ studentIds: [student.studentId] }) })
        if (version !== generation.current) return
        setResults((current) => ({ ...current, [student.studentId]: result }))
        if (result.status === 'generated') setSelected((current) => current.length < 20 ? [...current, result.target.id] : current)
      } catch {
        if (version !== generation.current) return
        setResults((current) => ({ ...current, [student.studentId]: { status: 'failed', message: '生成未完成或结果未确认，请重试并检查学生资料。' } }))
      }
    }
    if (version === generation.current) setProgress('')
  }
  async function load(id = jobId) {
    if (Object.values(dirtyReviews).some(Boolean) && !window.confirm('切换或重新匹配会放弃尚未保存的压缩调整，是否继续？')) return
    const version = ++generation.current
    setJobId(id); setCandidates(null); setSelected([]); setResults({}); setExportResults(null); setReviews([]); setDirtyReviews({}); setError(null); setProgress('')
    if (!id) return
    setBusy(true)
    try {
      const data = await campusData(`/teacher/jobs/${id}/candidates`)
      if (version !== generation.current) return
      setCandidates(data)
      const students = [...data.eligible, ...data.conflict, ...data.unknown].filter((student) => student.classConsent)
      await generate(id, students, version)
    } catch (err) { if (version === generation.current) setError(err) } finally { if (version === generation.current) setBusy(false) }
  }
  async function retry(student) {
    if (busy) return
    setBusy(true); setError(null)
    try { await generate(jobId, [student], generation.current) } finally { setBusy(false) }
  }
  async function download() {
    if (busy || !selected.length) return
    if (Object.values(dirtyReviews).some(Boolean) && !window.confirm('新的批量导出会替换当前压缩调整，是否继续？')) return
    setBusy(true); setError(null)
    const ids = [...selected]
    try {
      const data = await campusData(`/teacher/jobs/${jobId}/export`, { method: 'POST', headers: { 'X-Export-Review': '1' }, body: JSON.stringify({ targetIds: ids }) })
      const bytes = Uint8Array.from(atob(data.archive), (char) => char.charCodeAt(0))
      downloadBlob(new Blob([bytes], { type: 'application/zip' }), '职芽-岗位定向简历.zip')
      setExportResults(data.manifest.map((item, index) => ({ ...item, targetId: ids[index] })))
      setReviews(data.reviews)
      setReviewBatch((current) => current + 1)
      setDirtyReviews({})
      setSelected(ids.filter((id, index) => data.manifest[index]?.status !== 'included'))
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  if (!status?.user?.isTeacher) return <section className="campus-form"><h1>教师荐才</h1><RequestError error={sessionError} onRetry={refresh} /><p>{!status ? '正在确认账号权限…' : '此页面需要已验证邮箱、并由服务端授权的正式教师账号。本机体验和学生自选身份不能取得教师权限。'}</p><Link to="/login?returnTo=/teacher">查看正式账号状态</Link><Link to="/profile">管理自己对教师的授权</Link></section>
  return <section className="campus-form"><h1>教师工作台</h1><TeacherClasses /><section className="campus-form"><h2>为岗位整理候选材料</h2><p>选择岗位后自动匹配并为班级授权学生生成定向稿。技能是自评而非录用概率；时间冲突和未知需你自行核对，推荐由你决定。生成稿可展开查看，学生也能在自己的定向简历中查看和修改。</p>
    <RequestError error={error} onRetry={jobsTotal === null ? loadJobs : () => load()} />
    <JobSelect jobs={jobs} setJobs={setJobs} total={jobsTotal} loadError={error} value={jobId} disabled={busy} label="选择岗位" onChange={load} />
    {jobId && <button type="button" disabled={busy} onClick={() => load()}>重新匹配并生成</button>}{progress && <p role="status">{progress}</p>}
    {candidates && [['eligible', '时间符合要求'], ['conflict', '时间冲突，请核对'], ['unknown', '时间未知，请核对']].map(([key, label]) => <section className="campus-form" key={key}><h3>{label}</h3>{!candidates[key]?.length && <p>暂无候选人。</p>}{(candidates[key] || []).map((student) => {
      const result = results[student.studentId]
      const targets = [...(student.targets || []), ...(result?.target ? [result.target] : [])]
      return <article className="campus-panel" key={student.studentId}><h4>{student.displayName}</h4><p>{TIME_LABELS[student.timeStatus]} · 技能覆盖：{typeof student.coverage === 'number' ? `${Math.round(student.coverage * 100)}%` : '待确认'}</p>
        {[['matchedSkills', '达到要求'], ['missingSkills', '需要提升'], ['unknownSkills', '尚未自评']].map(([field, heading]) => <div key={field}><strong>{heading}</strong><ul>{(student[field] || []).map((skill) => <li key={skill.name}>{skill.name} · 要求 {SKILL_LEVELS[skill.requiredLevel]} / 自评 {skill.currentLevel == null ? '未知' : SKILL_LEVELS[skill.currentLevel]}；{skill.evidence || '证据待补充'}</li>)}</ul></div>)}
        {!student.classConsent && <p>此学生仅有原独立授权，仍需学生确认定向稿且时间符合要求才能导出；该授权未扩大。</p>}
        {result?.status === 'failed' && <p role="status">生成失败：{result.message} <button type="button" disabled={busy} onClick={() => retry(student)}>重试此学生</button></p>}
        {result?.target && <details><summary>查看本次生成的定向稿与变化</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{result.target.draft}</pre><p>变化：{result.target.changes?.join('；') || '未列出'}</p><p>待核对：{result.target.questions?.join('；') || '无'}</p></details>}
        {targets.map((target) => <label className="campus-check" key={target.id}><input type="checkbox" disabled={busy || !(student.classConsent && target.classExportable || student.legacyConsent && key === 'eligible' && target.approved) || (!selected.includes(target.id) && selected.length >= 20)} checked={selected.includes(target.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, target.id] : current.filter((id) => id !== target.id))} />{target.title || '定向简历'} · 版本 {target.revision} · {student.classConsent && target.classExportable ? '班级授权生成稿' : target.approved && student.legacyConsent ? '学生已确认' : '不可导出或版本已变化'}</label>)}
      </article>
    })}</section>)}
    <button className="primary" type="button" disabled={busy || !selected.length} onClick={download}>下载所选定向简历（{selected.length}/20）</button><p>导出时再次检查授权和版本。压缩稿及原稿对照会保存在压缩包，也可在下方调整；下载后无法远程收回。</p>
    {exportResults && <section><h3>导出结果</h3>{exportResults.map((item) => <p key={item.item}>第 {item.item} 项：{item.status === 'included' ? `已导出 ${item.file}${item.review ? '，含压缩对照' : ''}` : `未导出（${item.code || item.status}），可重新选择重试`}</p>)}</section>}
    {reviews.map((review) => <TeacherCompressionReview key={`${reviewBatch}:${review.targetId}:${review.revision}`} jobId={jobId} review={review} onDirtyChange={(id, dirty) => setDirtyReviews((current) => ({ ...current, [id]: dirty }))} />)}
  </section></section>
}
