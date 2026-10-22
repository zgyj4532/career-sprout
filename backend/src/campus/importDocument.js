import fs from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'
import { createRequire } from 'node:module'
import { load } from 'cheerio'
import { LIMITS, limitError, zipEntries, imageHeaderFromBytes, notePdfPage } from './importLimits.js'

const require = createRequire(import.meta.url)

export async function readBoundedFile(filePath) {
  const handle = await fs.open(filePath, 'r')
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size < 1 || stat.size > LIMITS.fileBytes) throw limitError('FILE_LIMIT')
    const bytes = Buffer.alloc(stat.size)
    let offset = 0
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset)
      if (!bytesRead) throw limitError('FILE_CHANGED')
      offset += bytesRead
    }
    if ((await handle.stat()).size !== stat.size) throw limitError('FILE_CHANGED')
    return bytes
  } finally { await handle.close() }
}

function issue(block, code, message) {
  return { id: `${block.id}-${code}`, code, blockId: block.id, message }
}

function finish(blocks, issues, extra = {}) {
  const text = blocks.map((block) => block.text).filter(Boolean).join('\n\n')
  if (text.length > LIMITS.textChars) throw limitError('TEXT_TOO_LONG')
  const complete = !issues.length
  return { ok: Boolean(text) || Boolean(extra.needsVision), blocks, text, issues, complete, ...extra,
    ...(!text && !extra.needsVision ? { code: 'NO_TEXT_LAYER' } : {}) }
}

export async function parseDocx(bytes, onBlock = async () => {}, previousBlocks = []) {
  const entries = zipEntries(bytes)
  const blocks = []
  const issues = []
  let textLength = 0
  for (const entry of entries) {
    const isText = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(entry.name)
    const isImage = entry.name.startsWith('word/media/') && !entry.name.endsWith('/')
    if (!isText && !isImage) continue
    const compressed = bytes.subarray(entry.start, entry.start + entry.compressed)
    const data = entry.method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.size) })
    if (data.length !== entry.size) throw limitError('DOCX_INVALID')
    if (isImage) {
      const block = { id: `docx-image-${blocks.filter((item) => item.kind === 'image').length + 1}`, kind: 'image', text: '', status: 'unread', source: entry.name }
      try { block.header = imageHeaderFromBytes(data) } catch (error) {
        if (['PIXEL_LIMIT', 'FRAME_LIMIT'].includes(error.code)) throw error
        block.unsupported = true
      }
      blocks.push(block)
      issues.push(issue(block, 'DOCX_IMAGE_UNREAD', 'Word 内嵌图片尚未读取；可单独上传图片，或确认跳过这部分。'))
      await onBlock(block)
      continue
    }
    const xml = data.toString('utf8')
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw limitError('DOCX_INVALID')
    const $ = load(xml, { xmlMode: true })
    const paragraphs = $('w\\:p')
    for (let index = 0; index < paragraphs.length; index += 1) {
      const paragraph = paragraphs[index]
      const text = $(paragraph).find('w\\:t, w\\:tab, w\\:br').map((_, node) => node.name === 'w:t' ? $(node).text() : node.name === 'w:tab' ? '\t' : '\n').get().join('').trim()
      if (!text) continue
      textLength += text.length
      if (textLength > LIMITS.textChars) throw limitError('TEXT_TOO_LONG')
      const id = `${entry.name}:${index + 1}`
      const block = previousBlocks.find((item) => item.id === id && item.status === 'read') || { id, kind: 'paragraph', text, status: 'read', source: entry.name }
      blocks.push(block)
      await onBlock(block)
    }
  }
  if (!entries.some((entry) => entry.name === 'word/document.xml')) throw limitError('DOCX_INVALID')
  return finish(blocks, issues)
}

