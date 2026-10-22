import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { campusData } from '../api'
import { useCampusSession } from '../auth'
import { SKILL_LEVELS } from '../material'
import RequestError from '../components/RequestError'
import GapView from '../components/GapView'
import JobImageImport from '../components/JobImageImport'
import { continueWithJob, loadInterviewPrep } from '../import/interviewPrep'
import { materialSaveOperation, saveMaterialOperation } from '../saveOperation'
import useUnsavedWork from '../hooks/useUnsavedWork'

const emptyJob = () => ({ company: '', title: '', description: '', source: '', authorKind: 'student', status: 'draft', availability: { startDate: null, endDate: null, daysPerWeek: null }, requirements: [] })
export default function JobsPage() {
  const { status } = useCampusSession()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const fromInterview = search.get('from') === 'interview'
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [job, setJob] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [gap, setGap] = useState(null)
  const [suggestion, setSuggestion] = useState(null)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [working, setBusy] = useState(false)
  const [saveUnknown, setSaveUnknown] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const pendingSave = useRef(null)
  const busy = working || saveUnknown
  const allowLeave = useUnsavedWork(dirty || saveUnknown)
  const revision = useRef(0)
  const [imageDraftId, setImageDraftId] = useState('')
  const canEdit = job && (!job.id || job.creatorUid === status?.user?.uid)
  async function load(start = offset) {
    try { const data = await campusData(`/jobs?page=${Math.floor(start / 20) + 1}&limit=20`); setItems(data.items); setTotal(data.total); setOffset(start); setLoaded(true); setError(null) } catch (err) { setError(err) }
  }
  useEffect(() => { load(0) }, [])
  useEffect(() => () => { revision.current += 1 }, [])
  function chooseImageJob(candidate, draftId) {
    if (dirty && !window.confirm('用这个岗位替换下方尚未保存的编辑？截图原件仍保留。')) return
    revision.current += 1; setSuggestion(null); setGap(null); setImageDraftId(draftId)
    setJob({ ...emptyJob(), company: candidate.company || '', title: candidate.title || '', description: candidate.description || '', source: `截图 ${(candidate.sourcePages || []).join('、')}；${[candidate.city, candidate.batch, candidate.deadline].filter(Boolean).join('；')}`, availability: candidate.availability || emptyJob().availability, requirements: candidate.requirements || [] })
    setDirty(true); setNote('已带入岗位草稿。核对原图，保存后才用于面试。')
  }
  function change(key, value) { revision.current += 1; setDirty(true); setSuggestion(null); setJob((current) => ({ ...current, [key]: value })) }
  async function open(id) {
    if (dirty && !window.confirm('切换岗位会放弃未保存的编辑，是否继续？')) return
    revision.current += 1
    const version = revision.current
    setGap(null); setSuggestion(null); setError(null); setNote(''); setBusy(true)
    try {
      const data = await campusData(`/jobs/${id}`)
      if (version === revision.current) { setJob(data); setDirty(false); setImageDraftId('') }
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
  async function save(event, destination = fromInterview ? 'interview' : null) {
    event?.preventDefault()
    if (working) return
    if (!pendingSave.current && !dirty && job.id && destination) { await continueSaved(job, destination); return }
    setBusy(true); setError(null); setNote('')
    if (!pendingSave.current) {
      const { company, title, description, source, authorKind, availability, requirements, status: publication } = job
      pendingSave.current = { operation: materialSaveOperation('/api/campus/jobs', job.id, { company, title, description, source, authorKind: authorKind === 'teacher' ? 'student' : authorKind, availability, requirements, status: imageDraftId ? 'draft' : publication, ...(job.id ? { expectedUpdatedAt: job.updatedAt } : {}) }), destination }
    }
    const attempt = pendingSave.current
    try {
      const data = await saveMaterialOperation(attempt.operation)
      setJob(data); setDirty(false); setSaveUnknown(false); pendingSave.current = null; setNote('岗位已保存。')
      allowLeave()
      if (imageDraftId) {
        try { await campusData(`/jobs/images/${imageDraftId}/saved`, { method: 'POST', body: JSON.stringify({ jobId: data.id }) }) }
        catch (err) { setError(err); setNote('岗位已保存；截图记录尚未标记完成，原图仍保留。') }
      }
      if (attempt.destination) await continueSaved(data, attempt.destination)
      else { try { await load(); setGap(await campusData(`/jobs/${data.id}/gap`)) } catch (err) { setError(err); setNote('岗位已确认保存；匹配信息刷新失败，当前保存版本仍可继续使用。') } }
    } catch (err) {
      setError(err); setSaveUnknown(attempt.operation.unknown)
      if (attempt.operation.unknown) setNote('保存结果未知，编辑仍保留。请检查保存结果，不要重复新建岗位。')
      else pendingSave.current = null
    } finally { setBusy(false) }
  }
  async function continueSaved(saved, destination) {
    if (destination === 'interview') { await returnToInterview(saved); return }
    try { navigate(`/resume?jobId=${encodeURIComponent(saved.id)}&jobRevision=${encodeURIComponent(saved.updatedAt)}`) }
    catch (err) { setError(err); setNote('岗位已保存，跳转没有完成。再次继续即可，不会重复新建。') }
  }
  async function returnToInterview(saved = job) {
    try {
      const prep = loadInterviewPrep(status?.user?.uid) || await campusData('/me/interview-prep')
      await continueWithJob(status?.user?.uid, prep, saved)
      navigate(`/interview?jobId=${encodeURIComponent(saved.id)}&jobRevision=${encodeURIComponent(saved.updatedAt)}`)
    } catch (err) { setError(err); setNote('岗位已保存，但还没有返回面试。可以再次点击“使用已保存岗位继续面试”，无需重复新建。') }
  }
  async function selectTarget() {
    setBusy(true); setError(null)
    try { const me = await campusData('/me'); await campusData('/me', { method: 'PUT', body: JSON.stringify({ targetJobId: job.id, expectedUpdatedAt: me.student.updatedAt ?? null }) }); setNote('已设为当前方向，简历与面试会读取这个选择。') } catch (err) { setError(err) } finally { setBusy(false) }
  }
  function requirement(index, key, value) { change('requirements', job.requirements.map((row, i) => i === index ? { ...row, [key]: value } : row)) }
  return <section className="campus-form"><h1>找个方向</h1><p>浏览真实录入的岗位，也可以记录你找到的机会。AI 只帮助整理要求，确认后才写入岗位。</p>
    <RequestError error={error} onRetry={!job ? () => load() : undefined} />{note && <p role="status" className="campus-note">{note}</p>}
    {saveUnknown && <button className="primary" type="button" disabled={working} onClick={() => save()}>检查保存结果并继续</button>}
    {dirty && <p role="status">岗位有未保存的编辑；继续前会先保存，不会静默使用旧内容。</p>}
    {fromInterview && <p><Link to="/interview">取消录入，回到原来的面试准备单</Link></p>}
    <JobImageImport disabled={busy} onChoose={chooseImageJob} />
    <button type="button" disabled={busy} onClick={() => { if (dirty && !window.confirm('新建岗位会放弃未保存的编辑，是否继续？')) return; revision.current += 1; setJob(emptyJob()); setDirty(false); setGap(null); setSuggestion(null); setImageDraftId(''); setNote('') }}>录入一个岗位</button>
    <details className="campus-tool" open={!job}><summary>浏览岗位（{loaded ? total : '读取中'}）</summary>
    <div className="campus-grid">{items.map((row) => <button className="campus-job-choice" type="button" key={row.id} disabled={busy} onClick={() => open(row.id)}><strong>{row.title}</strong><span>{row.company} · {row.status === 'draft' ? '自己的草稿' : '已发布'}</span></button>)}</div>
    {!loaded && !error && <p role="status">正在读取岗位…</p>}{loaded && !error && !items.length && <p>还没有岗位。可以上传截图，或手工录入已找到的机会。</p>}
    <div className="campus-actions"><button type="button" disabled={busy || offset === 0} onClick={() => load(Math.max(0, offset - 20))}>上一页</button><button type="button" disabled={busy || offset + items.length >= total} onClick={() => load(offset + 20)}>下一页</button></div>
    </details>
    {job && <form className="campus-form" onSubmit={save}><fieldset disabled={!canEdit || busy} className="campus-form campus-fieldset"><legend>{canEdit ? '岗位资料' : '岗位详情（仅发布者可编辑）'}</legend>
      <div className="campus-grid"><label>企业<input required maxLength={150} value={job.company} onChange={(event) => change('company', event.target.value)} /></label><label>岗位<input required maxLength={150} value={job.title} onChange={(event) => change('title', event.target.value)} /></label></div>
      <label>岗位描述<textarea required maxLength={20000} value={job.description} onChange={(event) => change('description', event.target.value)} /></label><label>来源说明<input maxLength={500} value={job.source} onChange={(event) => change('source', event.target.value)} /></label>
      <label>录入身份（不授予权限）<select value={job.authorKind === 'teacher' ? 'student' : job.authorKind} onChange={(event) => change('authorKind', event.target.value)}><option value="student">学生</option><option value="alumni">校友</option></select></label>
      <details className="campus-tool"><summary>时间与技能要求（{job.requirements.length} 项技能）</summary>
      <h2>时间要求</h2><div className="campus-grid">{[['startDate', '开始日期'], ['endDate', '结束日期']].map(([key, label]) => <label key={key}>{label}<input type="date" value={job.availability?.[key] || ''} onChange={(event) => change('availability', { ...job.availability, [key]: event.target.value || null })} /></label>)}</div><label>每周天数<input type="number" min="1" max="7" value={job.availability?.daysPerWeek ?? ''} onChange={(event) => change('availability', { ...job.availability, daysPerWeek: event.target.value ? Number(event.target.value) : null })} /></label>
      <h2>确认的技能要求</h2>{job.requirements.map((row, index) => <div className="campus-panel" key={index}><label>技能<input required maxLength={80} value={row.name} onChange={(event) => requirement(index, 'name', event.target.value)} /></label><label>程度<select value={row.level} onChange={(event) => requirement(index, 'level', Number(event.target.value))}>{SKILL_LEVELS.map((label, level) => <option key={label} value={level}>{label}</option>)}</select></label><label className="campus-check"><input type="checkbox" checked={row.required} onChange={(event) => requirement(index, 'required', event.target.checked)} />必需技能</label><label>依据原文<input value={row.evidence} maxLength={1000} onChange={(event) => requirement(index, 'evidence', event.target.value)} /></label><button type="button" onClick={() => change('requirements', job.requirements.filter((_, i) => i !== index))}>移除要求</button></div>)}
      <div className="campus-actions"><button type="button" onClick={() => change('requirements', [...job.requirements, { name: '', level: 1, required: true, evidence: '' }])}>手动添加技能</button><button type="button" disabled={!job.description.trim()} onClick={analyze}>AI 分析岗位要求</button></div>
      </details>
      {imageDraftId ? <p>截图导入只保存为自己的私有草稿。</p> : <label>发布状态<select value={job.status} onChange={(event) => change('status', event.target.value)}><option value="draft">仅保存为自己的草稿</option><option value="published">发布供其他人查看</option></select></label>}
      {canEdit && <button type="submit" className="primary">{fromInterview ? '保存并继续' : '保存岗位'}</button>}
    </fieldset>
      {suggestion && <section className="campus-panel"><h2>待确认的 AI 建议</h2><ul>{suggestion.requirements.map((row, index) => <li key={index}><strong>{row.name} · {SKILL_LEVELS[row.level]}</strong><p>{row.evidence || '缺少原文依据，请人工核对'}</p></li>)}</ul><ul>{suggestion.questions.map((question) => <li key={question}>{question}</li>)}</ul><div className="campus-actions"><button type="button" onClick={() => change('requirements', suggestion.requirements)}>确认采用这些要求</button><button type="button" onClick={() => setSuggestion(null)}>取消建议</button></div></section>}
    </form>}
    {fromInterview && job?.id && <button type="button" disabled={busy || dirty} onClick={() => returnToInterview()}>使用已保存岗位继续面试</button>}
    {job?.id && <><GapView gap={gap} /><div className="campus-actions"><button type="button" disabled={busy || dirty} onClick={selectTarget}>设为当前探索方向</button><Link className="button" to="/profile">补充自评与时间</Link><button type="button" disabled={busy} onClick={() => save(null, 'resume')}>{dirty ? '保存并继续做简历' : '使用此岗位做简历'}</button>{!fromInterview && <button type="button" disabled={busy} onClick={() => save(null, 'interview')}>{dirty ? '保存并继续面试' : '使用此岗位练面试'}</button>}</div></>}
  </section>
}
