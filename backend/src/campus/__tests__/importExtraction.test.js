import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { zipSync, strToU8 } from 'fflate'
import PDFDocument from 'pdfkit'
import { parseDocx, classifyPdfPage } from '../importDocument.js'
import { LIMITS, imageHeaderFromBytes, zipEntries } from '../importLimits.js'
import { runImportModels, runBoundedModels, PRIMARY_MODEL, RETRY_MODEL } from '../importAi.js'
import { parseImportResult } from '../importGrounding.js'
import { parseJobImageResult, mergeAdjacentJobSegments, runJobImageModels } from '../importJobAi.js'
import { streamToFile, readImportImage, parseInChild } from '../importParse.js'

const sourceText = '小林\n学校大学 2020年09月—2024年06月 本科 软件工程\n2024年07月至今 参与校园网站，服务30名同学\n证书：英语六级'
const block = { id: 'page-1', kind: 'page', text: sourceText, status: 'read' }
const payload = () => ({ name: '小林', education: [{ sourceBlockId: block.id, evidence: '学校大学', institution: '学校大学', degree: '本科', field: '软件工程', dateText: '2020年09月—2024年06月', fullText: '学校大学 2020年09月—2024年06月 本科 软件工程' }], experiences: [{ sourceBlockId: block.id, evidence: '参与校园网站', kind: 'project', title: '校园网站', fullText: '2024年07月至今 参与校园网站，服务30名同学', dateText: '2024年07月至今' }], skills: [] })

test('structured extraction retains raw dates, long facts, leftovers and uncertain associations', () => {
  const parsed = parseImportResult(JSON.stringify(payload()), { blocks: [block], operationId: 'draft' })
  assert.equal(parsed.ok, true)
  assert.equal(parsed.result.education[0].precision, 'month')
  assert.equal(parsed.result.education[0].startYear, 2020)
  assert.equal(parsed.result.experiences[0].current, true)
  assert.match(parsed.result.otherMaterials, /英语六级/)
  assert.equal(parsed.result.resumeText, sourceText)
  assert.equal(parsed.result.complete, false)
  assert.ok(parsed.issues.some((issue) => issue.code === 'DATE_ASSOCIATION'))
  assert.deepEqual(parsed.result.skills, [])
})

test('source facts cannot be strengthened, fabricated or assigned from another block', () => {
  const bad = payload()
  bad.experiences[0].fullText = '负责校园网站，服务100名同学'
  const rejected = parseImportResult(JSON.stringify(bad), { blocks: [block] })
  assert.equal(rejected.ok, true)
  assert.equal(rejected.result.experiences.length, 0)
  assert.equal(rejected.result.education.length, 1)
  assert.ok(rejected.issues.some((issue) => issue.code === 'UNGROUNDED_ENTRY'))
  assert.match(rejected.result.otherMaterials, /参与校园网站/)
  assert.doesNotMatch(JSON.stringify(rejected.result), /负责校园网站|100名/)
  const dates = payload()
  dates.experiences[0].dateText = '2025年'
  const blanked = parseImportResult(JSON.stringify(dates), { blocks: [block] })
  assert.equal(blanked.ok, true)
  assert.equal(blanked.result.experiences[0].dateText, '')
  assert.ok(blanked.issues.some((issue) => issue.field === 'experiences.0.dateText' && issue.code === 'UNGROUNDED_FIELD'))
  const unrelated = payload()
  unrelated.experiences[0].sourceBlockId = 'other'
  const misassigned = parseImportResult(JSON.stringify(unrelated), { blocks: [block, { id: 'other', text: '另一家公司 2024年' }] })
  assert.equal(misassigned.ok, true)
  assert.equal(misassigned.result.experiences.length, 0)
  assert.equal(parseImportResult('{"text":"fake result"}', { blocks: [block] }).ok, false)
})

test('one primary call, one validation fallback and durable result reuse', async () => {
  const calls = []
  const checkpoints = []
  let charges = 0
  const input = { blocks: [block], userId: 'owner', operationId: 'draft', quota: { take: async () => { charges += 1 } }, onCheckpoint: async (state) => checkpoints.push(state),
    generate: async ({ model }) => { calls.push(model); return calls.length === 1 ? '{"text":"wrong schema"}' : JSON.stringify({ ...payload(), ownerId: 'attacker', public: true, status: 'published' }) } }
  const result = await runImportModels(input)
  assert.deepEqual(calls, [PRIMARY_MODEL, RETRY_MODEL])
  assert.equal(charges, 1)
  assert.equal(result.result.ownerId, 'owner')
  assert.equal(result.result.public, false)
  assert.equal(checkpoints[0].calls[0].status, 'started')
  assert.ok(checkpoints.some((state) => state.calls[0].status === 'received'))
  const recovered = await runImportModels({ ...input, state: result.state, generate: async () => assert.fail('must reuse completed output') })
  assert.deepEqual(recovered.result, result.result)
})

