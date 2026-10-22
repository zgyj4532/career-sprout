import { Link } from 'react-router-dom'

const dimensionLabels = { relevance: '贴题程度', clarity: '表达清楚', confidence: '文字表达信心', expression: '实际表达观察', codeQuality: '代码质量' }
const modeLabels = { mixed: '综合练习', technical: '专业与技术', behavioral: '经历与表达', coding: '编程' }
function textList(value) { return Array.isArray(value) ? value.filter((row) => typeof row === 'string' && row.trim()) : [] }

export function ScoreBasis({ item, compact = false }) {
  if (item.purpose === 'discovery') return <p>兴趣交流 · 不评分，不计入面试成绩</p>
  if (item.scoreVersion !== 'available-v1') return <p>旧规则成绩 · 保留当时记录，不重新解释旧0分，不与新规则直接比较。</p>
  const scoring = item.scoring
  const dimensions = <ul>{Object.entries(scoring?.dimensions || {}).map(([key, dimension]) => <li key={key}>{dimensionLabels[key] || key}：{Number.isFinite(dimension.score) ? dimension.score : '未测'}；覆盖 {dimension.observed}/{dimension.answered} 个已保存回答{Number.isFinite(dimension.effectiveWeight) && dimension.effectiveWeight > 0 ? `，有效权重 ${Math.round(dimension.effectiveWeight * 100)}%` : ''}</li>)}</ul>
  return <div className="campus-form"><p>有效维度评分 · {modeLabels[scoring?.mode || item.mode] || '练习类型未记录'} · 未测维度不扣分，不同范围不直接比较。</p><p>评分范围：{scoring?.basis?.map((key) => dimensionLabels[key] || '其他已测维度').join('、') || '没有可用评分维度'}</p>
    {compact ? <><p>回答覆盖：{(scoring?.basis || []).map((key) => `${dimensionLabels[key] || key} ${scoring.dimensions?.[key]?.observed ?? '—'}/${scoring.dimensions?.[key]?.answered ?? '—'}`).join('；') || '没有可用评分观察'}</p><details><summary>维度得分与归一化权重</summary>{dimensions}</details></> : dimensions}
  </div>
}

export function FeedbackView({ analysis }) {
  if (!analysis) return null
  return <article className="campus-feedback campus-form">
    {analysis.keyTakeaway && <p><strong>下次先改：</strong>{analysis.keyTakeaway}</p>}
    {analysis.feedback && <p>{analysis.feedback}</p>}
    {textList(analysis.suggestions).length > 0 && <div><strong>可以这样改</strong><ul>{textList(analysis.suggestions).map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      <p>贴题 {analysis.relevance ?? '未测'} · 清楚 {analysis.clarity ?? '未测'} · 文字表达信心 {analysis.confidence ?? '未测'}</p>
      {textList(analysis.whatYouDidWell).length > 0 && <div><strong>做得好的</strong><ul>{textList(analysis.whatYouDidWell).map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {textList(analysis.whatWasMissing).length > 0 && <div><strong>还缺的</strong><ul>{textList(analysis.whatWasMissing).map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {analysis.idealAnswer && <p><strong>参考答法：</strong>{analysis.idealAnswer}</p>}
  </article>
}

export function RoomReport({ item }) {
  const answers = item.answers || []
  const feedback = item.overallFeedback
  const score = item.scoreVersion === 'available-v1' ? item.scoring?.overallScore : item.overallScore
  const recommendations = [...new Set(textList(feedback?.recommendations))]
  const remainingAdvice = recommendations.slice(1)
  const gaps = textList(feedback?.areasToImprove)
  const strengths = textList(feedback?.topStrengths)
  const hasDetails = feedback?.summary || remainingAdvice.length || gaps.length || strengths.length
  return <section className="campus-report campus-form"><p className="campus-kicker">正式面试反馈</p><h1>这次练完了</h1>
    {recommendations.length > 0 && <div className="campus-panel"><h2>下一步先做什么</h2><p>{recommendations[0]}</p></div>}
    {!feedback && <p>没有可展示的文字反馈，请查看已保存的回答与评分范围。</p>}
    <section className="campus-panel"><h2>本次成绩：{Number.isFinite(score) ? `${score}分` : '暂无可用总分'}</h2><ScoreBasis item={item} compact /></section>
    {Boolean(hasDetails) && <details><summary>更多建议与本次表现</summary>
      {feedback?.summary && <p>{feedback.summary}</p>}
      {remainingAdvice.length > 0 && <div><h2>其他建议</h2><ul>{remainingAdvice.map((row, index) => <li key={index}>{row}</li>)}</ul></div>}
      {gaps.length > 0 && <div><h2>可以补充的内容</h2><ul>{gaps.map((row, index) => <li key={index}>{row}</li>)}</ul></div>}
      {strengths.length > 0 && <div><h2>这次做得好的</h2><ul>{strengths.map((row, index) => <li key={index}>{row}</li>)}</ul></div>}
    </details>}
    <details><summary>逐题查看回答与反馈（{answers.length}）</summary>{answers.map((answer, index) => <article className="campus-turn" key={answer.questionId || index}><h2>第 {index + 1} 题</h2><p><strong>问题：</strong>{answer.question}</p><p className="campus-preserve-text"><strong>你的回答：</strong>{answer.transcript || '没有保存回答文本。'}</p><FeedbackView analysis={answer.analysis} /></article>)}</details>
    <Link className="button" to="/history">回历史档案</Link>
  </section>
}
