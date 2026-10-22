import { useEffect, useRef, useState } from 'react'
import { confirmView, saveCopy } from '../import/confirmCopy'

const IDENTITY = [['name', '姓名'], ['email', '邮箱'], ['phone', '电话']]
export default function ImportConfirm({ draft, result, onChange, decisions, onDecision, resumeId, onResume, resumeTitle, onTitle, onSave, onContinue, onSource, busy }) {
  const [panel, setPanel] = useState('result')
  const [sourceBlockId, setSourceBlockId] = useState('')
  const scroll = useRef(0)
  const [navigationHeight, setNavigationHeight] = useState(0)
  useEffect(() => {
    const navigation = document.querySelector('.campus-nav-container')
    if (!navigation) return undefined
    const measure = () => setNavigationHeight(getComputedStyle(navigation).position === 'fixed' ? navigation.getBoundingClientRect().height : 0)
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(navigation)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  if (!draft) return null
  const view = confirmView(draft)
  const issues = draft.issues || []
  const candidates = draft.candidates || []
  const unresolved = candidates.some((row) => !decisions[row.id])
  const unreviewed = issues.some((issue) => decisions[issue.id] !== 'confirmed')
  const choices = draft.resumeChoices || []
  const targetMissing = choices.length > 0 && !resumeId
  function showSource(blockId = '') { scroll.current = window.scrollY; setSourceBlockId(typeof blockId === 'string' ? blockId : ''); setPanel('source') }
  function back() { setPanel('result'); requestAnimationFrame(() => window.scrollTo(0, scroll.current)) }
  function field(key, value) { onChange({ ...result, [key]: value }) }
  function rowField(key, index, fieldName, value) { field(key, result[key].map((row, i) => i === index ? { ...row, [fieldName]: value } : row)) }
  return <section className="import-confirm campus-form" style={{ '--import-navigation-height': `${navigationHeight}px` }} aria-label="导入结果">
    <p role="status">{view.summary || view.phase}</p>
    <p>原件与抽出的文字会保留，直到你主动丢弃这份导入。DOCX 提供内容预览，不保证原排版。</p>
    {panel === 'source' ? <section className="import-source"><button type="button" onClick={back}>返回整理结果</button><button type="button" disabled={busy || draft.kept === false} onClick={onSource}>下载原件核对</button>
      {sourceBlockId && <button type="button" onClick={() => setSourceBlockId('')}>查看全部来源</button>}
      {(draft.blocks || []).filter((block) => !sourceBlockId || block.id === sourceBlockId).map((block, index) => <article key={block.id || index}><h3>来源 {block.page || index + 1}</h3><p>{({ read: '已读取原文', parsed: '已读取原文', vision_unverified: '图片识别文字，请核对原图', failed: '这部分读取失败', unreadable: '这部分无法读取', partial: '这部分尚未读完' })[block.status] || '提取文字，供核对来源'}</p><p className="campus-preserve-text">{block.text || '这部分还没有读出文字。'}</p></article>)}
    </section> : <>
      <button type="button" onClick={showSource}>查看原件与提取文字</button>
      {view.state === 'blocked' && <p>{draft.kept === false ? '原件不可用，请更换文件。' : '原件仍保留，不需要重新上传。'}{view.phase}</p>}
      {draft.failed && !draft.canContinue && <p>本次读取没有取得可用结果，不能继续自动调用。原件仍可核对；可以更换文件或手动整理，已有档案不会因此丢失。</p>}
      {result && <fieldset disabled={busy || draft.frozen || draft.saved || ['saved', 'restored', 'saving', 'save_unknown'].includes(draft.status)} className="campus-fieldset campus-form">
        <h3>整理结果（可以直接修改）</h3><p>原文没有写的内容可以留空，不需要补齐。</p>
        <div className="campus-grid">{IDENTITY.map(([key, label]) => <label key={key}>{label}<input value={result[key] || ''} onChange={(event) => field(key, event.target.value)} /></label>)}</div>
        <label>简介<textarea value={result.bio || ''} onChange={(event) => field('bio', event.target.value)} /></label>
        <h3>教育</h3>{(result.education || []).map((row, index) => <div className="campus-panel" key={row.id || index}>{[['institution', '学校'], ['degree', '学历'], ['field', '专业'], ['dateText', '时间（保留月份与至今）']].map(([key, label]) => <label key={key}>{label}<input value={row[key] || ''} onChange={(event) => rowField('education', index, key, event.target.value)} /></label>)}<details><summary>核对教育原文</summary><label>教育原文<textarea value={row.fullText || ''} onChange={(event) => rowField('education', index, 'fullText', event.target.value)} /></label></details></div>)}
        <h3>经历</h3>{(result.experiences || []).map((row, index) => <div className="campus-panel" key={row.id || index}>{[['title', row.titleIsSourceExcerpt ? '原文摘句（原文未写经历名称）' : '经历名称'], ['organization', '机构'], ['dateText', '时间（保留原文）']].map(([key, label]) => <label key={key}>{label}<input value={row[key] || ''} onChange={(event) => rowField('experiences', index, key, event.target.value)} /></label>)}<label>完整经历<textarea value={row.fullText ?? row.actions ?? ''} onChange={(event) => rowField('experiences', index, 'fullText', event.target.value)} /></label>{row.brief && <details><summary>可选精简稿</summary><p className="campus-preserve-text">{row.brief}</p><label className="campus-check"><input type="checkbox" checked={Boolean(row.useConcise)} onChange={(event) => rowField('experiences', index, 'useConcise', event.target.checked)} />在简历中采用精简稿，档案保留全文</label></details>}</div>)}
        <h3>技能</h3>{(result.skills || []).map((row, index) => <label key={index}>技能 {index + 1}<input value={typeof row === 'string' ? row : row.name || ''} onChange={(event) => field('skills', result.skills.map((skill, i) => i === index ? typeof skill === 'string' ? event.target.value : { ...skill, name: event.target.value } : skill))} /></label>)}
        <label>其他原文材料（奖项、证书、联系方式等）<textarea value={result.otherMaterials || ''} onChange={(event) => field('otherMaterials', event.target.value)} /></label>
        {issues.length > 0 && <section><h3>需要核对的地方</h3><ul>{issues.map((issue, index) => {
          const match = /^(education|experiences|skills)\.(\d+)/.exec(issue.field || '')
          const item = match ? result[match[1]]?.[Number(match[2])] : null
          const label = item ? [item.title || item.institution || item.name, item.dateText].filter(Boolean).join(' · ') : ''
          return <li key={issue.id || index}>{label && <strong>{label}：</strong>}{issue.message || issue.label}<button type="button" onClick={() => showSource(issue.blockId || item?.sourceBlockId || '')}>核对来源</button><label className="campus-check"><input type="checkbox" checked={decisions[issue.id] === 'confirmed'} onChange={(event) => onDecision(issue.id, event.target.checked ? 'confirmed' : '')} />已核对这处，以上结果正确</label></li>
        })}</ul><p>只需要处理这些问题，普通条目不用逐条勾选。尚未读完的部分可继续读取，或明确先保存其余内容。</p></section>}
        {candidates.map((candidate) => <label key={candidate.id}>{candidate.title}：{candidate.message || candidate.label || '这是档案里原来那段吗？'}<select value={decisions[candidate.id] || ''} onChange={(event) => onDecision(candidate.id, event.target.value)}><option value="">请选择</option><option value="keep-existing">是，保留档案里的原内容</option><option value="add">不是，另存为一条</option></select></label>)}
        {choices.length > 0 ? <label>更新哪份简历（只补空位）<select value={resumeId} onChange={(event) => onResume(event.target.value)}><option value="">选择一份简历</option>{choices.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select></label> : <label>新简历名称<input value={resumeTitle} onChange={(event) => onTitle(event.target.value)} /></label>}
      </fieldset>}
    </>}
    {!draft.saved && !['saved', 'restored'].includes(draft.status) && <div className="import-save-bar campus-actions">
      {draft.canContinue && <button type="button" disabled={busy} onClick={onContinue}>{busy ? '正在处理…' : view.action === '检查保存结果并继续' ? view.action : '继续读取'}</button>}
      {result && !draft.frozen && !['saving', 'save_unknown'].includes(draft.status) && <><button className="primary" type="button" disabled={busy || unresolved || unreviewed || targetMissing} onClick={() => onSave(false)}>{busy ? '正在保存…' : saveCopy({ ...draft, resumeId, resumeTitle })}</button>{(issues.length > 0 || unresolved) && <button type="button" disabled={busy || targetMissing} onClick={() => onSave(true)}>先保存其余内容，跳过待核对部分</button>}</>}
    </div>}
  </section>
}
