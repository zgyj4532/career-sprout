import { useEffect, useState } from 'react'
import { campusData } from '../api'
import { SKILL_LEVELS } from '../material'
import RequestError from './RequestError'

export default function TeacherClasses() {
  const [classes, setClasses] = useState(null)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState(null)
  const [invitation, setInvitation] = useState(null)
  const [advice, setAdvice] = useState({})
  const [history, setHistory] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function loadClasses() { try { setClasses(await campusData('/teacher/classes')); setError(null) } catch (err) { setError(err) } }
  useEffect(() => { loadClasses() }, [])
  async function open(id) { setError(null); try { setSelected(await campusData(`/teacher/classes/${id}`)); setHistory({}) } catch (err) { setSelected(null); setError(err) } }
  async function create(event) {
    event.preventDefault(); setBusy(true); setError(null)
    try { const row = await campusData('/teacher/classes', { method: 'POST', body: JSON.stringify({ name }) }); setName(''); setInvitation(row); await loadClasses(); await open(row.id) } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function invite() { setBusy(true); setError(null); try { setInvitation({ ...selected, ...await campusData(`/teacher/classes/${selected.id}/invite`, { method: 'POST' }) }) } catch (err) { setError(err) } finally { setBusy(false) } }
  async function revoke() { setBusy(true); setError(null); try { await campusData(`/teacher/classes/${selected.id}/invite`, { method: 'DELETE' }); setInvitation(null) } catch (err) { setError(err) } finally { setBusy(false) } }
  async function loadAdvice(studentId) { try { const rows = await campusData(`/teacher/classes/${selected.id}/students/${encodeURIComponent(studentId)}/guidance`); setHistory((current) => ({ ...current, [studentId]: rows })) } catch (err) { setError(err) } }
  async function saveAdvice(studentId) {
    setBusy(true); setError(null)
    try { await campusData(`/teacher/classes/${selected.id}/students/${encodeURIComponent(studentId)}/guidance`, { method: 'POST', body: JSON.stringify({ text: advice[studentId] || '' }) }); setAdvice((current) => ({ ...current, [studentId]: '' })); await loadAdvice(studentId) } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <section className="campus-form"><h2>班级辅导</h2><p>只展示仍在班级的学生同意共享的资料；技能是学生自评，不是测评结论。</p><RequestError error={error} onRetry={loadClasses} />
    <form className="campus-form" onSubmit={create}><label>新班级名称<input maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} /></label><button type="submit" disabled={busy}>创建班级</button></form>
    {classes && <label>查看班级<select value={selected?.id || ''} onChange={(event) => event.target.value ? open(event.target.value) : setSelected(null)}><option value="">选择班级</option>{classes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
    {selected && <><div className="campus-panel"><h3>{selected.name}</h3><button type="button" disabled={busy} onClick={invite}>生成新邀请码</button> <button type="button" disabled={busy} onClick={revoke}>撤销当前邀请码</button><p>新邀请码有效期 7 天，生成新码会使旧码失效；只发给预期加入的学生。</p>{invitation?.id === selected.id && <label>邀请码（仅此时显示，复制给学生）<textarea readOnly value={invitation.token} /></label>}</div>
      <h3>技能缺口汇总</h3><p>当前班级 {selected.sampleSize} 人；仅统计已设置公开目标岗位且已有自评的缺口，未自评不计为缺口。</p>{selected.gaps.length ? <ul>{selected.gaps.map((gap) => <li key={gap.name}>{gap.name}：{gap.count} 人</li>)}</ul> : <p>暂无可汇总的已知缺口。</p>}
      {!selected.members.length && <p>尚无学生加入。请分享邀请码。</p>}
      {selected.members.map((student) => <article className="campus-panel campus-form" key={student.studentId}><h3>{student.displayName}</h3><p>年级：{student.studyStage || '未填写'} · 目标岗位：{student.target || '未填写'}</p><p>兴趣：{student.interests.join('、') || '未填写'}</p><h4>技能自评与证据</h4>{student.skills.length ? <ul>{student.skills.map((skill, index) => <li key={index}>{skill.name}：{skill.level == null ? '未自评' : SKILL_LEVELS[skill.level]}；{skill.evidence || '证据未填写'}</li>)}</ul> : <p>尚未填写技能自评。</p>}
        <h4>项目经历</h4>{student.experiences.length ? student.experiences.map((item, index) => <div key={index}><strong>{item.title}</strong><p>{item.state === 'idea' ? '想法，尚未开始' : item.state === 'in_progress' ? '进行中' : '已完成或未标注'}</p><p>{[item.context, item.actions, item.result, item.fullText].filter(Boolean).join('；') || '详情未填写'}</p></div>) : <p>尚未填写项目经历。</p>}
        <h4>目标岗位差距</h4>{student.gap ? <p>需提升：{student.gap.missingSkills.map((item) => item.name).join('、') || '暂无已知差距'}；未自评：{student.gap.unknownSkills.map((item) => item.name).join('、') || '无'}</p> : <p>目标岗位未设置或不可用，无法计算。</p>}
        <label>给学生的辅导建议<textarea maxLength={4000} value={advice[student.studentId] || ''} onChange={(event) => setAdvice((current) => ({ ...current, [student.studentId]: event.target.value }))} /></label><button type="button" disabled={busy || !advice[student.studentId]?.trim()} onClick={() => saveAdvice(student.studentId)}>保存建议</button><button type="button" onClick={() => loadAdvice(student.studentId)}>查看建议与学生反馈</button>{history[student.studentId]?.map((row) => <div key={row.id}><p>建议：{row.text}</p><p>学生反馈：{row.feedback || '尚未反馈'}</p></div>)}</article>)}
    </>}
  </section>
}
