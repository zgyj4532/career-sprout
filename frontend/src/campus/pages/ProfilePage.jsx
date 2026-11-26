import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { campusData, campusFetch } from '../api'
import { EMPTY_STUDENT, EXPERIENCE_KINDS, SKILL_LEVELS, STUDY_STAGES } from '../material'
import { ProfileIllustration, ProfileMotif } from '../art/ProfileArt'
import RequestError from '../components/RequestError'
import SharingControls from '../components/SharingControls'
import ClassMembership from '../components/ClassMembership'
import SectionPolish from '../components/SectionPolish'
import ImportPanel from '../components/ImportPanel'
import useMobileWorkspaceView from '../hooks/useMobileWorkspaceView'
import useUnsavedWork from '../hooks/useUnsavedWork'
import { mobileWorkspaceViewDestination, parseMobileWorkspaceView } from '../mobileWorkspaceViews'
import { profileFields, studentFields, reconcileProfileFields, sameProfileField, rebaseConfirmedFields } from '../profileSave'
import { parseProfileView, profileViewDestination, PROFILE_VIEWS } from '../profileViews'
import { safeValidationDetails } from '../validation'

const PROFILE_PANELS = {
  personal: { basics: '基本档案', education: '教育经历', availability: '可实习时间' },
  skills: { tags: '已有技能标签', assessment: '技能自评与证据', other: '其他原文材料' },
  materials: { import: '简历导入与恢复', class: '班级与辅导', sharing: '教师授权' },
}

const experiencePanel = (id) => `experience:${id}`
const experienceTitle = (row, index) => row.title || `经历 ${index + 1}`

function revealField(field, native) {
  for (let parent = field.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true
  }
  field.focus()
  if (native) field.reportValidity()
}

function findServerInvalidField(form, details, submitted, draft, educationRows) {
  if (!form) return null
  const controls = Array.from(form.elements)
  const byName = (name) => controls.find((control) => control.name === name)
  for (const { field, code } of safeValidationDetails(details)) {
    const [root, index, key] = field.split('.')
    // A merged write may contain a newer canonical record; do not focus a different local row.
    if (code === 'unrecognized_keys' || !Object.hasOwn(submitted, root) || !sameProfileField(submitted[root], draft[root])) continue
    let name = field
    if (field === 'availability' && code === 'custom') name = 'availability.endDate'
    else if (root === 'interests' || root === 'skills') name = root
    else if (field === 'skillAssessments' && code === 'custom') {
      const names = new Set()
      const duplicate = draft.skillAssessments.findIndex(({ name: skill }) => {
        if (typeof skill !== 'string') return false
        const normalized = skill.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
        if (names.has(normalized)) return true
        names.add(normalized)
        return false
      })
      if (duplicate >= 0) name = `skillAssessments.${duplicate}.name`
    } else if (root === 'importedEducation' && index && key && sameProfileField(draft.importedEducation, educationRows)) {
      name = `education.${index}.${key}`
    }
    const control = byName(name)
    if (control) return control
  }
  return null
}

