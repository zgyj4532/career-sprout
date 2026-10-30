import { useEffect, useState } from 'react'
import { campusData } from '../api'
import RequestError from './RequestError'

export default function ClassMembership() {
  const [token, setToken] = useState('')
  const [invite, setInvite] = useState(null)
  const [classes, setClasses] = useState(null)
  const [guidance, setGuidance] = useState(null)
  const [feedback, setFeedback] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  async function load() {
    try { const [rows, advice] = await Promise.all([campusData('/me/classes'), campusData('/me/guidance')]); setClasses(rows); setGuidance(advice); setError(null) } catch (err) { setError(err) }
  }
  useEffect(() => { load() }, [])
  async function preview(event) {
    event.preventDefault(); setBusy(true); setError(null); setInvite(null)
    try { setInvite(await campusData('/classes/invitation', { method: 'POST', body: JSON.stringify({ token: token.trim() }) })) } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function join() {
    setBusy(true); setError(null)
    try { await campusData('/classes/join', { method: 'POST', body: JSON.stringify({ token: token.trim(), consent: true, consentVersion: invite.consentVersion }) }); setInvite(null); setToken(''); setNote('已加入班级；你可以随时退出。'); await load() } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function leave(id) {
    if (!window.confirm('退出后该班级带来的授权立即撤回，教师不能再读取班级资料；已下载的文件无法收回。其他独立授权和其他班级不受影响。确定退出？')) return
    setBusy(true); setError(null)
    try { await campusData(`/me/classes/${id}`, { method: 'DELETE' }); setNote('已退出班级并撤回该班授权。辅导历史仍属于你。'); await load() } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function saveFeedback(id) {
    setBusy(true); setError(null)
    try { await campusData(`/me/guidance/${id}`, { method: 'PATCH', body: JSON.stringify({ feedback: feedback[id] ?? '' }) }); setNote('反馈已保存。'); await load() } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <section className="campus-form"><h2>我的班级与辅导</h2><RequestError error={error} onRetry={load} />{note && <p role="status">{note}</p>}
    <form className="campus-form" onSubmit={preview}><label>教师给你的班级邀请码<input value={token} onChange={(event) => { setToken(event.target.value); setInvite(null) }} autoComplete="off" /></label><button type="submit" disabled={busy || !token.trim()}>查看邀请</button></form>
    {invite && <div className="campus-panel"><h3>{invite.name}</h3><p>教师：{invite.teacherName}</p><p>加入后，该教师可查看你的显示名、年级、目标岗位、技能自评和证据、项目经历、岗位差距与兴趣，用于班级辅导；也可使用你保存的简历经 AI 处理，按岗位生成、查看并导出定向简历用于荐才。教师决定是否推荐。原始面试、联系方式及其他未说明的个人资料不作为班级档案展示。</p><p>这不是对全部个人数据的授权。退出立即撤回本班授权；其他有效授权不受影响，教师已下载的文件无法收回。辅导历史仍可由你查看。</p><button className="primary" type="button" disabled={busy} onClick={join}>同意以上用途并加入班级</button></div>}
    {classes && (classes.length ? classes.map((row) => <article className="campus-panel" key={row.id}><strong>{row.name}</strong><p>教师：{row.teacherName}</p><button type="button" disabled={busy} onClick={() => leave(row.id)}>退出班级并撤回授权</button></article>) : <p>还没有加入班级。输入教师提供的邀请码查看用途。</p>)}
    <h3>辅导建议与反馈</h3>{guidance && (guidance.length ? guidance.map((row) => <article className="campus-panel" key={row.id}><strong>{row.class?.name || '班级'} · {row.class?.teacherName || '教师'}</strong><p>{row.text}</p><label>我的反馈<textarea maxLength={4000} value={feedback[row.id] ?? row.feedback ?? ''} onChange={(event) => setFeedback((current) => ({ ...current, [row.id]: event.target.value }))} /></label><button type="button" disabled={busy} onClick={() => saveFeedback(row.id)}>保存反馈</button></article>) : <p>暂无辅导建议。</p>)}
  </section>
}
