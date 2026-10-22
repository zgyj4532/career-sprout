import { z } from 'zod'
import { LIMITS } from './importLimits.js'

const short = (max = 150) => z.string().max(max).default('')
const source = { sourceBlockId: z.string().min(1).max(200), sourceBlockIds: z.array(z.string().min(1).max(200)).max(100).optional(), evidence: z.string().min(1).max(LIMITS.textChars) }
const dates = { dateText: short(80), startDate: short(40), endDate: short(40) }
export const importResultSchema = z.object({
  name: short(), email: short(300), phone: short(80),
  education: z.array(z.object({ ...source, ...dates, institution: short(), degree: short(100), field: short(100), fullText: short(LIMITS.textChars) })).max(20),
  experiences: z.array(z.object({ ...source, ...dates, kind: z.enum(['course', 'club', 'project', 'internship', 'other']), title: short(), organization: short(), fullText: z.string().min(1).max(LIMITS.textChars), brief: short(3000) })).max(30),
  skills: z.array(z.object({ ...source, name: z.string().min(1).max(80) })).max(50),
  transcription: z.array(z.object({ id: z.string().max(200), text: z.string().max(LIMITS.textChars) })).max(30).default([]),
})

export const DEGREE = [['参与', '负责'], ['协助', '主导'], ['了解', '精通'], ['熟悉', '精通']]
export const NEGATIONS = ['没有', '未', '不是', '不能', '不熟悉']
export const degreeStrengthened = (source, output) => DEGREE.some(([weak, strong]) => source.includes(weak) && !source.includes(strong) && output.includes(strong))
export const negationDropped = (source, output) => NEGATIONS.some((word) => source.includes(word) && !output.includes(word))
const compact = (value) => String(value || '').replace(/\s/g, '')
const contains = (source, value) => !value || compact(source).includes(compact(value))
const numbers = (text) => new Set(text.match(/\d+(?:[.,]\d+)*(?:%|％)?/g) || [])

export function validateGrounding(sourceText, payload) {
  const output = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const sourceNumbers = numbers(sourceText)
  if ([...numbers(output)].some((number) => !sourceNumbers.has(number))) return { ok: false, reason: 'number' }
  if (degreeStrengthened(sourceText, output) || negationDropped(sourceText, output)) return { ok: false, reason: 'degree' }
  return { ok: true }
}

function dateMetadata(item) {
  const text = item.dateText || [item.startDate, item.endDate].filter(Boolean).join(' — ')
  const years = text.match(/(?:19|20)\d{2}/g) || []
  return {
    dateText: text,
    precision: /\d{4}[年./-]\d{1,2}[月./-]\d{1,2}/.test(text) ? 'day' : /\d{4}[年./-]\d{1,2}/.test(text) ? 'month' : years.length ? 'year' : 'unknown',
    current: /至今|现在|present|current/i.test(text),
    ...(years[0] ? { startYear: Number(years[0]) } : {}),
    ...(years[1] ? { endYear: Number(years[1]) } : {}),
  }
}