export default function ProfilePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const parsedView = parseProfileView(params)
  const view = parsedView ?? 'personal'
  const { isMobile, mobileView, openMobileView } = useMobileWorkspaceView()
  const malformed = parsedView === null || parseMobileWorkspaceView(location.pathname, params) === null
  useEffect(() => {
    if (malformed) navigate(profileViewDestination(location, view, { clearPanel: true }), { replace: true, state: location.state })
  }, [malformed, navigate, location, view])
  const panels = PROFILE_PANELS[view]
  const panel = isMobile ? mobileView : ''
  const panelVisible = (id) => !isMobile || panel === id
  const screen = `${malformed}:${isMobile}:${view}:${panel}`
  const destination = useCallback((category, leaf) => {
    const categoryLocation = profileViewDestination(location, category, { clearPanel: isMobile || Boolean(mobileView) })
    return leaf ? mobileWorkspaceViewDestination(categoryLocation, leaf) : categoryLocation
  }, [location, isMobile, mobileView])
  const showMaterials = view === 'materials'
  const uploadRequest = showMaterials && (panel === 'import' || location.state?.openProfileUpload) ? location.key : undefined
  function keepCurrentView(event) {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) event.preventDefault()
  }
  const heading = useRef(null)
  const previousScreen = useRef(screen)
  const pendingInvalidField = useRef(null)
  const editor = useRef(null)
  useLayoutEffect(() => {
    if (previousScreen.current === screen) return
    previousScreen.current = screen
    if (malformed) return
    const pending = pendingInvalidField.current
    pendingInvalidField.current = null
    const section = pending?.field.closest('[data-profile-panel]')?.dataset
    if (location.state?.revealProfileField && pending?.field.isConnected && section?.profileView === view && (!isMobile || section.profilePanel === panel)) {
      revealField(pending.field, pending.native)
    } else heading.current?.focus()
  }, [screen, malformed, view, panel, isMobile, location.state])

  const [profile, setProfile] = useState({ displayName: '', location: '', bio: '', studyStage: '', skills: [] })
  const [student, setStudent] = useState(EMPTY_STUDENT)
  const [interests, setInterests] = useState('')
  const [skills, setSkills] = useState('')
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importWork, setImportWork] = useState(null)
  const [saveUnknown, setSaveUnknown] = useState(false)
  const pendingRecovery = useRef(null)
  const serverInvalidField = useRef(null)
  const busy = saving || importBusy || saveUnknown
  const [loaded, setLoaded] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [polishedView, setPolishedView] = useState(null)
  const baseline = useRef(null)
  const dirty = loaded && savedSnapshot !== JSON.stringify({ profile, student, interests, skills })
  useUnsavedWork(dirty || saveUnknown)
  const educationRows = profile.education ?? student.importedEducation ?? []
  async function refreshProfile() {
    const data = await campusData('/me')
    setProfile(data.profile); setStudent({ ...EMPTY_STUDENT, ...data.student })
    baseline.current = { profile: profileFields(data.profile), student: studentFields({ ...EMPTY_STUDENT, ...data.student }) }
    setInterests((data.student.interests || []).join('，')); setSkills((data.profile.skills || []).join('，'))
    setSavedSnapshot(JSON.stringify({ profile: data.profile, student: { ...EMPTY_STUDENT, ...data.student }, interests: (data.student.interests || []).join('，'), skills: (data.profile.skills || []).join('，') }))
    setPolishedView(null)
    setLoaded(true); setError(null)
  }
  async function load() {
    try { await refreshProfile() } catch (err) { setError(err) }
  }
  useEffect(() => { load() }, [])
  const setField = (key, value) => setProfile((current) => ({ ...current, [key]: value }))
  const updateExperience = (index, key, value) => setStudent((current) => ({ ...current, experiences: current.experiences.map((row, i) => i === index ? { ...row, [key]: value } : row) }))
  const updateSkill = (index, key, value) => setStudent((current) => ({ ...current, skillAssessments: current.skillAssessments.map((row, i) => i === index ? { ...row, [key]: value } : row) }))
  function addExperience() {
    const id = crypto.randomUUID()
    setStudent((current) => ({ ...current, experiences: [...current.experiences, { id, kind: 'course', title: '', context: '', actions: '', result: '' }] }))
    if (isMobile) openMobileView(experiencePanel(id))
  }
  function removeExperience(index) {
    if (!window.confirm('从个人资料移除这条记录？保存后生效，来源交流仍保留。')) return
    setStudent((current) => ({ ...current, experiences: current.experiences.filter((_, i) => i !== index) }))
    if (isMobile) openMobileView('')
  }
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
  const reveal = useCallback((field, native) => {
    const section = field.closest('[data-profile-panel]')?.dataset
    const category = section?.profileView ?? view
    const leaf = isMobile ? section?.profilePanel : ''
    if (category === view && (!isMobile || leaf === panel)) revealField(field, native)
    else {
      pendingInvalidField.current = { field, native }
      navigate(destination(category, leaf), { state: { revealProfileField: true } })
    }
  }, [isMobile, view, panel, destination, navigate])
  useLayoutEffect(() => {
    const field = serverInvalidField.current
    if (busy || malformed || !field) return
    serverInvalidField.current = null
    if (field.isConnected) reveal(field, false)
  }, [busy, malformed, reveal])
  function submit(event) {
    event?.preventDefault()
    if (busy || malformed || !editor.current) return
    // Native validation cannot focus fields in hidden panels or closed disclosures.
    const field = Array.from(editor.current.elements).find((control) => control.willValidate && !control.validity.valid)
    if (field) reveal(field, true)
    else return save()
  }
  async function save() {
    if (busy) return
    setBusy(true); setError(null); setNote('')
    const desired = { profile: profileFields(profile, skills), student: studentFields(student, interests) }
    let plan = null
    let writeTarget = null
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
        writeTarget = 'profile'
        const response = await campusFetch('/api/user-profiles/me', { method: 'PUT', body: JSON.stringify({ ...plan.profile.fields, expectedUpdatedAt: canonical.profile.updatedAt ?? null }) })
        acknowledgedProfile = { ...canonical.profile, ...plan.profile.fields, ...(response.profile || {}) }; cachePending = response.cachePending
        baseline.current.profile = rebaseConfirmedFields(baseline.current.profile, desired.profile, profileFields(acknowledgedProfile))
      }
      let acknowledgedStudent = canonical.student
      if (plan.student.changed) {
        writeTarget = 'student'
        const data = await campusData('/me', { method: 'PUT', body: JSON.stringify({ ...plan.student.fields, expectedUpdatedAt: canonical.student.updatedAt ?? null }) })
        acknowledgedStudent = data.student
        baseline.current.student = rebaseConfirmedFields(baseline.current.student, desired.student, studentFields(acknowledgedStudent))
      }
      const nextStudent = { ...EMPTY_STUDENT, ...acknowledgedStudent }
      const nextInterests = (nextStudent.interests || []).join('，')
      const nextSkills = (acknowledgedProfile.skills || []).join('，')
      setProfile(acknowledgedProfile); setStudent(nextStudent); setInterests(nextInterests); setSkills(nextSkills)
      baseline.current = { profile: profileFields(acknowledgedProfile), student: studentFields(nextStudent) }
      setSavedSnapshot(JSON.stringify({ profile: acknowledgedProfile, student: nextStudent, interests: nextInterests, skills: nextSkills })); setPolishedView(null)
      setNote(cachePending ? '档案与成长材料已保存；缓存刷新尚未完成，无需重复添加。' : '档案与成长材料已保存。可以带着这些真实经历做简历。')
    } catch (err) {
      setError(err)
      if (writeTarget && err?.code === 'VALIDATION_FAILED') {
        serverInvalidField.current = findServerInvalidField(editor.current, err.details, plan[writeTarget].fields, desired[writeTarget], educationRows)
      } else if (writeTarget) {
        pendingRecovery.current = { desired, plan }
        setSaveUnknown(true)
        try { applyRecovery(await campusData('/me'), pendingRecovery.current) }
        catch { setNote('保存结果尚未确认，当前编辑已保留并暂时锁定。请检查保存结果后再编辑或保存，不会盲目重复提交。') }
      }
    } finally { setBusy(false) }
  }
  const recordIndex = view === 'experiences' && panel ? student.experiences.findIndex((row) => experiencePanel(row.id) === panel) : -1
  const leafTitle = view === 'experiences'
    ? (recordIndex < 0 ? '经历详情' : experienceTitle(student.experiences[recordIndex], recordIndex))
    : panels?.[panel]
  const showActions = !isMobile || Boolean(panel && (view !== 'experiences' || recordIndex >= 0)) || dirty
  const showImportProgress = isMobile ? panel !== 'import' && (importBusy || importWork) : importBusy
  const importDestination = destination('materials', isMobile ? 'import' : undefined)
  return <>
    {malformed && <p role="status">正在打开个人档案…</p>}
    <section className="profile-page campus-form" hidden={malformed}>
    <header className="profile-view-heading">
      {panel && <Link className="profile-mobile-back" to={destination(view)}>返回{PROFILE_VIEWS[view].label}</Link>}
      <div>
        <h1 ref={heading} tabIndex={-1}>{panel ? leafTitle : isMobile ? '了解自己' : PROFILE_VIEWS[view].label}</h1>
        {!isMobile && <p>{PROFILE_VIEWS[view].description}</p>}
      </div>
      {/* Remount only the decorative SVG so the dots replay on view entry, not on edits. */}
      {!isMobile && <ProfileIllustration key={view} view={view} />}
    </header>
    {!panel && <nav className="profile-view-nav" aria-label="档案页面">
      {Object.entries(PROFILE_VIEWS).map(([id, { label }]) => (
        <Link key={id} to={id === view ? location : destination(id)} aria-current={id === view ? 'page' : undefined} onClick={id === view ? keepCurrentView : undefined}>
          <ProfileMotif view={id} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>}
    {isMobile && !panel && panels && <div className="profile-mobile-destinations">
      <nav aria-label={`${PROFILE_VIEWS[view].label}任务`}>
        {Object.entries(panels).map(([id, title]) => <Link className="profile-mobile-row" key={id} to={destination(view, id)}>{title}</Link>)}
      </nav>
      {view === 'personal' && <Link className="campus-workspace-menu-link" to="/workspace-menu" aria-label="工作台菜单">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" focusable="false">
          <rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      </Link>}
    </div>}
    {isMobile && showImportProgress && <p role="status" className="profile-import-progress">
      {importBusy ? '正在导入，完成后可以继续编辑。' : importWork === 'editing' ? '导入结果还没保存。' : '导入还没完成。'}
      <Link className="profile-mobile-inline-link" to={importDestination}>返回简历导入与恢复</Link>
    </p>}
    {isMobile && showMaterials && panel !== 'import' && saveUnknown && <p role="status" className="profile-import-progress">
      档案保存结果尚未确认。<Link className="profile-mobile-inline-link" to={destination('personal', 'basics')}>返回基本档案检查保存结果</Link>
    </p>}
    {/* Keep editors and import mounted so switching views does not reset drafts or requests. */}
    <div className="profile-view-content">
    <section hidden={showMaterials} className="campus-form" aria-label="档案编辑">
    {!isMobile && view === 'personal' && <Link className="profile-import-shortcut" to={destination('materials')} state={{ openProfileUpload: true }}>上传已有简历，导入档案</Link>}
    <RequestError error={error} onRetry={!loaded ? load : saveUnknown ? recoverSave : submit} />
    {saveUnknown && <button type="button" className="primary btn-primary-green" disabled={saving || importBusy} onClick={recoverSave}>检查档案保存结果</button>}
    {!isMobile && showImportProgress && <p role="status">导入处理完成并刷新档案后可继续编辑。<Link to={importDestination}>查看导入进度或重试</Link></p>}
    {dirty && !saving && !saveUnknown && <p role="status">档案有未保存的修改。</p>}
    {note && <p className="campus-note" role="status">{note} <Link to="/resume">去做简历</Link></p>}
    {!loaded && !error && <p role="status">正在读取个人资料…</p>}
    {loaded && <form ref={editor} className="campus-form" noValidate onSubmit={submit}><fieldset disabled={busy} className="campus-form campus-fieldset">
      <div className="campus-form" hidden={view !== 'personal' || (isMobile && !panel)}>
      <div className="campus-form" data-profile-view="personal" data-profile-panel="basics" hidden={!panelVisible('basics')}>
      <section className="profile-section-card"><h2>基本档案</h2><div className="profile-form-grid-2"><label>姓名<input name="displayName" maxLength={100} value={profile.displayName || ''} onChange={(event) => setField('displayName', event.target.value)} /></label><label>所在地<input name="location" maxLength={100} value={profile.location || ''} onChange={(event) => setField('location', event.target.value)} /></label><label>年级<select name="studyStage" value={profile.studyStage || ''} onChange={(event) => setField('studyStage', event.target.value)}><option value="">暂不填写</option>{STUDY_STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label><label>大学在读情况<select name="collegeStudent" value={profile.collegeStudentKnown && profile.collegeStudent != null ? String(profile.collegeStudent) : ''} onChange={(event) => setProfile((current) => ({ ...current, collegeStudentKnown: true, collegeStudent: event.target.value === '' ? null : event.target.value === 'true' }))}><option value="">未知或暂不回答</option><option value="true">目前在读大学</option><option value="false">目前不在读大学</option></select></label></div>
      <label>感兴趣的方向（逗号分隔）<input name="interests" maxLength={1000} value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="可以写喜欢做的事，不必先确定岗位" /></label>
      <label>简介<textarea name="bio" maxLength={500} value={profile.bio || ''} onChange={(event) => setField('bio', event.target.value)} /></label>
      <SectionPolish source={profile.bio || ''} maxLength={500} disabled={busy} onAdopt={(value) => { setField('bio', value); setPolishedView('personal') }} />
      {polishedView === 'personal' && <p role="status">已采纳到输入框，尚未保存。</p>}</section>
      </div>
      <div data-profile-view="personal" data-profile-panel="education" hidden={!panelVisible('education') || (!isMobile && !educationRows.length)}>
      {isMobile && !educationRows.length && <p>暂无教育经历。<Link className="profile-mobile-inline-link" to={destination('materials', 'import')} state={{ openProfileUpload: true }}>从已有简历导入</Link></p>}
      {educationRows.length > 0 && <section className="profile-section-card"><h2>教育经历</h2>{educationRows.map((row, index) => <div className="campus-panel" key={index}>{[['institution', '学校'], ['degree', '学历'], ['field', '专业'], ['dateText', '时间原文'], ['fullText', '教育完整原文']].map(([key, label]) => <label key={key}>{label}<input name={`education.${index}.${key}`} value={row[key] || ''} onChange={(event) => { const education = educationRows.map((item, i) => { const next = { ...item, ...(i === index ? { [key]: event.target.value } : {}) }; delete next._id; return next }); setStudent((current) => ({ ...current, importedEducation: education })); setField('education', education) }} /></label>)}</div>)}</section>}
      </div>
      <div data-profile-view="personal" data-profile-panel="availability" hidden={!panelVisible('availability')}>
      <section className="profile-section-card"><h2>可实习时间</h2>
      <details className="campus-tool profile-accordion-item" open={isMobile || undefined}><summary>可实习时间（不确定可留空）</summary><div className="campus-grid">{[['startDate', '最早开始'], ['endDate', '可持续到']].map(([key, label]) => <label key={key}>{label}<input name={`availability.${key}`} type="date" value={student.availability?.[key] || ''} onChange={(event) => setStudent((current) => ({ ...current, availability: { ...current.availability, [key]: event.target.value || null } }))} /></label>)}</div>
      <label>每周可投入天数<input name="availability.daysPerWeek" type="number" min="1" max="7" value={student.availability?.daysPerWeek ?? ''} onChange={(event) => setStudent((current) => ({ ...current, availability: { ...current.availability, daysPerWeek: event.target.value ? Number(event.target.value) : null } }))} /></label>
      </details>
      </section>
      </div>
      </div>
      <div className="profile-section-card" hidden={view !== 'experiences'}>
      {isMobile && !panel && <>
        {student.experiences.length > 0 ? <nav aria-label="经历记录" className="profile-mobile-destinations">
          {student.experiences.map((row, index) => <Link className="profile-mobile-row" key={row.id} to={destination(view, experiencePanel(row.id))}>{experienceTitle(row, index)}</Link>)}
        </nav> : <p>暂无经历记录。</p>}
      </>}
      {isMobile && panel && recordIndex < 0 && <p role="status">这条经历已移除或不存在。</p>}
      {student.experiences.map((row, index) => <fieldset className="campus-panel" key={row.id} data-profile-view="experiences" data-profile-panel={experiencePanel(row.id)} hidden={!panelVisible(experiencePanel(row.id))}><legend>{experienceTitle(row, index)}</legend>
        <div className="campus-grid"><label>名称<input name={`experiences.${index}.title`} required maxLength={150} value={row.title || ''} onChange={(event) => updateExperience(index, 'title', event.target.value)} /></label><label>进展<select name={`experiences.${index}.state`} value={row.state || 'completed'} onChange={(event) => updateExperience(index, 'state', event.target.value)}><option value="idea">想法，尚未开始</option><option value="in_progress">正在做</option><option value="completed">已完成</option></select></label><label>类型<select name={`experiences.${index}.kind`} value={row.kind} onChange={(event) => updateExperience(index, 'kind', event.target.value)}>{Object.entries(EXPERIENCE_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        {row.state === 'idea' && <p>这还是设想，不会作为已完成经历或技能证据加入简历。</p>}
        {row.sourceConversationId && <p>来源：已确认的交流回答 <Link to={`/history/${row.sourceConversationId}`}>查看来源</Link></p>}
        {row.fullText?.trim() || ![row.context, row.actions, row.result].some((value) => value?.trim()) && row.fullText !== undefined ? <label>{row.state === 'idea' ? '想法原文' : '完整经历（不会被精简稿替换）'}<textarea name={`experiences.${index}.fullText`} maxLength={100000} value={row.fullText || ''} onChange={(event) => updateExperience(index, 'fullText', event.target.value)} /></label> : [['context', '背景或想解决什么'], ['actions', row.state === 'idea' ? '打算尝试什么' : '你实际做了什么'], ['result', !row.state || row.state === 'completed' ? '实际结果或学到什么' : '目前已发生的结果（没有可留空）']].map(([key, label]) => <label key={key}>{label}<textarea name={`experiences.${index}.${key}`} maxLength={key === 'actions' ? 3000 : 2000} value={row[key] || ''} onChange={(event) => updateExperience(index, key, event.target.value)} /></label>)}
        <label>时间原文（可保留月份、至今）<input name={`experiences.${index}.dateText`} maxLength={80} value={row.dateText || ''} onChange={(event) => updateExperience(index, 'dateText', event.target.value)} /></label>
        {row.state !== 'idea' && <SectionPolish source={row.fullText || [row.context, row.actions, row.result].filter(Boolean).join('\n')} maxLength={3000} disabled={busy} onAdopt={(value) => { setStudent((current) => ({ ...current, experiences: current.experiences.map((item) => item.id === row.id ? { ...item, fullText: item.fullText || [item.context, item.actions, item.result].filter(Boolean).join('\n'), brief: value, useConcise: true } : item) })); setPolishedView(experiencePanel(row.id)) }} />}
        {row.brief !== undefined && <details className="profile-accordion-item"><summary>精简稿{row.useConcise ? ' · 简历和面试采用此稿' : ' · 未采用'}</summary><label>可选精简稿（完整经历仍保留）<textarea name={`experiences.${index}.brief`} maxLength={3000} value={row.brief} onChange={(event) => updateExperience(index, 'brief', event.target.value)} /></label><label className="campus-check"><input name={`experiences.${index}.useConcise`} type="checkbox" checked={Boolean(row.useConcise)} onChange={(event) => updateExperience(index, 'useConcise', event.target.checked)} />在简历与面试中使用精简稿（完整经历仍保留）</label></details>}
        {isMobile && polishedView === experiencePanel(row.id) && <p role="status">已采纳到输入框，尚未保存。</p>}
        <button type="button" onClick={() => removeExperience(index)}>移除这段经历</button></fieldset>)}
      {(!isMobile || !panel) && <button className="btn-dashed-add" type="button" disabled={student.experiences.length >= 30} onClick={addExperience}>添加课程、社团或项目经历</button>}
      {!isMobile && polishedView?.startsWith('experience:') && <p role="status">已采纳到输入框，尚未保存。</p>}
      </div>
      <div className="profile-section-card" hidden={view !== 'skills' || (isMobile && !panel)}>
      <details className="profile-accordion-item" data-profile-view="skills" data-profile-panel="tags" hidden={!panelVisible('tags')} open={isMobile || undefined}><summary>已有技能标签</summary><label>标签不代表熟练程度<input name="skills" value={skills} onChange={(event) => setSkills(event.target.value)} /></label></details>
      <details className="campus-tool profile-accordion-item" data-profile-view="skills" data-profile-panel="assessment" hidden={!panelVisible('assessment')} open={isMobile || undefined}><summary>技能自评与证据（{student.skillAssessments.length} 项）</summary><p>没填写的技能保持“未知”，不会当作零分。</p>
      {student.skillAssessments.map((row, index) => <div className="campus-panel" key={index}><label>技能名称<input name={`skillAssessments.${index}.name`} required maxLength={80} value={row.name} onChange={(event) => updateSkill(index, 'name', event.target.value)} /></label><label>目前程度<select name={`skillAssessments.${index}.level`} value={row.level ?? ''} onChange={(event) => updateSkill(index, 'level', event.target.value === '' ? null : Number(event.target.value))}><option value="">未自评</option>{SKILL_LEVELS.map((label, level) => <option key={label} value={level}>{label}</option>)}</select></label><label>实际证据<input name={`skillAssessments.${index}.evidence`} maxLength={1000} value={row.evidence || ''} onChange={(event) => updateSkill(index, 'evidence', event.target.value)} /></label><button type="button" onClick={() => setStudent((current) => ({ ...current, skillAssessments: current.skillAssessments.filter((_, i) => i !== index) }))}>移除这项自评</button></div>)}
      <button className="btn-dashed-add" type="button" disabled={student.skillAssessments.length >= 50} onClick={() => setStudent((current) => ({ ...current, skillAssessments: [...current.skillAssessments, { name: '', level: null, evidence: '' }] }))}>添加一项自评</button>
      </details>
      <div data-profile-view="skills" data-profile-panel="other" hidden={!panelVisible('other')}>
      <label>其他原文材料（奖项、证书、联系方式等）<textarea name="otherMaterials" maxLength={20000} value={student.otherMaterials || profile.otherMaterials || ''} onChange={(event) => { setStudent((current) => ({ ...current, otherMaterials: event.target.value })); setField('otherMaterials', event.target.value) }} /></label>
      </div>
      </div>
      <div className="profile-save-group" hidden={!showActions}>
      <p className="profile-save-scope">一次保存所有栏目的修改。</p>
      <div className="profile-form-actions"><button className="primary btn-primary-green" type="submit">{saving ? '正在保存…' : '保存档案与成长材料'}</button>
      <button className="btn-secondary-outline" type="button" disabled={!dirty} onClick={() => { if (window.confirm('放弃当前未保存的档案编辑？已导入的原件不会被丢弃。')) load() }}>放弃本次档案编辑</button></div>
      </div>
    </fieldset></form>}
    {panel === 'basics' && <Link className="profile-mobile-row" to={importDestination} state={{ openProfileUpload: true }}>上传已有简历，导入档案</Link>}
    </section>
    <section hidden={!showMaterials || (isMobile && !panel && loaded)} className="campus-form" aria-label="导入与授权管理">
      {!loaded && <RequestError error={error} onRetry={load} />}
      {!loaded && !error && <p role="status">正在读取个人资料…</p>}
      {panelVisible('import') && (saveUnknown ? <p role="status">档案保存结果尚未确认。请返回个人档案检查保存结果后再导入。{isMobile && <Link className="profile-mobile-inline-link" to={destination('personal', 'basics')}>返回基本档案</Link>}</p>
        : saving ? <p role="status">正在保存档案，完成后可继续导入。</p>
          : dirty && <p role="status">档案有尚未保存的编辑，请返回个人档案保存或放弃后再导入，避免覆盖正在写的内容。{isMobile && <Link className="profile-mobile-inline-link" to={destination('personal', 'basics')}>返回基本档案</Link>}</p>)}
      <section className="profile-section-card" hidden={!panelVisible('import')}>{!isMobile && <h2>简历导入与恢复</h2>}<ImportPanel profileMode disabled={!loaded || busy || dirty} onSaved={refreshProfile} onMutationChange={setImportBusy} onWorkChange={setImportWork} openRequest={uploadRequest} /></section>
      <div className="profile-section-card" hidden={!panelVisible('class')}><ClassMembership /></div>
      <div className="profile-section-card" hidden={!panelVisible('sharing')}><SharingControls /></div>
    </section>
    </div>
  </section>
  </>
}