test('persisted raw response recovers without extra model cost; unknown call never repeats', async () => {
  const validate = (raw) => ({ ok: true, value: raw })
  const state = { calls: [{ model: PRIMARY_MODEL, status: 'received', raw: 'retained' }] }
  const recovered = await runBoundedModels({ state, validate, generate: async () => assert.fail('no provider call') })
  assert.equal(recovered.value, 'retained')
  await assert.rejects(runBoundedModels({ state: { calls: [{ model: PRIMARY_MODEL, status: 'started' }] }, validate }), { code: 'IMPORT_RESULT_UNKNOWN' })
  let count = 0
  await assert.rejects(runBoundedModels({ generate: async () => { count += 1; return 'invalid' }, validate: () => ({ ok: false, reason: 'schema' }) }), { code: 'IMPORT_VALIDATION' })
  assert.equal(count, 2)
})

test('timeout aborts actual provider request and does not spend validation fallback', async () => {
  let calls = 0
  let aborted = false
  await assert.rejects(runBoundedModels({ timeoutMs: 10, validate: () => ({ ok: true }), generate: ({ signal }) => new Promise((resolve, reject) => {
    calls += 1
    signal.addEventListener('abort', () => { aborted = true; reject(signal.reason) }, { once: true })
  }) }), { code: 'IMPORT_TIMEOUT' })
  assert.equal(aborted, true)
  assert.equal(calls, 1)
})

test('image extraction sends image data and never claims independently verified coverage', async () => {
  const image = { id: 'image-1', kind: 'image', text: '', status: 'pending_vision' }
  const result = await runImportModels({ blocks: [image], imageDataUrl: 'data:image/png;base64,c291cmNl', userId: 'owner', operationId: 'image', generate: async (input) => {
    assert.match(input.imageDataUrl, /^data:image\/png/)
    assert.ok(input.signal)
    const value = payload()
    for (const item of [...value.education, ...value.experiences]) item.sourceBlockId = image.id
    return JSON.stringify({ ...value, transcription: [{ id: image.id, text: sourceText }] })
  } })
  assert.equal(result.blocks[0].text, sourceText)
  assert.equal(result.result.complete, false)
  assert.ok(result.issues.some((issue) => issue.code === 'VISION_UNVERIFIED'))
})

test('DOCX extracts paragraphs and preserves unread embedded image coverage', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6S9sAAAAASUVORK5CYII=', 'base64')
  const zip = Buffer.from(zipSync({ 'word/document.xml': strToU8('<w:document xmlns:w="w"><w:body><w:p><w:r><w:t>学校 &amp; 证书</w:t></w:r></w:p></w:body></w:document>'), 'word/media/image1.png': png }))
  const saved = []
  const parsed = await parseDocx(zip, async (value) => saved.push(value))
  assert.equal(parsed.ok, true)
  assert.equal(parsed.complete, false)
  assert.match(parsed.text, /学校 & 证书/)
  assert.ok(parsed.issues.some((issue) => issue.code === 'DOCX_IMAGE_UNREAD'))
  assert.equal(saved.length, 2)
  const entries = zipEntries(zip)
  assert.equal(entries.length, 2)
  assert.throws(() => zipEntries(Buffer.from('invalid')), { code: 'DOCX_INVALID' })
})

test('ZIP declared expansion and actual expansion are bounded before full decompression', async () => {
  const zip = Buffer.from(zipSync({ 'word/document.xml': strToU8('x'.repeat(100000)) }))
  const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  zip.writeUInt32LE(LIMITS.docxUnzipBytes + 1, central + 24)
  assert.throws(() => zipEntries(zip), { code: 'UNZIP_LIMIT' })
  zip.writeUInt32LE(1, central + 24)
  await assert.rejects(parseDocx(zip))
})

test('mixed PDF pages and header-only pages cannot report complete coverage', () => {
  const header = classifyPdfPage({ id: 'page-2', page: 2, height: 800, hasImages: true, items: [{ str: '小林', transform: [1, 0, 0, 1, 20, 780] }] })
  assert.equal(header.block.status, 'partial')
  assert.equal(header.issues[0].code, 'PDF_BODY_UNREAD')
  const empty = classifyPdfPage({ id: 'page-3', page: 3, height: 800, hasImages: true, items: [] })
  assert.equal(empty.issues[0].code, 'NO_TEXT_LAYER')
})

