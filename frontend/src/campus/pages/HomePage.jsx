import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { campusData, campusFetch, resumeRows } from '../api'
import { CORE_NAV } from '../nav'
import SpotlightCard from '../bits/SpotlightCard'
import Slogan from '../components/Slogan'
import RequestError from '../components/RequestError'

export default function HomePage() {
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const options = { signal: controller.signal }
    Promise.all([campusData('/me', options), campusFetch('/api/resumes', options), campusFetch('/api/interview/history', options)])
      .then(([me, resumes, history]) => { setProgress({ me, resumes: resumeRows(resumes), history: history.data || [] }); setError(null) })
      .catch((err) => { if (!controller.signal.aborted) setError(err) })
    return () => controller.abort()
  }, [reload])
  const student = progress?.me.student
  const steps = [
    { label: '了解自己', done: Boolean(student?.interests?.length || student?.skillAssessments?.length), to: '/profile', action: '从一个兴趣开始' },
    { label: '找个方向', done: Boolean(student?.targetJobId), to: '/jd', action: '探索一个岗位方向' },
    { label: '整理经历', done: Boolean(student?.experiences?.length), to: '/profile', action: '记下一次课程或社团经历' },
    { label: '做简历', done: Boolean(progress?.resumes.length), to: '/resume', action: '把经历整理成简历' },
    { label: '练面试', done: Boolean(progress?.history.some((row) => row.status === 'completed')), to: '/interview', action: '用真实经历练一次面试' },
  ]
  // Existing material lets experienced students go straight to practice; a target is never required.
  const next = progress?.resumes.length ? steps[4] : student?.experiences?.length ? steps[3] : steps[0].done ? steps[2] : steps[0]
  return <section className="campus-hero-text">
    <p className="campus-kicker">职芽 · CareerSprout</p>
    <Slogan />
    <p>不论年级，从你已有的经历开始。没有实习也没关系，课程、社团和一次认真完成的任务都算起点。</p>
    <RequestError error={error} onRetry={() => setReload((value) => value + 1)} />
    {!progress && !error && <p role="status">正在读取你的成长记录…</p>}
    {progress && <>
      <div className="campus-next-step campus-card"><span>现在可以做的一件事</span><h2>{next.action}</h2><Link className="button primary" to={next.to}>开始这一步</Link><p>目标还没想好？先整理自己的经历，不需要编造答案。</p></div>
      <ol className="campus-growth-path">{steps.map((step) => <li key={step.label} data-complete={step.done}><Link to={step.to}>{step.label}</Link><small>{step.done ? '已有记录' : '还可探索'}</small></li>)}</ol>
    </>}
    <details className="campus-examples"><summary>没有想法？看看怎样描述一次经历</summary><p>示例，不是你的资料：在一次课程小组任务中，我负责整理访谈记录，把重复的问题归类，并向组员说明发现。试着写出你实际做的事，不必添加没有发生的成果。</p></details>
    <div className="campus-portal-grid">
      {CORE_NAV.map(({ to, label, copy, Icon }) => <Link className="campus-portal-card-link" key={to} to={to}><SpotlightCard className="campus-portal-card" spotlightColor="rgba(19, 108, 83, 0.08)"><div className="campus-card-icon-box"><Icon /></div><h2 className="campus-card-title">{label}</h2><p className="campus-card-desc">{copy}</p><div className="campus-card-watermark" aria-hidden="true"><Icon /></div></SpotlightCard></Link>)}
    </div>
  </section>
}
