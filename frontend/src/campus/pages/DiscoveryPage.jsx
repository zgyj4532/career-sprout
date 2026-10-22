import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { campusFetch } from '../api'
import RequestError from '../components/RequestError'

export default function DiscoveryPage() {
  const navigate = useNavigate()
  const lock = useRef(false)
  const [savedId, setSavedId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  async function start() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(null)
    try {
      let destination = savedId
      if (!destination) {
        const result = await campusFetch('/api/interview/discovery/start', { method: 'POST', body: JSON.stringify({ language: 'zh', questionCount: 8 }) })
        destination = result.data.interviewId
        setSavedId(destination)
      }
      navigate(`/interview/session/${destination}`)
    } catch (err) { setError(err) } finally { lock.current = false; setBusy(false) }
  }
  return <section className="campus-form"><h1>没简历也可以给我讲讲你感兴趣的事</h1><p>经历、课程设计、兴趣或还在构思的想法都可以。无需上传材料，也不用先填写档案。</p><p>这次交流不打能力分，你可以打字或录音，随时结束。结束后由你决定是否把整理出的资料保存到个人资料。</p><RequestError error={error} /><button className="primary" type="button" disabled={busy} onClick={start}>{busy ? '正在开始…' : savedId ? '进入已创建的交流' : '开始聊聊'}</button>{error && !savedId && <p>如果刚才的请求没有收到结果，可以先到历史档案查看是否已创建交流，避免重复开始。</p>}<Link to="/history">查看或继续已有交流</Link><Link to="/interview">准备正式面试</Link></section>
}
