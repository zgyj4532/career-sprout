import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { campusFetch } from '../api'
import RequestError from './RequestError'
import useUnsavedWork from '../hooks/useUnsavedWork'

const labels = { collegeStudent: '是否在读大学', major: '专业', interest: '兴趣', experience: '经历或想法' }

function ProfileConfirmation({ id }) {
  const [record, setRecord] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [resolutions, setResolutions] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [unknown, setUnknown] = useState(false)
  const lock = useRef(false)
  const frozen = useRef(null)
  const mounted = useRef(true)
  useUnsavedWork(!skipped && record?.status !== 'completed' && (unknown || Boolean(record && JSON.stringify(candidates) !== JSON.stringify(record.candidates || []))))
  function applyConfirmation(data, preserve = false) {
    if (!mounted.current) return
    setRecord(data); setUnknown(false)
    const reviewed = data.frozen?.candidates
    if (!preserve || !record || data.status !== 'unconfirmed') setCandidates(reviewed ? reviewed.map((candidate) => ({ ...(data.candidates || []).find((row) => row.id === candidate.id), ...candidate })) : data.candidates || [])
    frozen.current = data.frozen || null
    setResolutions({})
  }
  async function load(preserve = false) {
    setBusy(true)
    try {
      const data = (await campusFetch(`/api/interview/${id}/profile-confirmation`)).data
      applyConfirmation(data, preserve)
    } catch (err) { if (mounted.current) { setError(err); setUnknown(true) } } finally { if (mounted.current) setBusy(false) }
  }
  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false } }, [id])
  const conflicts = record?.steps?.profile ? [] : candidates.filter((candidate) => ['collegeStudent', 'major'].includes(candidate.kind) && record?.expected?.[candidate.kind] !== null && record?.expected?.[candidate.kind] !== '' && record?.expected?.[candidate.kind] !== undefined && record.expected[candidate.kind] !== candidate.value)
  const locked = busy || unknown || Boolean(record?.frozen)
  async function save(event) {
    event.preventDefault()
    if (lock.current || unknown || !record || conflicts.some((candidate) => !resolutions[candidate.kind])) return
    lock.current = true; setBusy(true); setError(null)
    frozen.current = { candidates: frozen.current?.candidates || candidates.map(({ id: candidateId, value, state }) => ({ id: candidateId, value, ...(state ? { state } : {}) })), expected: record.expected, resolutions }
    try {
      const result = await campusFetch(`/api/interview/${id}/profile-confirmation`, { method: 'POST', body: JSON.stringify(frozen.current) })
      applyConfirmation(result.data, true)
    } catch (err) {
      setError(err)
      await load(true)
    } finally { lock.current = false; if (mounted.current) setBusy(false) }
  }
  if (record?.status === 'completed') return <div className="campus-note" role="status"><p>已保存到个人资料。未生成简历，也未授权教师查看。</p>{record.cachePending && <p>资料已保存，但缓存刷新尚未完成；个人资料可能稍后更新，不要重复添加。</p>}<Link to="/profile">查看个人资料</Link></div>
  if (skipped) return <div className="campus-note"><p>这次没有保存到个人资料。交流记录仍保留在历史档案中。</p><button type="button" onClick={() => setSkipped(false)}>返回资料摘要</button></div>
  return <section className="campus-panel campus-form"><h2>确认这次整理出的个人资料</h2><p>只保留你明确说过的内容。可以修改或移除，未知信息不必补齐。一次确认即可保存，不会生成简历或授权教师。</p>
    <RequestError error={error} />
    {busy && <p role="status">正在读取或保存资料…</p>}
    {unknown && <><p role="alert">保存结果尚不确定，修改仍保留。先恢复保存进度，避免重复添加。</p><button type="button" disabled={busy} onClick={() => load(true)}>恢复资料保存进度</button></>}
    {record?.frozen && <><p role="status">资料保存尚未全部完成。已确认的内容已锁定，继续保存只处理未完成部分。</p><button type="button" disabled={busy} onClick={() => load(true)}>刷新资料保存进度</button></>}
    {record && <form className="campus-form" onSubmit={save}>
      {candidates.map((candidate) => <div className="campus-form" key={candidate.id}>
        <label>{labels[candidate.kind] || '资料'}{candidate.kind === 'collegeStudent' ? <select disabled={locked} value={String(candidate.value)} onChange={(event) => setCandidates((rows) => rows.map((row) => row.id === candidate.id ? { ...row, value: event.target.value === 'true' } : row))}><option value="true">是在读大学生</option><option value="false">不是在读大学生</option></select> : <textarea required disabled={locked} maxLength={candidate.kind === 'experience' ? 4000 : candidate.kind === 'major' ? 100 : 80} value={candidate.value} onChange={(event) => setCandidates((rows) => rows.map((row) => row.id === candidate.id ? { ...row, value: event.target.value } : row))} />}</label>
        {candidate.kind === 'experience' && <label>实际进展<select disabled={locked} value={candidate.state || 'idea'} onChange={(event) => setCandidates((rows) => rows.map((row) => row.id === candidate.id ? { ...row, state: event.target.value } : row))}><option value="idea">还在设想</option><option value="in_progress">正在做</option><option value="completed">已完成</option></select></label>}
        {candidate.source && <details><summary>来自哪段回答</summary><p className="campus-preserve-text">{candidate.source.excerpt}</p></details>}
        <button type="button" disabled={locked} onClick={() => setCandidates((rows) => rows.filter((row) => row.id !== candidate.id))}>移除这项资料</button>
      </div>)}
      {conflicts.map((candidate) => <label key={candidate.kind}>已有{labels[candidate.kind]}：{typeof record.expected[candidate.kind] === 'boolean' ? record.expected[candidate.kind] ? '是在读大学生' : '不是在读大学生' : record.expected[candidate.kind]}。如何处理？<select disabled={busy || unknown} required value={resolutions[candidate.kind] || ''} onChange={(event) => setResolutions((current) => ({ ...current, [candidate.kind]: event.target.value }))}><option value="">请选择，不会自动覆盖</option><option value="keep">保留已有资料</option><option value="replace">使用本次确认内容</option></select></label>)}
      {!candidates.length && <p>没有需要保存的资料。你仍可查看交流总结。</p>}
      <div className="campus-actions"><button className="primary" type="submit" disabled={busy || unknown || !candidates.length || conflicts.some((candidate) => !resolutions[candidate.kind])}>{record.frozen ? '继续保存已确认资料' : '保存到个人资料'}</button><button type="button" disabled={locked} onClick={() => setSkipped(true)}>暂不保存</button></div>
    </form>}
  </section>
}

