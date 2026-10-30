import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { campusData, campusFetch } from '../api'
import { EMPTY_STUDENT, EXPERIENCE_KINDS, SKILL_LEVELS, STUDY_STAGES } from '../material'
import RequestError from '../components/RequestError'
import SharingControls from '../components/SharingControls'
import ClassMembership from '../components/ClassMembership'
import SectionPolish from '../components/SectionPolish'
import ImportPanel from '../components/ImportPanel'
import useUnsavedWork from '../hooks/useUnsavedWork'
import { profileFields, studentFields, reconcileProfileFields, sameProfileField, rebaseConfirmedFields } from '../profileSave'

export default function ProfilePage() {
  const [profile, setProfile] = useState({ displayName: '', location: '', bio: '', studyStage: '', skills: [] })
  const [student, setStudent] = useState(EMPTY_STUDENT)
  const [interests, setInterests] = useState('')
  const [skills, setSkills] = useState('')
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [saveUnknown, setSaveUnknown] = useState(false)
  const pendingRecovery = useRef(null)
  const busy = saving || importBusy || saveUnknown
  const [loaded, setLoaded] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [polished, setPolished] = useState(false)
  const baseline = useRef(null)
  const dirty = loaded && savedSnapshot !== JSON.stringify({ profile, student, interests, skills })
  useUnsavedWork(dirty || saveUnknown)
  const educationRows = profile.education ?? student.importedEducation ?? []
  async function load() {
    try {
      const data = await campusData('/me')
      setProfile(data.profile); setStudent({ ...EMPTY_STUDENT, ...data.student })
      baseline.current = { profile: profileFields(data.profile), student: studentFields({ ...EMPTY_STUDENT, ...data.student }) }
      setInterests((data.student.interests || []).join('，')); setSkills((data.profile.skills || []).join('，'))
      setSavedSnapshot(JSON.stringify({ profile: data.profile, student: { ...EMPTY_STUDENT, ...data.student }, interests: (data.student.interests || []).join('，'), skills: (data.profile.skills || []).join('，') }))
      setPolished(false)
      setLoaded(true); setError(null)
    } catch (err) { setError(err) }
  }
  useEffect(() => { load() }, [])
  const setField = (key, value) => setProfile((current) => ({ ...current, [key]: value }))
  const updateExperience = (index, key, value) => setStudent((current) => ({ ...current, experiences: current.experiences.map((row, i) => i === index ? { ...row, [key]: value } : row) }))
  const updateSkill = (index, key, value) => setStudent((current) => ({ ...current, skillAssessments: current.skillAssessments.map((row, i) => i === index ? { ...row, [key]: value } : row) }))
  async function recoverSave() {
    if (saving || importBusy || !pendingRecovery.current) return
    setBusy(true); setError(null)
    try {
      const current = await campusData('/me')
      applyRecovery(current, pendingRecovery.current)
    } catch (err) { setError(err); setNote('保存结果仍未确认。编辑暂时锁定，请恢复连接后检查保存结果；不会重新提交。') }
    finally { setBusy(false) }
  }
  function applyRecovery(current, attempt) {
    const currentProfile = profileFields(current.profile)
    const currentStudent = studentFields({ ...EMPTY_STUDENT, ...current.student })
    setProfile((value) => ({ ...value, updatedAt: current.profile.updatedAt }))
    setStudent((value) => ({ ...value, updatedAt: current.student.updatedAt }))
    baseline.current = {
      profile: rebaseConfirmedFields(baseline.current.profile, attempt.desired.profile, currentProfile),
      student: rebaseConfirmedFields(baseline.current.student, attempt.desired.student, currentStudent),
    }
    const profileDone = sameProfileField(currentProfile, attempt.plan.profile.fields)
    const studentDone = sameProfileField(currentStudent, attempt.plan.student.fields)
    pendingRecovery.current = null; setSaveUnknown(false)
    setNote(profileDone && studentDone ? '服务器已确认两部分内容，当前编辑仍保留；点击保存可同步确认状态，不会重复写入。' : `${profileDone ? '基本档案已确认。' : '基本档案需核对。'}${studentDone ? '成长材料已确认。' : '成长材料需核对。'}当前编辑仍保留，重试只保存未完成部分；冲突会单独询问。`)
  }
  async function save(event) {
    event?.preventDefault()
    if (busy) return
    setBusy(true); setError(null); setNote('')
    const desired = { profile: profileFields(profile, skills), student: studentFields(student, interests) }
    let plan = null
    let wrote = false
    try {
      const canonical = await campusData('/me')
      const current = { profile: profileFields(canonical.profile), student: studentFields({ ...EMPTY_STUDENT, ...canonical.student }) }
      plan = { profile: reconcileProfileFields(baseline.current.profile, desired.profile, current.profile), student: reconcileProfileFields(baseline.current.student, desired.student, current.student) }
      const conflicts = [...plan.profile.conflicts, ...plan.student.conflicts]
      if (conflicts.length && !window.confirm('这些资料已在其他页面修改：' + conflicts.map((key) => ({ displayName: '姓名', location: '所在地', bio: '简介', studyStage: '年级', collegeStudent: '在读情况', skills: '技能标签', education: '教育经历', importedEducation: '教育经历', interests: '兴趣', experiences: '经历与想法', skillAssessments: '技能自评', availability: '可实习时间', targetJobId: '探索方向', otherMaterials: '其他材料' })[key] || '资料').join('、') + '。是否用当前页面的编辑替换这些冲突字段？其他新资料会保留。')) {
        setNote('未覆盖其他页面的新资料，当前编辑仍保留。再次保存时可重新核对。'); return
      }
      let acknowledgedProfile = canonical.profile
      let cachePending = false
      if (plan.profile.changed) {
        wrote = true
        const response = await campusFetch('/api/user-profiles/me', { method: 'PUT', body: JSON.stringify({ ...plan.profile.fields, expectedUpdatedAt: canonical.profile.updatedAt ?? null }) })
        acknowledgedProfile = { ...canonical.profile, ...plan.profile.fields, ...(response.profile || {}) }; cachePending = response.cachePending
        baseline.current.profile = rebaseConfirmedFields(baseline.current.profile, desired.profile, profileFields(acknowledgedProfile))
      }
      let acknowledgedStudent = canonical.student
      if (plan.student.changed) {
        wrote = true
        const data = await campusData('/me', { method: 'PUT', body: JSON.stringify({ ...plan.student.fields, expectedUpdatedAt: canonical.student.updatedAt ?? null }) })
        acknowledgedStudent = data.student
        baseline.current.student = rebaseConfirmedFields(baseline.current.student, desired.student, studentFields(acknowledgedStudent))
      }
      const nextStudent = { ...EMPTY_STUDENT, ...acknowledgedStudent }
      const nextInterests = (nextStudent.interests || []).join('，')
      const nextSkills = (acknowledgedProfile.skills || []).join('，')
      setProfile(acknowledgedProfile); setStudent(nextStudent); setInterests(nextInterests); setSkills(nextSkills)
      baseline.current = { profile: profileFields(acknowledgedProfile), student: studentFields(nextStudent) }
      setSavedSnapshot(JSON.stringify({ profile: acknowledgedProfile, student: nextStudent, interests: nextInterests, skills: nextSkills })); setPolished(false)
      setNote(cachePending ? '档案与成长材料已保存；缓存刷新尚未完成，无需重复添加。' : '档案与成长材料已保存。可以带着这些真实经历做简历。')
    } catch (err) {
      setError(err)
      if (wrote) {
        pendingRecovery.current = { desired, plan }
        setSaveUnknown(true)
        try { applyRecovery(await campusData('/me'), pendingRecovery.current) }
        catch { setNote('保存结果尚未确认，当前编辑已保留并暂时锁定。请检查保存结果后再编辑或保存，不会盲目重复提交。') }
      }
    } finally { setBusy(false) }
  }
  return <section className="campus-form"><h1>个人资料</h1><p>只记录你愿意分享的内容；想法、正在做的事和已完成经历分开保留。</p>
    <RequestError error={error} onRetry={!loaded ? load : saveUnknown ? recoverSave : () => save()} />
    {saveUnknown && <button type="button" className="primary" disabled={saving || importBusy} onClick={recoverSave}>检查档案保存结果</button>}
    {!loaded && !error && <p role="status">正在读取个人资料…</p>}
    <ImportPanel disabled={busy || dirty} onSaved={load} onMutationChange={setImportBusy} />
    {dirty && <p role="status">档案有尚未保存的编辑，请先保存或放弃后再导入，避免覆盖正在写的内容。</p>}
    {note && <p className="campus-note" role="status">{note} <Link to="/resume">去做简历</Link></p>}
    {loaded && <form className="campus-form" onSubmit={save}><fieldset disabled={busy} className="campus-form campus-fieldset">
      <legend>基本档案</legend><div className="campus-grid"><label>姓名<input maxLength={100} value={profile.displayName || ''} onChange={(event) => setField('displayName', event.target.value)} /></label><label>所在地<input maxLength={100} value={profile.location || ''} onChange={(event) => setField('location', event.target.value)} /></label></div>
      <label>年级<select value={profile.studyStage || ''} onChange={(event) => setField('studyStage', event.target.value)}><option value="">暂不填写</option>{STUDY_STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
      <label>大学在读情况<select value={profile.collegeStudentKnown && profile.collegeStudent != null ? String(profile.collegeStudent) : ''} onChange={(event) => setProfile((current) => ({ ...current, collegeStudentKnown: true, collegeStudent: event.target.value === '' ? null : event.target.value === 'true' }))}><option value="">未知或暂不回答</option><option value="true">目前在读大学</option><option value="false">目前不在读大学</option></select></label>
      <label>感兴趣的方向（逗号分隔）<input maxLength={1000} value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="可以写喜欢做的事，不必先确定岗位" /></label>
      <label>简介<textarea maxLength={500} value={profile.bio || ''} onChange={(event) => setField('bio', event.target.value)} /></label>
      <SectionPolish source={profile.bio || ''} maxLength={500} disabled={busy} onAdopt={(value) => { setField('bio', value); setPolished(true) }} />
      {polished && <p role="status">已采纳到输入框，尚未保存。</p>}
      {educationRows.length > 0 && <section><h2>教育经历</h2>{educationRows.map((row, index) => <div className="campus-panel" key={index}>{[['institution', '学校'], ['degree', '学历'], ['field', '专业'], ['dateText', '时间原文'], ['fullText', '教育完整原文']].map(([key, label]) => <label key={key}>{label}<input value={row[key] || ''} onChange={(event) => { const education = educationRows.map((item, i) => { const next = { ...item, ...(i === index ? { [key]: event.target.value } : {}) }; delete next._id; return next }); setStudent((current) => ({ ...current, importedEducation: education })); setField('education', education) }} /></label>)}</div>)}</section>}
      <details><summary>已有技能标签</summary><label>标签不代表熟练程度<input value={skills} onChange={(event) => setSkills(event.target.value)} /></label></details>
      <h2>经历与想法</h2>
      {student.experiences.map((row, index) => <fieldset className="campus-panel" key={row.id}><legend>{row.title || `经历 ${index + 1}`}</legend>
        <div className="campus-grid"><label>名称<input required maxLength={150} value={row.title || ''} onChange={(event) => updateExperience(index, 'title', event.target.value)} /></label><label>进展<select value={row.state || 'completed'} onChange={(event) => updateExperience(index, 'state', event.target.value)}><option value="idea">想法，尚未开始</option><option value="in_progress">正在做</option><option value="completed">已完成</option></select></label><label>类型<select value={row.kind} onChange={(event) => updateExperience(index, 'kind', event.target.value)}>{Object.entries(EXPERIENCE_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        {row.state === 'idea' && <p>这还是设想，不会作为已完成经历或技能证据加入简历。</p>}
        {row.sourceConversationId && <p>来源：已确认的交流回答 <Link to={`/history/${row.sourceConversationId}`}>查看来源</Link></p>}
        {row.fullText?.trim() || ![row.context, row.actions, row.result].some((value) => value?.trim()) && row.fullText !== undefined ? <label>{row.state === 'idea' ? '想法原文' : '完整经历（不会被精简稿替换）'}<textarea maxLength={100000} value={row.fullText || ''} onChange={(event) => updateExperience(index, 'fullText', event.target.value)} /></label> : [['context', '背景或想解决什么'], ['actions', row.state === 'idea' ? '打算尝试什么' : '你实际做了什么'], ['result', !row.state || row.state === 'completed' ? '实际结果或学到什么' : '目前已发生的结果（没有可留空）']].map(([key, label]) => <label key={key}>{label}<textarea maxLength={key === 'actions' ? 3000 : 2000} value={row[key] || ''} onChange={(event) => updateExperience(index, key, event.target.value)} /></label>)}
        <label>时间原文（可保留月份、至今）<input maxLength={80} value={row.dateText || ''} onChange={(event) => updateExperience(index, 'dateText', event.target.value)} /></label>
        {row.state !== 'idea' && <SectionPolish source={row.fullText || [row.context, row.actions, row.result].filter(Boolean).join('\n')} maxLength={3000} disabled={busy} onAdopt={(value) => { setStudent((current) => ({ ...current, experiences: current.experiences.map((item, i) => i === index ? { ...item, fullText: item.fullText || [item.context, item.actions, item.result].filter(Boolean).join('\n'), brief: value, useConcise: true } : item) })); setPolished(true) }} />}
        {row.brief !== undefined && <details><summary>精简稿{row.useConcise ? ' · 简历和面试采用此稿' : ' · 未采用'}</summary><label>可选精简稿（完整经历仍保留）<textarea maxLength={3000} value={row.brief} onChange={(event) => updateExperience(index, 'brief', event.target.value)} /></label><label className="campus-check"><input type="checkbox" checked={Boolean(row.useConcise)} onChange={(event) => updateExperience(index, 'useConcise', event.target.checked)} />在简历与面试中使用精简稿（完整经历仍保留）</label></details>}
        <button type="button" onClick={() => { if (window.confirm('从个人资料移除这条记录？保存后生效，来源交流仍保留。')) setStudent((current) => ({ ...current, experiences: current.experiences.filter((_, i) => i !== index) })) }}>移除这段经历</button></fieldset>)}
      <button type="button" disabled={student.experiences.length >= 30} onClick={() => setStudent((current) => ({ ...current, experiences: [...current.experiences, { id: crypto.randomUUID(), kind: 'course', title: '', context: '', actions: '', result: '' }] }))}>添加课程、社团或项目经历</button>
      <details className="campus-tool"><summary>技能自评与证据（{student.skillAssessments.length} 项）</summary><p>没填写的技能保持“未知”，不会当作零分。</p>
      {student.skillAssessments.map((row, index) => <div className="campus-panel" key={index}><label>技能名称<input required maxLength={80} value={row.name} onChange={(event) => updateSkill(index, 'name', event.target.value)} /></label><label>目前程度<select value={row.level ?? ''} onChange={(event) => updateSkill(index, 'level', event.target.value === '' ? null : Number(event.target.value))}><option value="">未自评</option>{SKILL_LEVELS.map((label, level) => <option key={label} value={level}>{label}</option>)}</select></label><label>实际证据<input maxLength={1000} value={row.evidence || ''} onChange={(event) => updateSkill(index, 'evidence', event.target.value)} /></label><button type="button" onClick={() => setStudent((current) => ({ ...current, skillAssessments: current.skillAssessments.filter((_, i) => i !== index) }))}>移除这项自评</button></div>)}
      <button type="button" disabled={student.skillAssessments.length >= 50} onClick={() => setStudent((current) => ({ ...current, skillAssessments: [...current.skillAssessments, { name: '', level: null, evidence: '' }] }))}>添加一项自评</button>
      </details>
      <label>其他原文材料（奖项、证书、联系方式等）<textarea maxLength={20000} value={student.otherMaterials || profile.otherMaterials || ''} onChange={(event) => { setStudent((current) => ({ ...current, otherMaterials: event.target.value })); setField('otherMaterials', event.target.value) }} /></label>
      <details className="campus-tool"><summary>可实习时间（不确定可留空）</summary><div className="campus-grid">{[['startDate', '最早开始'], ['endDate', '可持续到']].map(([key, label]) => <label key={key}>{label}<input type="date" value={student.availability?.[key] || ''} onChange={(event) => setStudent((current) => ({ ...current, availability: { ...current.availability, [key]: event.target.value || null } }))} /></label>)}</div>
      <label>每周可投入天数<input type="number" min="1" max="7" value={student.availability?.daysPerWeek ?? ''} onChange={(event) => setStudent((current) => ({ ...current, availability: { ...current.availability, daysPerWeek: event.target.value ? Number(event.target.value) : null } }))} /></label>
      </details>
      <button className="primary" type="submit">{busy ? '正在保存…' : '保存档案与成长材料'}</button>
      <button type="button" disabled={!dirty} onClick={() => { if (window.confirm('放弃当前未保存的档案编辑？已导入的原件不会被丢弃。')) load() }}>放弃本次档案编辑</button>
    </fieldset></form>}
    <SharingControls />
    <ClassMembership />
  </section>
}
