import { useState } from 'react'
import { Link } from 'react-router-dom'

function textList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function FeedbackView({ analysis }) {
  const [open, setOpen] = useState(false)
  if (!analysis) return null
  return (
    <article className="campus-feedback">
      <div className="campus-feedback-bar">
        <div className="campus-scores">
          <span>贴题 {analysis.relevance ?? '—'}</span>
          <span>清楚 {analysis.clarity ?? '—'}</span>
          <span>信心 {analysis.confidence ?? '—'}</span>
        </div>
        <button type="button" className="campus-fold" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? '收起' : '展开'}
        </button>
      </div>
      {open && (
        <div className="campus-feedback-body">
          {analysis.feedback && <p>{analysis.feedback}</p>}
          {analysis.keyTakeaway && <p><strong>下次先改：</strong>{analysis.keyTakeaway}</p>}
          {textList(analysis.whatYouDidWell).length > 0 && (
            <div><strong>做得好的</strong><ul>{textList(analysis.whatYouDidWell).map((item) => <li key={item}>{item}</li>)}</ul></div>
          )}
          {textList(analysis.whatWasMissing).length > 0 && (
            <div><strong>还缺的</strong><ul>{textList(analysis.whatWasMissing).map((item) => <li key={item}>{item}</li>)}</ul></div>
          )}
          {textList(analysis.suggestions).length > 0 && (
            <div><strong>可以这样改</strong><ul>{textList(analysis.suggestions).map((item) => <li key={item}>{item}</li>)}</ul></div>
          )}
          {analysis.idealAnswer && <p><strong>参考答法：</strong>{analysis.idealAnswer}</p>}
        </div>
      )}
    </article>
  )
}

function OverallView({ score, feedback }) {
  const [open, setOpen] = useState(false)
  if (!feedback) return null
  return (
    <article className="campus-feedback">
      <div className="campus-feedback-bar">
        <h2>这次总评 {score ?? '—'}</h2>
        <button type="button" className="campus-fold" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? '收起' : '展开'}
        </button>
      </div>
      {open && (
        <div className="campus-feedback-body">
          {feedback.summary && <p>{feedback.summary}</p>}
          {textList(feedback.topStrengths).length > 0 && <div><strong>优势</strong><ul>{textList(feedback.topStrengths).map((item) => <li key={item}>{item}</li>)}</ul></div>}
          {textList(feedback.areasToImprove).length > 0 && <div><strong>要补的</strong><ul>{textList(feedback.areasToImprove).map((item) => <li key={item}>{item}</li>)}</ul></div>}
          {textList(feedback.recommendations).length > 0 && <div><strong>下一步</strong><ul>{textList(feedback.recommendations).map((item) => <li key={item}>{item}</li>)}</ul></div>}
        </div>
      )}
    </article>
  )
}
function scoreLabel(score) {
  if (score >= 90) return '很好'
  if (score >= 80) return '不错'
  if (score >= 70) return '合格'
  if (score >= 60) return '一般'
  return '还要练'
}

function RoomReport({ item, summary }) {
  const answers = item?.answers || []
  const feedback = summary?.overallFeedback || item?.overallFeedback
  const score = summary?.overallScore ?? item?.overallScore
  const avg = (key) => {
    if (!answers.length) return 0
    return Math.round(answers.reduce((sum, answer) => sum + (answer.analysis?.[key] || 0), 0) / answers.length)
  }
  const bars = [
    ['贴题程度', avg('relevance')],
    ['表达清楚', avg('clarity')],
    ['口头信心', avg('confidence')],
  ]
  return (
    <section className="campus-report">
      <p className="campus-kicker">面试结束</p>
      <h1>这次练完了</h1>
      <div className="campus-score-row">
        <div className="campus-score-ring" style={{ '--score': `${Math.max(0, Math.min(100, score || 0))}%` }}>
          <strong>{score ?? '—'}</strong>
          <span>{score == null ? '没有分数' : scoreLabel(score)}</span>
        </div>
        <div className="campus-bars">
          {bars.map(([label, value]) => (
            <div key={label}>
              <div><span>{label}</span><strong>{value}</strong></div>
              <i style={{ width: `${value}%` }} />
            </div>
          ))}
          {feedback?.summary && <p>{feedback.summary}</p>}
        </div>
      </div>
      {textList(feedback?.topStrengths).length > 0 && <div className="campus-panel"><strong>优势</strong><ul>{textList(feedback.topStrengths).map((row) => <li key={row}>{row}</li>)}</ul></div>}
      {textList(feedback?.areasToImprove).length > 0 && <div className="campus-panel"><strong>要补的</strong><ul>{textList(feedback.areasToImprove).map((row) => <li key={row}>{row}</li>)}</ul></div>}
      {textList(feedback?.recommendations).length > 0 && <div className="campus-panel"><strong>下一步</strong><ul>{textList(feedback.recommendations).map((row) => <li key={row}>{row}</li>)}</ul></div>}
      {answers.map((answer, index) => (
        <article className="campus-turn" key={answer.questionId || index}>
          <h2>第 {index + 1} 题</h2>
          <p><strong>问题：</strong>{answer.question}</p>
          <p><strong>你的回答：</strong>{answer.transcript || '没有保存回答文本。'}</p>
          <FeedbackView analysis={answer.analysis} />
        </article>
      ))}
      <Link className="button" to="/history">回历史档案</Link>
    </section>
  )
}

export { FeedbackView, OverallView, RoomReport }
