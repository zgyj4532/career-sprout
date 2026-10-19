import { useEffect, useState } from 'react'
import { campusData } from '../api'
import RequestError from './RequestError'

export default function SharingControls() {
  const [teachers, setTeachers] = useState([])
  const [grants, setGrants] = useState([])
  const [teacherId, setTeacherId] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  async function load() {
    try {
      const [people, sharing] = await Promise.all([campusData('/teachers'), campusData('/me/sharing')])
      setTeachers(people); setGrants(sharing); setLoaded(true); setError(null)
    } catch (err) { setError(err) }
  }
  useEffect(() => { load() }, [])
  async function change(id, revoke) {
    if (busy) return
    setBusy(true); setError(null)
    try {
      await campusData(`/me/sharing${revoke ? `/${encodeURIComponent(id)}` : ''}`, { method: revoke ? 'DELETE' : 'POST', ...(revoke ? {} : { body: JSON.stringify({ teacherId: id }) }) })
      await load()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <section className="campus-panel"><h2>由谁帮助你荐才</h2>
    <p>授权后，该教师可查看用于岗位匹配的材料与已确认的定向简历。撤回会阻止新的查询和导出，但不能收回已下载的文件。</p>
    <RequestError error={error} onRetry={load} />
    {loaded && !teachers.length && <p>目前没有可选择的正式教师账号。本机体验身份不能代替教师账号。</p>}
    {teachers.length > 0 && <><label>选择教师<select value={teacherId} onChange={(event) => setTeacherId(event.target.value)}><option value="">请选择</option>{teachers.filter((teacher) => !grants.some((grant) => grant.teacherId === teacher.uid)).map((teacher) => <option key={teacher.uid} value={teacher.uid}>{teacher.displayName}</option>)}</select></label><button type="button" disabled={!teacherId || busy} onClick={() => change(teacherId, false)}>明确授权这位教师</button></>}
    <ul>{grants.map((grant) => <li key={grant.teacherId}>{grant.displayName}<button type="button" disabled={busy} onClick={() => change(grant.teacherId, true)}>撤回授权</button></li>)}</ul>
  </section>
}
