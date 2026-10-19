import { useState } from 'react'
import { campusData } from '../api'
import RequestError from './RequestError'

export default function JobSelect({ jobs, setJobs, value, onChange, disabled = false, label = '参考岗位（可不选）' }) {
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState(null)
  async function more() {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const data = await campusData(`/jobs?page=${page + 1}&limit=50`)
      setJobs((current) => [...current, ...data.items.filter((job) => !current.some((row) => row.id === job.id))])
      setPage((current) => current + 1)
      setFinished((page + 1) * 50 >= data.total)
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <div className="campus-form"><label>{label}<select disabled={disabled || busy} value={value} onChange={(event) => onChange(event.target.value)}><option value="">暂不选择</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.title}</option>)}</select></label><button type="button" disabled={disabled || busy || finished} onClick={more}>{finished ? '岗位已全部列出' : busy ? '正在读取更多岗位…' : '查找更多岗位'}</button><RequestError error={error} onRetry={more} /></div>
}
