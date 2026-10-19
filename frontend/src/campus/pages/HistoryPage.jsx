import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { campusFetch } from '../api'
import { FeedbackView, OverallView } from '../components/InterviewFeedback'
import RequestError from '../components/RequestError'

function useStatus() {
  const [error, setError] = useState('')
  return { error, setError }
}

function archiveTitle(row) {
  return row?.title?.trim() || row?.jobRole || '未命名面试'
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
  useEffect(() => {
    campusFetch('/api/interview/history')
      .then((payload) => setRows(payload.data || []))
      .catch(setError)
  }, [])

  async function remove(id) {
    setError('')
    try {
      await campusFetch(`/api/interview/${id}`, { method: 'DELETE' })
      setRows((current) => current.filter((row) => row._id !== id))
      setPendingDelete('')
    } catch (err) {
      setError(err)
    }
  }

  return (
    <section>
      <h1>历史档案</h1>
      <p>每场面试一份档案。可以重命名，也可以删除。删除后不能恢复。</p>
      <RequestError error={error} />
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
                    {row.status === 'completed' && Number.isFinite(row.overallScore) ? ` · ${row.overallScore}分` : ''}
                    {` · 已答 ${row.answeredCount || 0}/${row.totalQuestionCount || row.answeredCount || 0} 题`}
                  </p>
                </div>
                <div className="campus-archive-actions">
                  <Link to={`/history/${row._id}`}>查看</Link>
                  <button type="button" onClick={() => { setEditing(row._id); setPendingDelete('') }}>重命名</button>
                  {pendingDelete === row._id ? (
                    <>
                      <button type="button" className="danger" onClick={() => remove(row._id)}>确认删除</button>
                      <button type="button" onClick={() => setPendingDelete('')}>取消</button>
                    </>
                  ) : (
                    <button type="button" className="danger" onClick={() => setPendingDelete(row._id)}>删除</button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {!error && rows.length === 0 && <p>还没有面试档案。</p>}
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
  useEffect(() => {
    campusFetch(`/api/interview/${id}`)
      .then((payload) => setItem(payload.data))
      .catch(setError)
  }, [id])

  async function remove() {
    try {
      await campusFetch(`/api/interview/${id}`, { method: 'DELETE' })
      navigate('/history')
    } catch (err) {
      setError(err)
    }
  }

  return (
    <section className="campus-form">
      <RequestError error={error} />
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
              <p>{archiveStatus(item.status)}{archiveTime(item) ? ` · ${archiveTime(item)}` : ''}{item.status === 'completed' && Number.isFinite(item.overallScore) ? ` · ${item.overallScore}分` : ''}</p>
              <div className="campus-archive-actions">
                <button type="button" onClick={() => setEditing(true)}>重命名</button>
                {pendingDelete ? (
                  <>
                    <button type="button" className="danger" onClick={remove}>确认删除</button>
                    <button type="button" onClick={() => setPendingDelete(false)}>取消</button>
                  </>
                ) : (
                  <button type="button" className="danger" onClick={() => setPendingDelete(true)}>删除</button>
                )}
                <Link to="/history">返回列表</Link>
                {item.status !== 'completed' && <Link to={`/interview/session/${id}`}>继续练习或重试总评</Link>}
              </div>
            </>
          )}
          <OverallView score={item.overallScore} feedback={item.overallFeedback} />
          {(item.answers || []).map((answer, index) => (
            <article className="campus-turn" key={answer.questionId || index}>
              <h2>第 {index + 1} 题</h2>
              <p><strong>问题：</strong>{answer.question}</p>
              <p><strong>你的回答：</strong>{answer.transcript || '没有保存回答文本。'}</p>
              <FeedbackView analysis={answer.analysis} />
            </article>
          ))}
        </>
      )}
    </section>
  )
}
