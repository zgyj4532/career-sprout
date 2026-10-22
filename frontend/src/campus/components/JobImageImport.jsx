import { useEffect, useRef, useState } from 'react'
import { campusData, campusFetch } from '../api'
import RequestError from './RequestError'

export default function JobImageImport({ disabled, onChoose }) {
  const [expanded, setExpanded] = useState(false)
  const [images, setImages] = useState([])
  const [draft, setDraft] = useState(null)
  const [history, setHistory] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const urls = useRef(new Set())
  const sequence = useRef(0)
  function preview(blob) { const url = URL.createObjectURL(blob); urls.current.add(url); return url }
  function clearImages() { for (const url of urls.current) URL.revokeObjectURL(url); urls.current.clear(); setImages([]) }
  async function list(reset = true) {
    const page = reset ? 1 : historyPage + 1
    setLoadingHistory(true)
    try {
      const data = await campusData(page === 1 ? '/jobs/images' : `/jobs/images?page=${page}&limit=20`)
      setHistory((current) => reset ? data.items : [...current, ...data.items.filter((row) => !current.some((old) => old.id === row.id))])
      setHistoryTotal(data.total ?? data.items.length); setHistoryPage(data.page || page)
    } finally { setLoadingHistory(false) }
  }
  useEffect(() => { list().catch(setError); return () => { sequence.current += 1; for (const url of urls.current) URL.revokeObjectURL(url) } }, [])
  function add(files) {
    const additions = Array.from(files).filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    if (!additions.length) { setNote('请选择 PNG、JPEG 或 WEBP 截图。'); return }
    if (draft) { setNote('请先关闭当前导入，再选择另一组截图。原来的导入记录仍保留。'); return }
    if (images.length + additions.length > 5 || [...images.map((row) => row.file), ...additions].reduce((sum, file) => sum + file.size, 0) > 10 * 1024 * 1024) { setNote('一组最多 5 张截图，总计不超过 10MB。'); return }
    setImages((current) => [...current, ...additions.map((file) => ({ id: crypto.randomUUID(), file, url: preview(file) }))]); setNote('')
  }
  function move(index, delta) { setImages((current) => { const next = [...current]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next }); setSelected('') }
  async function restore(id) {
    const version = ++sequence.current
    setBusy(true); setError(null)
    try {
      const data = await campusData(`/jobs/images/${id}`)
      if (version !== sequence.current) return
      clearImages(); setDraft(data); setSelected(data.candidates?.length === 1 ? String(data.candidates[0].id || 0) : '')
      const originals = await Promise.all(data.files.map(async (file) => {
        try { return { ...file, blob: await campusFetch(`/api/campus/jobs/images/${id}/source/${file.index}`, { responseType: 'blob' }) } }
        catch (err) { return { ...file, error: err } }
      }))
      if (version !== sequence.current) return
      setImages(originals.map(({ blob, error: sourceError, ...file }) => ({ ...file, url: blob ? preview(blob) : null, missing: Boolean(sourceError) })))
      const failed = originals.find((file) => file.error)
      if (failed) { setError(failed.error); setNote('部分原图不可用，导入记录仍可查看或丢弃。') }
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function extract() {
    if (disabled || busy || !images.length) return
    setBusy(true); setError(null); setNote('正在读取截图，原图不会被整理结果替换。')
    try {
      let data
      if (draft) data = await campusData(`/jobs/images/${draft.id}/continue`, { method: 'POST', body: JSON.stringify({ order: images.map((row) => row.id) }) })
      else { const form = new FormData(); images.forEach((row) => form.append('images', row.file)); data = await campusData('/jobs/images', { method: 'POST', body: form }) }
      setDraft(data); setSelected(data.candidates?.length === 1 ? String(data.candidates[0].id || 0) : ''); setNote('')
      if (data.files?.length === images.length) setImages((current) => current.map((row, index) => ({ ...row, ...data.files[index] })))
      await list()
    } catch (err) { setError(err); setNote('原图与已有编辑仍保留；也可刷新导入记录，继续已收到的截图。'); list().catch(() => {}) } finally { setBusy(false) }
  }
  async function discard() {
    if (!window.confirm('丢弃这组截图与提取结果？已经保存的岗位不会删除。')) return
    setBusy(true); setError(null)
    try { await campusData(`/jobs/images/${draft.id}`, { method: 'DELETE' }); clearImages(); setDraft(null); setSelected(''); await list() } catch (err) { setError(err) } finally { setBusy(false) }
  }
  const lockedOrder = Boolean(draft)
  const candidates = draft?.candidates || []
  const candidate = candidates.find((row, index) => String(row.id || index) === selected)
  return <section className="campus-panel campus-form" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy && !disabled) add(event.dataTransfer.files) }} onPaste={(event) => { if (!busy && !disabled && event.clipboardData.files.length) { event.preventDefault(); add(event.clipboardData.files) } }}>
    <button type="button" aria-expanded={expanded || Boolean(draft) || images.length > 0} disabled={Boolean(draft) || images.length > 0} onClick={() => setExpanded((value) => !value)}>从岗位截图整理</button>
    <div hidden={!expanded && !draft && !images.length}><p>最多 5 张 / 10MB，先调整顺序再读取。只保存为自己的岗位草稿。</p><label>添加岗位截图<input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={disabled || busy || Boolean(draft)} onChange={(event) => { add(event.target.files); event.target.value = '' }} /></label></div>
    <RequestError error={error} />{note && <p role="status">{note}</p>}
    <ol className="job-image-list">{images.map((image, index) => <li key={image.id}><figure>{image.url ? <img src={image.url} alt={`岗位截图 ${index + 1}`} /> : <p>这张原图不可用，可丢弃导入后更换文件。</p>}<figcaption>截图 {index + 1}</figcaption></figure><div className="campus-actions"><button type="button" disabled={busy || disabled || lockedOrder || index === 0} onClick={() => move(index, -1)}>上移</button><button type="button" disabled={busy || disabled || lockedOrder || index === images.length - 1} onClick={() => move(index, 1)}>下移</button><button type="button" disabled={busy || disabled || lockedOrder} onClick={() => { URL.revokeObjectURL(image.url); urls.current.delete(image.url); setImages((current) => current.filter((row) => row.id !== image.id)); setSelected('') }}>删除这张</button></div></li>)}</ol>
    <div className="campus-actions">{(!draft || draft.canContinue) && <button type="button" className="primary" disabled={busy || disabled || !images.length} onClick={extract}>{busy ? '正在读取截图…' : draft ? '继续读取已收到的截图' : '读取这些截图'}</button>}{(draft || images.length > 0) && <button type="button" disabled={busy || disabled} onClick={() => { clearImages(); setDraft(null); setSelected(''); setNote('已关闭当前截图，服务器收到的导入仍可找回。') }}>关闭当前截图</button>}{draft && <button type="button" disabled={busy || disabled} onClick={discard}>丢弃这组截图与原件</button>}</div>
    {draft && <p role="status">{draft.status === 'busy' ? '服务忙碌，截图已保留，稍后继续读取。' : draft.status === 'failed' ? draft.canContinue ? '读取没有完成，截图仍保留，可以继续读取。' : '本次读取未取得可用结果，不能继续自动调用。原图仍保留，可核对后手动录入或明确重新上传。' : draft.status === 'processing' ? '服务器正在读取，请稍后从导入记录查看。' : '核对岗位与原图后，带入下方编辑。'} 已开始识别的来源顺序固定；调整顺序请关闭后重新选择截图。</p>}
    {candidates.length > 0 && <><h3>选择截图中的岗位</h3><p>同名岗位的城市、批次或截止时间不同，也要分别选择。</p>{candidates.map((row, index) => <label className="campus-check" key={row.id || index}><input type="radio" name="image-job-choice" checked={selected === String(row.id || index)} onChange={() => setSelected(String(row.id || index))} disabled={busy || disabled} />{row.company} · {row.title} · {[row.city, row.batch, row.deadline].filter(Boolean).join(' / ')}（来源截图 {(row.sourcePages || []).join('、')}）</label>)}
      <ul>{(draft.issues || []).map((issue, index) => <li key={issue.id || index}>{issue.message || issue.label}</li>)}</ul>
      <details><summary>查看提取原文</summary>{(draft.blocks || []).map((block, index) => <p className="campus-preserve-text" key={block.id || index}>截图 {block.page || index + 1}：{block.text}</p>)}</details>
      <button type="button" disabled={busy || disabled || !candidate} onClick={() => onChoose(candidate, draft.id)}>使用这个岗位，核对后保存</button>
    </>}
    <details><summary>找回截图导入记录（{historyTotal}）</summary><button type="button" disabled={busy || loadingHistory} onClick={() => list().catch(setError)}>刷新截图记录</button>{history.map((row) => <button type="button" key={row.id} disabled={busy || disabled} onClick={() => restore(row.id)}>{row.title || '岗位截图'} · {row.phase || row.status}</button>)}{history.length < historyTotal && <button type="button" disabled={busy || loadingHistory} onClick={() => list(false).catch(setError)}>{loadingHistory ? '正在加载…' : '加载更多截图记录'}</button>}</details>
  </section>
}