test('WEBP simple lossless headers and animated limits are checked without decoding', () => {
  const webp = Buffer.alloc(26)
  webp.write('RIFF', 0); webp.writeUInt32LE(18, 4); webp.write('WEBP', 8); webp.write('VP8L', 12); webp.writeUInt32LE(5, 16); webp[20] = 0x2f
  assert.deepEqual(imageHeaderFromBytes(webp), { width: 1, height: 1, frames: 1 })
  const animated = Buffer.alloc(30)
  animated.write('RIFF', 0); animated.writeUInt32LE(22, 4); animated.write('WEBP', 8); animated.write('VP8X', 12); animated.writeUInt32LE(10, 16); animated[20] = 2
  assert.throws(() => imageHeaderFromBytes(animated), { code: 'FRAME_LIMIT' })
})

test('bounded upload removes oversize partial file and image reads preserve source', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'import-extraction-'))
  try {
    const destination = path.join(directory, 'upload')
    await assert.rejects(streamToFile(Readable.from(['12345']), destination, { maxBytes: 4 }), { code: 'FILE_LIMIT' })
    await assert.rejects(fs.stat(destination), { code: 'ENOENT' })
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6S9sAAAAASUVORK5CYII=', 'base64')
    await fs.writeFile(destination, image)
    assert.equal(await readImportImage(destination, 'png'), `data:image/png;base64,${image.toString('base64')}`)
    assert.deepEqual(await fs.readFile(destination), image)
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
})

test('job screenshots merge only adjacent matching contexts and retain page provenance', async () => {
  const images = [{ id: 'image-1', imageDataUrl: 'one' }, { id: 'image-2', imageDataUrl: 'two' }, { id: 'image-3', imageDataUrl: 'three' }]
  const job = { company: '公司', title: '工程师', city: '杭州', context: '公司 工程师 杭州', text: '公司 工程师 杭州\n条件一\n条件二' }
  const raw = JSON.stringify({ pages: [
    { id: 'image-1', text: job.text, jobs: [job] },
    { id: 'image-2', text: `${job.text}\n条件三`, jobs: [{ ...job, text: `${job.text}\n条件三` }] },
    { id: 'image-3', text: '公司 工程师 上海\n条件二', jobs: [{ ...job, city: '上海', context: '公司 工程师 上海', text: '公司 工程师 上海\n条件二' }] },
  ] })
  const parsed = parseJobImageResult(raw, images)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.candidates.length, 2)
  assert.deepEqual(parsed.candidates[0].sourcePages, [1, 2])
  assert.equal(parsed.candidates[0].description.match(/条件二/g).length, 1)
  assert.match(parsed.candidates[1].description, /条件二/)
  assert.equal(mergeAdjacentJobSegments({ text: '相同句' }, { text: '相同句' }, false).overlap, 0)
  const result = await runJobImageModels({ images, generate: async ({ imageDataUrls }) => { assert.deepEqual(imageDataUrls, ['one', 'two', 'three']); return raw } })
  assert.equal(result.candidates.length, 2)
})

test('job skills and explicit availability are grounded; missing time remains unknown', () => {
  const text = '公司 工程师\n要求熟悉SQL\n2026年11月01日至2027年02月28日，每周至少3天'
  const job = { company: '公司', title: '工程师', text, requirements: [{ name: 'SQL', level: 2, required: true, evidence: '要求熟悉SQL' }], availability: { startDate: '2026-11-01', endDate: '2027-02-28', daysPerWeek: 3 }, availabilityEvidence: '2026年11月01日至2027年02月28日，每周至少3天' }
  const encode = (value) => JSON.stringify({ pages: [{ id: 'image-1', text, jobs: [value] }] })
  const images = [{ id: 'image-1' }]
  const parsed = parseJobImageResult(encode(job), images)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.candidates[0].requirements[0].name, 'SQL')
  assert.equal(parsed.candidates[0].availability.daysPerWeek, 3)
  assert.equal(parseJobImageResult(encode({ ...job, availability: { ...job.availability, daysPerWeek: 5 } }), images).ok, false)
  assert.equal(parseJobImageResult(encode({ ...job, availability: { ...job.availability, endDate: '2027-02-30' } }), images).ok, false)
  const unknown = parseJobImageResult(encode({ company: '公司', title: '工程师', text }), images)
  assert.deepEqual(unknown.candidates[0].availability, { startDate: null, endDate: null, daysPerWeek: null })
})

