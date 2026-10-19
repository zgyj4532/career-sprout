import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { campusData, campusFetch } from '../api'
import { EMPTY_STUDENT, EXPERIENCE_KINDS, SKILL_LEVELS, STUDY_STAGES } from '../material'
import RequestError from '../components/RequestError'
import SharingControls from '../components/SharingControls'

export default function ProfilePage() {
  const [profile, setProfile] = useState({ displayName: '', location: '', bio: '', studyStage: '', skills: [] })
  const [student, setStudent] = useState(EMPTY_STUDENT)
  const [interests, setInterests] = useState('')
  const [skills, setSkills] = useState('')
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  async function load() {
    try {
      const data = await campusData('/me')
      setProfile(data.profile); setStudent({ ...EMPTY_STUDENT, ...data.student })
      setInterests((data.student.interests || []).join('，')); setSkills((data.profile.skills || []).join('，'))
      setLoaded(true); setError(null)
    } catch (err) { setError(err) }
  }
  useEffect(() => { load() }, [])
  const setField = (key, value) => setProfile((current) => ({ ...current, [key]: value }))
  const updateExperience = (index, key, value) => setStudent((current) => ({ ...current, experiences: current.experiences.map((row, i) => i === index ? { ...row, [key]: value } : row) }))
  const updateSkill = (index, key, value) => setStudent((current) => ({ ...current, skillAssessments: current.skillAssessments.map((row, i) => i === index ? { ...row, [key]: value } : row) }))
  async function save(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(null); setNote('')
    let profileSaved = false
    try {
      await campusFetch('/api/user-profiles/me', { method: 'PUT', body: JSON.stringify({ displayName: profile.displayName || '', location: profile.location || '', bio: profile.bio || '', studyStage: profile.studyStage || '', skills: skills.split(/[，,]/).map((item) => item.trim()).filter(Boolean) }) })
      profileSaved = true
      const data = await campusData('/me', { method: 'PUT', body: JSON.stringify({ ...student, interests: interests.split(/[，,]/).map((item) => item.trim()).filter(Boolean) }) })
      setStudent(data.student)
      setNote('档案与成长材料已保存。可以带着这些真实经历做简历。')
    } catch (err) { setError(err); if (profileSaved) setNote('基本档案已保存；成长材料尚未保存，请保留页面并重试。') } finally { setBusy(false) }
  }
  return <section className="campus-form"><h1>了解自己</h1><p>不用一次填完。没做过实习也可以从课程和社团开始。技能是自评，不是考试分数。</p>
    <RequestError error={error} onRetry={!loaded ? load : undefined} />
    {note && <p className="campus-note" role="status">{note} <Link to="/resume">去做简历</Link></p>}
    {loaded && <form className="campus-form" onSubmit={save}><fieldset disabled={busy} className="campus-form campus-fieldset">
      <legend>基本档案</legend><div className="campus-grid"><label>姓名<input maxLength={100} value={profile.displayName || ''} onChange={(event) => setField('displayName', event.target.value)} /></label><label>所在地<input maxLength={100} value={profile.location || ''} onChange={(event) => setField('location', event.target.value)} /></label></div>
      <label>年级<select value={profile.studyStage || ''} onChange={(event) => setField('studyStage', event.target.value)}><option value="">暂不填写</option>{STUDY_STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
      <label>感兴趣的方向（逗号分隔）<input maxLength={1000} value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="可以写喜欢做的事，不必先确定岗位" /></label>
      <label>简介<textarea maxLength={500} value={profile.bio || ''} onChange={(event) => setField('bio', event.target.value)} /></label>
      <details><summary>已有技能标签</summary><label>标签不代表熟练程度<input value={skills} onChange={(event) => setSkills(event.target.value)} /></label></details>
      <h2>留下真实经历</h2>
      {student.experiences.map((row, index) => <fieldset className="campus-panel" key={row.id}><legend>经历 {index + 1}</legend><label>类型<select value={row.kind} onChange={(event) => updateExperience(index, 'kind', event.target.value)}>{Object.entries(EXPERIENCE_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{[['title', '名称'], ['context', '当时要完成什么'], ['actions', '你具体做了什么'], ['result', '实际结果或学到什么（没有数字也可以）']].map(([key, label]) => <label key={key}>{label}{key === 'title' ? <input required maxLength={150} value={row[key]} onChange={(event) => updateExperience(index, key, event.target.value)} /> : <textarea maxLength={key === 'actions' ? 3000 : 2000} value={row[key]} onChange={(event) => updateExperience(index, key, event.target.value)} />}</label>)}<button type="button" onClick={() => setStudent((current) => ({ ...current, experiences: current.experiences.filter((_, i) => i !== index) }))}>移除这段经历</button></fieldset>)}
      <button type="button" disabled={student.experiences.length >= 30} onClick={() => setStudent((current) => ({ ...current, experiences: [...current.experiences, { id: crypto.randomUUID(), kind: 'course', title: '', context: '', actions: '', result: '' }] }))}>添加课程、社团或项目经历</button>
      <h2>技能自评与证据</h2><p>没填写的技能保持“未知”，不会当作零分。证据可以是作业、作品或一次具体行动。</p>
      {student.skillAssessments.map((row, index) => <div className="campus-panel" key={index}><label>技能名称<input required maxLength={80} value={row.name} onChange={(event) => updateSkill(index, 'name', event.target.value)} /></label><label>目前程度<select value={row.level} onChange={(event) => updateSkill(index, 'level', Number(event.target.value))}>{SKILL_LEVELS.map((label, level) => <option key={label} value={level}>{label}</option>)}</select></label><label>实际证据<input maxLength={1000} value={row.evidence} onChange={(event) => updateSkill(index, 'evidence', event.target.value)} /></label><button type="button" onClick={() => setStudent((current) => ({ ...current, skillAssessments: current.skillAssessments.filter((_, i) => i !== index) }))}>移除这项自评</button></div>)}
      <button type="button" disabled={student.skillAssessments.length >= 50} onClick={() => setStudent((current) => ({ ...current, skillAssessments: [...current.skillAssessments, { name: '', level: 0, evidence: '' }] }))}>添加一项自评</button>
      <h2>可实习时间（不确定可留空）</h2><div className="campus-grid">{[['startDate', '最早开始'], ['endDate', '可持续到']].map(([key, label]) => <label key={key}>{label}<input type="date" value={student.availability?.[key] || ''} onChange={(event) => setStudent((current) => ({ ...current, availability: { ...current.availability, [key]: event.target.value || null } }))} /></label>)}</div>
      <label>每周可投入天数<input type="number" min="1" max="7" value={student.availability?.daysPerWeek ?? ''} onChange={(event) => setStudent((current) => ({ ...current, availability: { ...current.availability, daysPerWeek: event.target.value ? Number(event.target.value) : null } }))} /></label>
      <button className="primary" type="submit">{busy ? '正在保存…' : '保存档案与成长材料'}</button>
    </fieldset></form>}
    <SharingControls />
  </section>
}
