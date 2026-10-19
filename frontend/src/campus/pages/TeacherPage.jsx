import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { campusData, campusFetch, downloadBlob } from '../api'
import { useCampusSession } from '../auth'
import { SKILL_LEVELS, TIME_LABELS } from '../material'
import RequestError from '../components/RequestError'
import JobSelect from '../components/JobSelect'

export default function TeacherPage() {
  const { status, error: sessionError, refresh } = useCampusSession()
  const [jobs, setJobs] = useState([])
  const [jobId, setJobId] = useState('')
  const [candidates, setCandidates] = useState(null)
  const [selected, setSelected] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const generation = useRef(0)
  useEffect(() => {
    if (!status?.user?.isTeacher) return
    campusData('/jobs?limit=50').then((data) => setJobs(data.items)).catch(setError)
    return () => { generation.current += 1 }
  }, [status?.user?.isTeacher])
  async function load(id = jobId) {
    const version = ++generation.current
    setJobId(id); setCandidates(null); setSelected([]); setError(null); setNote('')
    if (!id) return
    setBusy(true)
    try { const data = await campusData(`/teacher/jobs/${id}/candidates`); if (version === generation.current) setCandidates(data) } catch (err) { if (version === generation.current) setError(err) } finally { if (version === generation.current) setBusy(false) }
  }
  async function download() {
    if (busy || !selected.length) return
    setBusy(true); setError(null); setNote('')
    try {
      const blob = await campusFetch(`/api/campus/teacher/jobs/${jobId}/export`, { method: 'POST', body: JSON.stringify({ targetIds: selected }) })
      downloadBlob(blob, '职芽-岗位定向简历.zip')
      setNote('已下载压缩包。请查看其中的结果清单：部分文件可能因撤回授权、版本改变或篇幅限制未能导出；不能把下载成功当作全部成功。')
      setSelected([])
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  if (!status?.user?.isTeacher) return <section className="campus-form"><h1>教师荐才</h1><RequestError error={sessionError} onRetry={refresh} /><p>{!status ? '正在确认账号权限…' : '此页面需要已验证邮箱、并由服务端授权的正式教师账号。本机体验和学生自选身份不能取得教师权限。'}</p><Link to="/login?returnTo=/teacher">查看正式账号状态</Link><Link to="/profile">管理自己对教师的授权</Link></section>
  return <section className="campus-form"><h1>为岗位整理候选材料</h1><p>只展示明确授权给你的学生。匹配依据学生自评，不是 AI 录用概率。时间冲突或待确认的学生单独列出。</p>
    <RequestError error={error} onRetry={() => load()} />{note && <p role="status" className="campus-note">{note}</p>}
    <JobSelect jobs={jobs} setJobs={setJobs} value={jobId} disabled={busy} label="选择岗位" onChange={load} />
    {jobId && <button type="button" disabled={busy} onClick={() => load()}>重新读取授权与版本</button>}
    {busy && <p role="status">正在处理，请稍候…</p>}
    {candidates && [['eligible', '时间符合要求'], ['conflict', '时间冲突'], ['unknown', '资料待确认']].map(([key, label]) => <section className="campus-form" key={key}><h2>{label}</h2>{!candidates[key]?.length && <p>暂无已授权的候选人。</p>}{(candidates[key] || []).map((student) => <article className="campus-panel" key={student.studentId}><h3>{student.displayName}</h3><p>{TIME_LABELS[student.timeStatus]} · 技能覆盖：{typeof student.coverage === 'number' ? `${Math.round(student.coverage * 100)}%` : '待确认'}</p>
      {[['matchedSkills', '达到要求'], ['missingSkills', '需要提升'], ['unknownSkills', '尚未自评']].map(([field, heading]) => <div key={field}><h4>{heading}</h4><ul>{(student[field] || []).map((skill) => <li key={skill.name}>{skill.name} · 要求 {SKILL_LEVELS[skill.requiredLevel]} / 自评 {skill.currentLevel == null ? '未知' : SKILL_LEVELS[skill.currentLevel]}<p>{skill.evidence || '证据待补充'}</p></li>)}</ul></div>)}
      {!student.targets?.length && <p>学生还没有该岗位的定向版本，请由学生本人生成并确认。</p>}
      {(student.targets || []).map((target) => <label className="campus-check" key={target.id}><input type="checkbox" disabled={busy || key !== 'eligible' || !target.approved || (!selected.includes(target.id) && selected.length >= 20)} checked={selected.includes(target.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, target.id] : current.filter((id) => id !== target.id))} />{target.title || '定向简历'} · 版本 {target.revision} · {target.approved ? '学生已确认' : '学生尚未确认'}</label>)}
    </article>)}</section>)}
    <button className="primary" type="button" disabled={busy || !selected.length} onClick={download}>下载所选定向简历（{selected.length}/20）</button><p>服务器在导出时再次检查授权、时间与确认版本。下载后由你交付企业，不创建公开链接。</p>
  </section>
}