export function classifyPdfPage({ id, page, items, height, hasImages }) {
  let lastY
  const lines = []
  for (const item of items) {
    if (!item.str) continue
    const y = item.transform[5]
    if (lastY !== undefined && Math.abs(lastY - y) < 3) lines[lines.length - 1] += ` ${item.str}`
    else lines.push(item.str)
    lastY = y
  }
  const text = lines.join('\n').trim()
  const body = items.filter((item) => item.str.trim() && item.transform[5] > height * 0.12 && item.transform[5] < height * 0.88)
  const partial = !text || body.length === 0 || (hasImages && (body.length < 4 || text.length < 150))
  const block = { id, page, kind: 'page', text, status: partial ? 'partial' : 'read', hasImages }
  const issues = []
  if (partial) issues.push(issue(block, text ? 'PDF_BODY_UNREAD' : 'NO_TEXT_LAYER', text ? '这一页可能只读到了页眉或少量文字，图片正文未读取。' : '这一页没有可读取的文字层；扫描版 PDF 暂不支持。'))
  else if (hasImages) issues.push(issue(block, 'PDF_IMAGE_UNVERIFIED', '这一页包含图片，无法确认图片中是否还有遗漏的文字。'))
  return { block, issues }
}

export async function parsePdf(bytes, onBlock = async () => {}, previousBlocks = []) {
  // Use the engine bundled with pdf-parse directly: its convenience wrapper
  // swallows individual page failures and checks the page count too late.
  const pdfjs = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js')
  pdfjs.PDFJS.disableWorker = true
  // This bundled PDF.js version reads these from global settings, not the
  // getDocument options. Operator inspection must never invoke DOM font loading.
  pdfjs.PDFJS.disableFontFace = true
  pdfjs.PDFJS.isEvalSupported = false
  pdfjs.PDFJS.maxImageSize = LIMITS.maxImagePixels
  const document = await pdfjs.getDocument({ data: bytes })
  const blocks = []
  const issues = []
  let textLength = 0
  try {
    notePdfPage(document.numPages)
    for (let number = 1; number <= document.numPages; number += 1) {
      const id = `page-${number}`
      const previous = previousBlocks.find((block) => block.id === id && block.status === 'read')
      if (previous) {
        blocks.push(previous)
        textLength += previous.text.length
        if (previous.hasImages) issues.push(issue(previous, 'PDF_IMAGE_UNVERIFIED', '这一页包含图片，无法确认图片中是否还有遗漏的文字。'))
        continue
      }
      let page
      let parsed
      try {
        page = await document.getPage(number)
        const content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
        const operators = await page.getOperatorList()
        const imageOps = new Set(['paintImageXObject', 'paintInlineImageXObject', 'paintImageMaskXObject', 'paintJpegXObject', 'paintImageXObjectRepeat', 'paintImageMaskXObjectRepeat', 'paintInlineImageXObjectGroup', 'paintImageMaskXObjectGroup'].map((name) => pdfjs.OPS[name]))
        parsed = classifyPdfPage({ id, page: number, items: content.items, height: page.getViewport(1).height, hasImages: operators.fnArray.some((op) => imageOps.has(op)) })
      } catch {
        const block = { id, page: number, kind: 'page', text: '', status: 'failed' }
        parsed = { block, issues: [issue(block, 'PAGE_READ_FAILED', '这一页没有完成读取，可以继续读取。')] }
      } finally { page?.cleanup() }
      textLength += parsed.block.text.length
      if (textLength > LIMITS.textChars) throw limitError('TEXT_TOO_LONG')
      blocks.push(parsed.block)
      issues.push(...parsed.issues)
      await onBlock(parsed.block)
    }
    return finish(blocks, issues, { pages: document.numPages })
  } finally { await document.destroy() }
}

export async function parseDocument(filePath, kind, onBlock, previousBlocks) {
  const bytes = await readBoundedFile(filePath)
  if (kind === 'pdf') return parsePdf(bytes, onBlock, previousBlocks)
  if (kind === 'docx') return parseDocx(bytes, onBlock, previousBlocks)
  if (['png', 'jpeg', 'webp'].includes(kind)) {
    const header = imageHeaderFromBytes(bytes)
    const block = { id: 'image-1', kind: 'image', text: '', status: 'pending_vision', header }
    await onBlock?.(block)
    return finish([block], [], { needsVision: true, complete: false, header })
  }
  throw limitError('IMPORT_TYPE')
}
