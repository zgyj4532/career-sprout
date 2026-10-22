import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { campusData, campusFetch, resumeRows } from '../api'
import { CORE_NAV } from '../nav'
import Slogan from '../components/Slogan'
import RequestError from '../components/RequestError'

export default function HomePage() {
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const options = { signal: controller.signal }
    Promise.all([campusData('/imports', options), campusFetch('/api/resumes?sort=-lastModified&limit=1', options), campusFetch('/api/interview/history', options)])
      .then(([imports, resumes, history]) => { setProgress({ imports: imports.items || [], resumes: resumeRows(resumes), history: history.data || [] }); setError(null) })
      .catch((err) => { if (!controller.signal.aborted) setError(err) })
    return () => controller.abort()
  }, [reload])
  const unfinished = progress?.history.find((row) => row.status === 'in_progress')
  const unfinishedImport = progress?.imports.find((row) => !['saved', 'restored', 'discarded'].includes(row.status))
  const recentResume = progress?.resumes[0]
  const next = unfinished
    ? { to: `/interview/session/${unfinished.id || unfinished._id}`, action: unfinished.purpose === 'discovery' ? '继续上次交流' : '继续上次面试' }
    : unfinishedImport
      ? { to: `/resume?import=1&importId=${encodeURIComponent(unfinishedImport.id)}`, action: '继续核对上次导入' }
      : recentResume
        ? { to: `/resume?resumeId=${recentResume.id}`, action: `继续整理：${recentResume.title || '已保存的简历'}` }
        : { to: '/resume?import=1', action: '导入简历' }
  return <section className="campus-hero-text">
    <p className="campus-kicker">职芽 · CareerSprout</p>
    <Slogan />
    <p>从已有的材料或感兴趣的事开始，不必先填完整份档案。</p>
    <RequestError error={error} onRetry={() => setReload((value) => value + 1)} />
    {!progress && !error && <p role="status">正在读取你的成长记录…</p>}
    {progress && <>
      <div className="campus-next-step campus-card"><h2>{unfinished || unfinishedImport || recentResume ? '接着上次的进度' : '从这里开始'}</h2><Link className="button primary" to={next.to}>{next.action}</Link><Link className="campus-interest-entry" to="/discovery">没简历也可以给我讲讲你感兴趣的事</Link></div>
    </>}
    <details className="campus-examples"><summary>没有想法？看看怎样描述一次经历</summary><p>示例，不是你的资料：在一次课程小组任务中，我负责整理访谈记录，把重复的问题归类，并向组员说明发现。试着写出你实际做的事，不必添加没有发生的成果。</p></details>
    <nav className="campus-capability-nav" aria-label="可以做的事">
      {CORE_NAV.map(({ to, label }) => <Link key={to} to={to}>{label}</Link>)}
    </nav>
  </section>
}
