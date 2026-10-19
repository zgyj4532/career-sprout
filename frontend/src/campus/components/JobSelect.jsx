import { useState } from 'react'
import { Link } from 'react-router-dom'
import { campusData } from '../api'
import RequestError from './RequestError'

export default function JobSelect({ jobs, setJobs, total, loadError, value, onChange, disabled = false, label = '参考岗位（可不选）' }) {
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
  if (total === null) return <p role="status">{loadError ? '岗位列表未加载成功，请重试。' : '正在读取岗位…'}</p>
  if (!jobs.length) return <div className="campus-form"><p>还没有可选岗位。这里显示已录入的岗位，不会自动搜索招聘网站。</p><Link to="/jd">去录入岗位</Link></div>
  return <div className="campus-form">
    <label>{label}<select disabled={disabled || busy} value={value} onChange={(event) => onChange(event.target.value)}><option value="">暂不选择</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.title}</option>)}</select></label>
    {!finished && page * 50 < total && <button type="button" disabled={disabled || busy} onClick={more}>{busy ? '正在加载…' : '加载更多岗位'}</button>}
    <RequestError error={error} onRetry={more} />
  </div>
}
