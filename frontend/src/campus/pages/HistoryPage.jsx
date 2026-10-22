import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { campusFetch } from '../api'
import { RoomReport, ScoreBasis } from '../components/InterviewFeedback'
import DiscoveryReport from '../components/DiscoveryReport'
import RequestError from '../components/RequestError'

function useStatus() {
  const [error, setError] = useState('')
  return { error, setError }
}

function archiveTitle(row) {
  return row?.title?.trim() || (row?.purpose === 'discovery' ? '兴趣交流' : row?.jobRole || '未命名面试')
}

function archiveStatus(status) {
  if (status === 'completed') return '已完成'
  if (status === 'abandoned') return '已放弃'
  return '未完成'
}

function archiveTime(row) {
  const value = row?.completedAt || row?.createdAt
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ArchiveEditor({ row, onSaved, onCancel }) {
  const [name, setName] = useState(archiveTitle(row))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(event) {
    event.preventDefault()
    const title = name.trim()
    if (!title) {
      setError({ code: 'TITLE_REQUIRED' })
      return
    }
    setBusy(true)
    setError('')
    try {
      await campusFetch(`/api/interview/${row._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      })
      onSaved(title)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form className="campus-archive-edit" onSubmit={save}>
      <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} aria-label="档案名字" />
      <button className="primary" type="submit" disabled={busy}>保存</button>
      <button type="button" onClick={onCancel} disabled={busy}>取消</button>
      <RequestError error={error} />
    </form>
  )
}

export function HistoryPage() {
  const { error, setError } = useStatus()
  const [rows, setRows] = useState([])
  const [editing, setEditing] = useState('')
  const [pendingDelete, setPendingDelete] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    campusFetch('/api/interview/history')
      .then((payload) => { if (active) setRows(payload.data || []) })
      .catch((err) => { if (active) setError(err) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  async function remove(id) {
    if (deleting) return
    setDeleting(true)
    setError('')
    try {
      await campusFetch(`/api/interview/${id}`, { method: 'DELETE' })
      setRows((current) => current.filter((row) => row._id !== id))
      setPendingDelete('')
    } catch (err) {
      setError(err)
    } finally { setDeleting(false) }
  }

  return (
    <section>
      <h1>历史档案</h1>
      <p>兴趣交流不打分；正式面试保留当次评分范围与规则。删除记录后不能恢复。</p>
      <RequestError error={error} onRetry={() => setReload((value) => value + 1)} />
      {loading && <p role="status">正在读取历史档案…</p>}
      <ul className="campus-archives">
        {rows.map((row) => (
          <li className="campus-archive" key={row._id}>
            {editing === row._id ? (
              <ArchiveEditor
                row={row}
                onCancel={() => setEditing('')}
                onSaved={(title) => {
                  setRows((current) => current.map((item) => item._id === row._id ? { ...item, title } : item))
                  setEditing('')
                }}
              />
            ) : (
              <>
                <div>
                  <strong>{archiveTitle(row)}</strong>
                  <p>
                    {archiveStatus(row.status)}
                    {archiveTime(row) ? ` · ${archiveTime(row)}` : ''}
                    {row.purpose === 'discovery' ? ' · 兴趣交流 · 不评分' : ` · 正式面试 · ${row.scoreVersion === 'available-v1' ? '有效维度规则' : '旧规则成绩'}`}
                    {row.purpose !== 'discovery' && row.status === 'completed' && Number.isFinite(row.overallScore) ? ` · ${row.overallScore}分` : ''}
                    {` · 已答 ${row.answeredCount || 0}/${row.totalQuestionCount || row.answeredCount || 0} 题`}
                  </p>
                  {row.purpose !== 'discovery' && row.scoreVersion === 'available-v1' && <ScoreBasis item={row} />}
                </div>
                <div className="campus-archive-actions">
                  <Link to={row.status === 'in_progress' ? `/interview/session/${row._id}` : `/history/${row._id}`}>{row.status === 'in_progress' ? '继续' : '查看'}</Link>
                  <details><summary>管理记录</summary><button type="button" onClick={() => { setEditing(row._id); setPendingDelete('') }}>重命名</button><button type="button" className="danger" onClick={() => setPendingDelete(row._id)}>删除</button></details>
                  {pendingDelete === row._id && <><span>删除后无法恢复。</span><button type="button" className="danger" disabled={deleting} onClick={() => remove(row._id)}>确认删除</button><button type="button" disabled={deleting} onClick={() => setPendingDelete('')}>取消</button></>}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {!loading && !error && rows.length === 0 && <p>还没有交流或面试档案。<Link to="/discovery">开始聊聊兴趣</Link></p>}
    </section>
  )
}

export function HistoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { error, setError } = useStatus()
  const [item, setItem] = useState(null)
  const [editing, setEditing] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    let active = true
    setItem(null); setError(''); setLoading(true)
    campusFetch(`/api/interview/${id}`)
      .then((payload) => { if (active) setItem(payload.data) })
      .catch((err) => { if (active) setError(err) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, reload])

  async function remove() {
    if (deleting) return
    setDeleting(true)
    try {
      await campusFetch(`/api/interview/${id}`, { method: 'DELETE' })
      navigate('/history')
    } catch (err) {
      setError(err)
    } finally { setDeleting(false) }
  }

  return (
    <section className="campus-form">
      <RequestError error={error} onRetry={() => setReload((value) => value + 1)} />
      {loading && <p role="status">正在读取档案…</p>}
      {item && (
        <>
          {editing ? (
            <ArchiveEditor
              row={{ ...item, _id: id }}
              onCancel={() => setEditing(false)}
              onSaved={(title) => {
                setItem((current) => ({ ...current, title }))
                setEditing(false)
              }}
            />
          ) : (
            <>
              <h1>{archiveTitle(item)}</h1>
              <p>{archiveStatus(item.status)}{archiveTime(item) ? ` · ${archiveTime(item)}` : ''}{item.purpose === 'discovery' ? ' · 兴趣交流 · 不评分' : ' · 正式面试'}</p>
              <div className="campus-archive-actions">
                <button type="button" onClick={() => setEditing(true)}>重命名</button>
                {pendingDelete ? (
                  <>
                    <span>删除后无法恢复。</span><button type="button" className="danger" disabled={deleting} onClick={remove}>确认删除</button>
                    <button type="button" disabled={deleting} onClick={() => setPendingDelete(false)}>取消</button>
                  </>
                ) : (
                  <button type="button" className="danger" onClick={() => setPendingDelete(true)}>删除</button>
                )}
                <Link to="/history">返回列表</Link>
                {item.status !== 'completed' && <Link to={`/interview/session/${id}`}>继续或恢复进度</Link>}
              </div>
            </>
          )}
          {item.status === 'completed' && (item.purpose === 'discovery' ? <DiscoveryReport item={item} /> : <RoomReport item={item} />)}
          {item.status !== 'completed' && <details><summary>已保存的回答</summary>{(item.answers || []).map((answer, index) => <article className="campus-turn" key={answer.questionId || index}><h2>{answer.question}</h2><p className="campus-preserve-text">{answer.transcript}</p></article>)}</details>}
        </>
      )}
    </section>
  )
}