export default function DiscoveryReport({ item }) {
  const answers = item.answers || []
  const result = item.discovery || {}
  const id = item._id || item.id
  return <section className="campus-report campus-form"><p className="campus-kicker">兴趣交流 · 不评分</p><h1>这次聊到的内容</h1>
    {result.summary ? <p className="campus-preserve-text">{result.summary}</p> : <p>{answers.length ? '本次没有可展示的总结。' : '这次没有保存回答，因此没有生成总结或提取个人资料。'}</p>}
    {result.uncertainties?.length > 0 && <div className="campus-note" role="status"><p>这些内容还不明确，因此没有写成确定的个人资料：</p><ul>{result.uncertainties.map((note, index) => <li key={index}>{note}</li>)}</ul></div>}
    {result.advice?.length > 0 && <div className="campus-panel"><h2>下次可以这样表达</h2><ul>{result.advice.map((advice, index) => <li key={index}>{advice}</li>)}</ul></div>}
    {answers.length > 0 && id && <ProfileConfirmation key={id} id={id} />}
    <details><summary>查看已保存的交流内容</summary>{answers.map((answer) => <article className="campus-turn" key={answer.questionId}><h3>{answer.question}</h3><p className="campus-preserve-text">{answer.transcript}</p></article>)}</details><Link to="/history">回历史档案</Link>
  </section>
}