export function parseImportResult(raw, { blocks, issues = [], vision = false, operationId = '' }) {
  if (typeof raw !== 'string' || raw.length > LIMITS.outputChars) return { ok: false, reason: 'output_limit' }
  let parsed
  try { parsed = importResultSchema.safeParse(JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))) }
  catch { return { ok: false, reason: 'json' } }
  if (!parsed.success) return { ok: false, reason: 'schema' }
  const value = parsed.data
  const outputIssues = [...issues]
  let sourceBlocks = blocks
  if (vision) {
    if (value.transcription.length !== blocks.length || blocks.some((block) => !value.transcription.some((item) => item.id === block.id && item.text.trim()))) return { ok: false, reason: 'transcription' }
    sourceBlocks = blocks.map((block) => ({ ...block, text: value.transcription.find((item) => item.id === block.id).text, status: 'vision_unverified' }))
    for (const block of sourceBlocks) outputIssues.push({ id: `${block.id}-vision`, code: 'VISION_UNVERIFIED', blockId: block.id, message: '图片文字由模型读取，可能遗漏；请对照原图确认姓名、日期和重要内容。' })
  }
  const sourceText = sourceBlocks.map((block) => block.text).join('\n\n')
  if (!sourceText.trim() || sourceText.length > LIMITS.textChars) return { ok: false, reason: 'source_limit' }
  for (const field of ['name', 'email', 'phone']) {
    if (contains(sourceText, value[field])) continue
    value[field] = ''
    outputIssues.push({ id: `ungrounded-${field}`, code: 'UNGROUNDED_FIELD', field, message: '这项信息无法对应原文，未采用模型填写的内容；原文仍保留。' })
  }
  const byId = new Map(sourceBlocks.map((block) => [block.id, block]))
  const represented = new Map()
  for (const category of ['education', 'experiences', 'skills']) {
    const grounded = []
    for (const [sourceIndex, item] of value[category].entries()) {
      const index = grounded.length
      const sourceIds = item.sourceBlockIds?.length ? item.sourceBlockIds : [item.sourceBlockId]
      const itemBlocks = sourceIds.map((id) => byId.get(id))
      const positions = sourceIds.map((id) => sourceBlocks.findIndex((part) => part.id === id))
      const validSources = itemBlocks.every(Boolean) && sourceIds[0] === item.sourceBlockId && positions.every((position, offset) => offset === 0 || position > positions[offset - 1])
      const rejectEntry = () => outputIssues.push({ id: `${category}-${sourceIndex}-rejected`, code: 'UNGROUNDED_ENTRY', blockId: byId.has(item.sourceBlockId) ? item.sourceBlockId : undefined, message: '有一项内容无法对应来源，未作为经历或技能采用；可在其他原文材料中查看并手动补充。' })
      if (!validSources) { rejectEntry(); continue }
      const block = byId.get(item.sourceBlockId)
      const itemSource = itemBlocks.map((part) => part.text).join('\n')
      const fullTextGrounded = Boolean(item.fullText) && contains(itemSource, item.fullText)
      const evidenceGrounded = contains(itemSource, item.evidence)
      if ((category === 'experiences' && !fullTextGrounded) || (category === 'skills' && (!evidenceGrounded || !contains(item.evidence, item.name))) || (!evidenceGrounded && !fullTextGrounded)) { rejectEntry(); continue }
      const flag = (field) => outputIssues.push({ id: `${category}-${sourceIndex}-${field}-ungrounded`, code: 'UNGROUNDED_FIELD', blockId: block.id, field: `${category}.${index}.${field}`, message: '这项内容无法逐字对应来源，未采用该字段；其他有依据的内容和原文已保留。' })
      if (!evidenceGrounded) {
        item.evidence = item.fullText
        flag('evidence')
      }
      const fields = category === 'education' ? ['institution', 'degree', 'field', 'fullText', 'dateText', 'startDate', 'endDate'] : category === 'experiences' ? ['title', 'organization', 'dateText', 'startDate', 'endDate'] : []
      for (const field of fields) {
        if (contains(itemSource, item[field])) continue
        item[field] = ''
        flag(field)
      }
      if (item.brief && (!contains(item.fullText, item.brief) || !validateGrounding(item.fullText, item.brief).ok)) { item.brief = ''; flag('brief') }
      // A source may have an untitled experience. The UI/storage require a
      // label, so use a literal source excerpt rather than invent a role.
      if (category === 'experiences' && !item.title) {
        item.title = item.organization || item.fullText.split('\n').find((line) => line.trim())?.trim().slice(0, 150) || item.fullText.slice(0, 150)
        item.titleIsSourceExcerpt = true
      }
      const raw = item.fullText || item.evidence
      for (const part of itemBlocks) {
        const representedText = contains(raw, part.text) ? part.text : raw
        represented.set(part.id, [...(represented.get(part.id) || []), representedText])
      }
      if (itemBlocks.length > 1) outputIssues.push({ id: `${item.sourceBlockId}-${category}-${index}-association`, code: 'SOURCE_ASSOCIATION', blockId: item.sourceBlockId, field: `${category}.${index}`, message: '这段内容来自多个原文段落，请确认它们属于同一段经历。' })
      item.id = `${operationId}:${category}:${block.id}:${sourceIndex}`
      if (category !== 'skills') {
        Object.assign(item, dateMetadata(item))
        if (category === 'experiences') Object.assign(item, { context: item.organization, actions: '', result: '' })
        if (item.dateText) outputIssues.push({ id: `${item.id}-date`, code: 'DATE_ASSOCIATION', blockId: block.id, field: `${category}.${index}.dateText`, message: '日期与这段经历的对应关系需要确认，未当作已验证。' })
      }
      grounded.push(item)
    }
    value[category] = grounded
  }
  const remaining = []
  for (const block of sourceBlocks) {
    let rest = block.text || ''
    for (const quote of represented.get(block.id) || []) rest = rest.replace(quote, '')
    for (const field of ['name', 'email', 'phone']) if (value[field]) rest = rest.replace(value[field], '')
    if (rest.trim()) remaining.push(rest.trim())
    if (rest.trim() && /教育|实习|项目|经历|技能|求职意向|工作经验/.test(rest) && !/^(教育经历|教育背景|实习经历|项目经历|工作经历|技能|工作经验)[：:\s]*$/.test(rest.trim())) outputIssues.push({ id: `${block.id}-missing`, code: 'SUSPECTED_MISS', blockId: block.id, message: '这部分可能没有整理成字段，已保留在其他原文材料中。' })
    if (['partial', 'failed', 'unread'].includes(block.status) && !outputIssues.some((item) => item.blockId === block.id)) outputIssues.push({ id: `${block.id}-unread`, code: 'READ_INCOMPLETE', blockId: block.id, message: '这部分没有完整读取，原件已保留。' })
  }
  // Raw leftovers are reconstructed by the server, not entrusted to the model.
  value.otherMaterials = remaining.join('\n\n')
  delete value.transcription
  const result = { ...value, resumeText: sourceText, issues: outputIssues, complete: outputIssues.length === 0,
    summary: `已整理 ${value.education.length} 段教育、${value.experiences.length} 段经历和 ${value.skills.length} 个技能${outputIssues.length ? `，有 ${outputIssues.length} 处需要确认` : ''}。` }
  return { ok: true, result, blocks: sourceBlocks, issues: outputIssues }
}