test('DOCX multi-paragraph experiences cite every source block and ignore plain headings', () => {
  const blocks = [
    { id: 'heading', kind: 'paragraph', text: '项目经历', status: 'read' },
    { id: 'title', kind: 'paragraph', text: '校园网站', status: 'read' },
    { id: 'body', kind: 'paragraph', text: '参与页面开发，服务30名同学', status: 'read' },
  ]
  const raw = JSON.stringify({ education: [], skills: [], experiences: [{ sourceBlockId: 'title', sourceBlockIds: ['title', 'body'], evidence: '校园网站', kind: 'project', title: '校园网站', fullText: '校园网站\n参与页面开发，服务30名同学' }] })
  const parsed = parseImportResult(raw, { blocks })
  assert.equal(parsed.ok, true)
  assert.equal(parsed.result.experiences[0].fullText, '校园网站\n参与页面开发，服务30名同学')
  assert.equal(parsed.issues.some((issue) => issue.code === 'SUSPECTED_MISS'), false)
})

test('PDF operator inspection completes in a headless child without DOM font loading', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'import-pdf-'))
  try {
    const document = new PDFDocument({ compress: false })
    const bytes = []
    const ended = new Promise((resolve, reject) => {
      document.on('data', (chunk) => bytes.push(chunk))
      document.once('end', resolve)
      document.once('error', reject)
    })
    document.text('Synthetic resume project experience. Participated in a campus website.', 80, 200)
    document.end()
    await ended
    const file = path.join(directory, 'resume.pdf')
    await fs.writeFile(file, Buffer.concat(bytes))
    const result = await parseInChild(file, { mode: 'pdf' })
    assert.equal(result.ok, true)
    assert.match(result.text, /Synthetic resume/)
    assert.equal(result.blocks.length, 1)
    assert.equal(result.blocks[0].status, 'read')
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
})

test('other materials are reconstructed only from source, never model-owned claims', () => {
  const clean = parseImportResult(JSON.stringify(payload()), { blocks: [block] })
  const forged = parseImportResult(JSON.stringify({ ...payload(), otherMaterials: '伪造证书：精通全部技术，负责100个项目' }), { blocks: [block] })
  assert.equal(forged.ok, true)
  assert.equal(forged.result.otherMaterials, clean.result.otherMaterials)
  assert.match(forged.result.otherMaterials, /英语六级/)
  assert.doesNotMatch(JSON.stringify(forged.result), /伪造证书|精通全部|100个/)
  const disjoint = parseImportResult(JSON.stringify({ ...payload(), otherMaterials: '小林\n英语六级' }), { blocks: [block] })
  assert.equal(disjoint.ok, true)
  assert.equal(disjoint.result.otherMaterials, clean.result.otherMaterials)
})

test('untitled grounded experiences use literal source labels and invalid identity stays blank', () => {
  const value = payload()
  value.name = '原文没有的人名'
  value.experiences[0].title = ''
  const result = parseImportResult(JSON.stringify(value), { blocks: [block] })
  assert.equal(result.ok, true)
  assert.equal(result.result.name, '')
  assert.equal(result.result.experiences[0].titleIsSourceExcerpt, true)
  assert.ok(sourceText.includes(result.result.experiences[0].title))
  assert.ok(result.issues.some((issue) => issue.field === 'name'))
  assert.match(result.result.otherMaterials, /小林/)
})

test('disjoint evidence never verifies itself; grounded fullText is retained with an issue', () => {
  const value = payload()
  value.experiences[0].evidence = '校园网站\n30名同学'
  const result = parseImportResult(JSON.stringify(value), { blocks: [block] })
  assert.equal(result.ok, true)
  assert.equal(result.result.experiences[0].evidence, value.experiences[0].fullText)
  assert.ok(result.issues.some((issue) => issue.code === 'UNGROUNDED_FIELD' && issue.field === 'experiences.0.evidence'))
  assert.equal(result.result.complete, false)
})

test('partial recovery issue indices address retained entries after rejected items', () => {
  const value = payload()
  value.experiences.unshift({ ...value.experiences[0], fullText: '不存在的事实' })
  value.experiences[1].organization = '不存在的机构'
  const result = parseImportResult(JSON.stringify(value), { blocks: [block] })
  assert.equal(result.result.experiences.length, 1)
  assert.equal(result.result.experiences[0].organization, '')
  assert.ok(result.issues.some((issue) => issue.field === 'experiences.0.organization'))
  assert.ok(result.issues.some((issue) => issue.code === 'UNGROUNDED_ENTRY' && !issue.field))
})
