import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { campusData } from '../api'
import { useCampusSession } from '../auth'
import { SKILL_LEVELS } from '../material'
import RequestError from '../components/RequestError'
import GapView from '../components/GapView'

const emptyJob = () => ({ company: '', title: '', description: '', source: '', authorKind: 'student', status: 'draft', availability: { startDate: null, endDate: null, daysPerWeek: null }, requirements: [] })
export default function JobsPage() {
  const { status } = useCampusSession()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [job, setJob] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [gap, setGap] = useState(null)
  const [suggestion, setSuggestion] = useState(null)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const revision = useRef(0)
  const canEdit = job && (!job.id || job.creatorUid === status?.user?.uid)
  async function load(start = offset) {
    try { const data = await campusData(`/jobs?page=${Math.floor(start / 20) + 1}&limit=20`); setItems(data.items); setTotal(data.total); setOffset(start); setError(null) } catch (err) { setError(err) }
  }
  useEffect(() => { load(0) }, [])
  useEffect(() => () => { revision.current += 1 }, [])
  function change(key, value) { revision.current += 1; setDirty(true); setSuggestion(null); setJob((current) => ({ ...current, [key]: value })) }
  async function open(id) {
    if (dirty && !window.confirm('切换岗位会放弃未保存的编辑，是否继续？')) return
    revision.current += 1
    const version = revision.current
    setGap(null); setSuggestion(null); setError(null); setNote(''); setBusy(true)
    try {
      const data = await campusData(`/jobs/${id}`)
      if (version === revision.current) { setJob(data); setDirty(false) }
      const result = await campusData(`/jobs/${id}/gap`)
      if (version === revision.current) setGap(result)
    } catch (err) { if (version === revision.current) setError(err) } finally { setBusy(false) }
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
  async function save(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(null); setNote('')
    try {
      const { company, title, description, source, authorKind, availability, requirements, status: publication } = job
      const data = await campusData(`/jobs${job.id ? `/${job.id}` : ''}`, { method: job.id ? 'PATCH' : 'POST', body: JSON.stringify({ company, title, description, source, authorKind: authorKind === 'teacher' ? 'student' : authorKind, availability, requirements, status: publication }) })
      const saved = await campusData(`/jobs/${data.id}`)
      setJob(saved); setDirty(false); setNote('岗位已保存并重新读取。'); await load()
      setGap(await campusData(`/jobs/${data.id}/gap`))
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function selectTarget() {
    setBusy(true); setError(null)
    try { await campusData('/me', { method: 'PUT', body: JSON.stringify({ targetJobId: job.id }) }); setNote('已设为当前方向，简历与面试会读取这个选择。') } catch (err) { setError(err) } finally { setBusy(false) }
  }
  function requirement(index, key, value) { change('requirements', job.requirements.map((row, i) => i === index ? { ...row, [key]: value } : row)) }
  return <section className="campus-form"><h1>找个方向</h1><p>浏览真实录入的岗位，也可以记录你找到的机会。AI 只帮助整理要求，确认后才写入岗位。</p>
    <RequestError error={error} onRetry={!job ? () => load() : undefined} />{note && <p role="status" className="campus-note">{note}</p>}
    <button type="button" disabled={busy} onClick={() => { if (dirty && !window.confirm('新建岗位会放弃未保存的编辑，是否继续？')) return; revision.current += 1; setJob(emptyJob()); setDirty(false); setGap(null); setSuggestion(null); setNote('') }}>录入一个岗位</button>
    <div className="campus-grid">{items.map((row) => <button className="campus-job-choice" type="button" key={row.id} disabled={busy} onClick={() => open(row.id)}><strong>{row.title}</strong><span>{row.company} · {row.status === 'draft' ? '自己的草稿' : '已发布'}</span></button>)}</div>
    {!items.length && <p>还没有岗位。可以手工录入已找到的机会；不确定方向时，也可先整理自己的经历。</p>}
    <div className="campus-actions"><button type="button" disabled={busy || offset === 0} onClick={() => load(Math.max(0, offset - 20))}>上一页</button><button type="button" disabled={busy || offset + items.length >= total} onClick={() => load(offset + 20)}>下一页</button></div>
    {job && <form className="campus-form" onSubmit={save}><fieldset disabled={!canEdit || busy} className="campus-form campus-fieldset"><legend>{canEdit ? '岗位资料' : '岗位详情（仅发布者可编辑）'}</legend>
      <div className="campus-grid"><label>企业<input required maxLength={150} value={job.company} onChange={(event) => change('company', event.target.value)} /></label><label>岗位<input required maxLength={150} value={job.title} onChange={(event) => change('title', event.target.value)} /></label></div>
      <label>岗位描述<textarea required maxLength={20000} value={job.description} onChange={(event) => change('description', event.target.value)} /></label><label>来源说明<input maxLength={500} value={job.source} onChange={(event) => change('source', event.target.value)} /></label>
      <label>录入身份（不授予权限）<select value={job.authorKind === 'teacher' ? 'student' : job.authorKind} onChange={(event) => change('authorKind', event.target.value)}><option value="student">学生</option><option value="alumni">校友</option></select></label>
      <h2>时间要求</h2><div className="campus-grid">{[['startDate', '开始日期'], ['endDate', '结束日期']].map(([key, label]) => <label key={key}>{label}<input type="date" value={job.availability?.[key] || ''} onChange={(event) => change('availability', { ...job.availability, [key]: event.target.value || null })} /></label>)}</div><label>每周天数<input type="number" min="1" max="7" value={job.availability?.daysPerWeek ?? ''} onChange={(event) => change('availability', { ...job.availability, daysPerWeek: event.target.value ? Number(event.target.value) : null })} /></label>
      <h2>确认的技能要求</h2>{job.requirements.map((row, index) => <div className="campus-panel" key={index}><label>技能<input required maxLength={80} value={row.name} onChange={(event) => requirement(index, 'name', event.target.value)} /></label><label>程度<select value={row.level} onChange={(event) => requirement(index, 'level', Number(event.target.value))}>{SKILL_LEVELS.map((label, level) => <option key={label} value={level}>{label}</option>)}</select></label><label className="campus-check"><input type="checkbox" checked={row.required} onChange={(event) => requirement(index, 'required', event.target.checked)} />必需技能</label><label>依据原文<input value={row.evidence} maxLength={1000} onChange={(event) => requirement(index, 'evidence', event.target.value)} /></label><button type="button" onClick={() => change('requirements', job.requirements.filter((_, i) => i !== index))}>移除要求</button></div>)}
      <div className="campus-actions"><button type="button" onClick={() => change('requirements', [...job.requirements, { name: '', level: 1, required: true, evidence: '' }])}>手动添加技能</button><button type="button" disabled={!job.description.trim()} onClick={analyze}>AI 分析岗位要求</button></div>
      <label>发布状态<select value={job.status} onChange={(event) => change('status', event.target.value)}><option value="draft">仅保存为自己的草稿</option><option value="published">发布供其他人查看</option></select></label>
      {canEdit && <button type="submit" className="primary">保存岗位</button>}
    </fieldset>
      {suggestion && <section className="campus-panel"><h2>待确认的 AI 建议</h2><ul>{suggestion.requirements.map((row, index) => <li key={index}><strong>{row.name} · {SKILL_LEVELS[row.level]}</strong><p>{row.evidence || '缺少原文依据，请人工核对'}</p></li>)}</ul><ul>{suggestion.questions.map((question) => <li key={question}>{question}</li>)}</ul><div className="campus-actions"><button type="button" onClick={() => change('requirements', suggestion.requirements)}>确认采用这些要求</button><button type="button" onClick={() => setSuggestion(null)}>取消建议</button></div></section>}
    </form>}
    {job?.id && <><GapView gap={gap} /><div className="campus-actions"><button className="primary" type="button" disabled={busy} onClick={selectTarget}>设为当前探索方向</button><Link className="button" to="/profile">补充自评与时间</Link><Link className="button" to={`/resume?jobId=${job.id}`}>带入简历</Link><Link className="button" to={`/interview?jobId=${job.id}`}>带入面试</Link></div></>}
  </section>
}
