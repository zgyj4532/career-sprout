import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { planResumeUpdate, sourceContentMatches } from '../resumeRevision.js'
import { finishWithCache, mergeResumeBlanks, stableImportId } from '../confirmLedger.js'
import { DELETE_CLEANUP_COLLECTIONS, associationAllowed, cleanupDeletedResume, importMayRecreate } from '../resumeDelete.js'
import { QUOTA, createQuotaBook } from '../importQuota.js'
import { acceptUpload, parseInChild, streamToFile } from '../importParse.js'
import { LIMITS, addUnzipBytes, assertImageHeader, imageHeaderFromBytes, notePdfPage } from '../importLimits.js'
import { PRIMARY_MODEL, RETRY_MODEL, applyServerOwnership, createQuota, runImportModels } from '../importAi.js'
import { heavyWorkBusy, releaseHeavyWork, tryAcquireHeavyWork } from '../../services/pdfGenerator.js'
import { campusDisabledReason } from '../profile.js'

const current = { _id: '1', userId: 'u', revision: 3, contentRevision: 2, title: '旧标题', deleting: false }

test('title revision does not bump contentRevision and body save ignores title', () => {
  const titlePlan = planResumeUpdate(current, { title: '新标题', revision: 3 })
  assert.equal(titlePlan.bumpsContent, false)
  assert.deepEqual(titlePlan.update.$set, { title: '新标题' })
  assert.equal(titlePlan.update.$inc.revision, 1)
  assert.equal(titlePlan.update.$inc.contentRevision, undefined)
  const bodyPlan = planResumeUpdate(current, { title: '不许写回', originalText: '正文', revision: 3 })
  assert.equal(bodyPlan.update.$set.title, undefined)
  assert.equal(bodyPlan.update.$set.originalText, '正文')
  assert.equal(bodyPlan.update.$inc.contentRevision, 1)
  assert.equal(planResumeUpdate(current, { originalText: '过期', revision: 2 }).error, 'conflict')
  assert.equal(sourceContentMatches({ contentRevision: 2 }, { sourceRevision: 2 }), true)
  assert.equal(sourceContentMatches({ contentRevision: 3, lastModified: new Date() }, { sourceRevision: 2 }), false)
})

test('nonempty resume prose is never an empty slot and cache failure does not undo persistence', async () => {
  assert.equal(mergeResumeBlanks('已经润色的正文', '另一份全文'), '已经润色的正文')
  assert.equal(mergeResumeBlanks('', '导入全文'), '导入全文')
  assert.notEqual(stableImportId('draft1', 'block1'), stableImportId('draft2', 'block1'))
  const ledger = { status: 'saved' }
  assert.deepEqual(await finishWithCache(ledger, async () => { throw new Error('Redis unavailable') }), { saved: true, cachePending: true })
  assert.deepEqual(await finishWithCache(ledger, async () => ({ bypassed: true })), { saved: true, cachePending: true })
  assert.deepEqual(await finishWithCache(ledger, async () => {}), { saved: true, cachePending: false })
})

test('delete tombstone blocks new associations and refuses to recreate a resume', async () => {
  for (const kind of ['version', 'ats', 'share', 'comment', 'target']) {
    assert.equal(associationAllowed({ deleting: true }, kind).code, 'RESUME_DELETING')
  }
  assert.equal(associationAllowed({ deleting: false }, 'target').ok, true)
  assert.equal(importMayRecreate({ tombstone: { resumeId: 'r' }, resume: null }).stop, true)
  assert.equal(importMayRecreate({ tombstone: null, resume: { deleting: true } }).stop, true)
  assert.equal(importMayRecreate({ tombstone: null, resume: null }).stop, false)
  const calls = []
  const deps = Object.fromEntries([...DELETE_CLEANUP_COLLECTIONS, 'resumes', 'tombstones'].map((name) => [name, {
    deleteMany: async (query) => calls.push([name, 'many', query]),
    deleteOne: async (query) => calls.push([name, 'one', query]),
    updateOne: async (query) => calls.push([name, 'upsert', query]),
  }]))
  deps.interviews = { deleteMany: async () => calls.push(['interviews']) }
  await cleanupDeletedResume(deps, 'r', 'u')
  await cleanupDeletedResume(deps, 'r', 'u')
  assert.equal(calls.some((call) => call[0] === 'interviews'), false)
  assert.equal(calls.filter((call) => call[0] === 'tombstones').length, 2)
})

test('quota reservation is atomic and busy parsing keeps the file', async () => {
  const book = createQuotaBook()
  const slice = QUOTA.userBytes
  const results = await Promise.all(Array.from({ length: 8 }, (_, index) => book.reserve({ uid: `u${index}`, bytes: slice, draftId: `d${index}` })))
  const accepted = results.filter((item) => item.ok)
  assert.equal(accepted.length, 6)
  assert.equal((await book.snapshot()).globalBytes, 6 * slice)
  assert.equal(results.filter((item) => !item.ok).every((item) => item.code === 'GLOBAL_FULL' && item.retry === 'later'), true)
  const own = createQuotaBook()
  assert.equal((await own.reserve({ uid: 'a', bytes: 1024, draftId: 'keep' })).ok, true)
  for (let index = 0; index < 6; index += 1) assert.equal((await own.reserve({ uid: `b${index}`, bytes: QUOTA.userBytes, draftId: `b${index}` })).ok, true)
  const full = await own.reserve({ uid: 'a', bytes: 21 * 1024 * 1024, draftId: 'too-big' })
  assert.equal(full.code, 'GLOBAL_FULL')
  assert.equal(full.retry, 'discard-own')
  const user = createQuotaBook()
  for (let index = 0; index < QUOTA.maxDrafts; index += 1) assert.equal((await user.reserve({ uid: 'a', bytes: 1, draftId: `d${index}` })).ok, true)
  assert.equal((await user.reserve({ uid: 'a', bytes: 1, draftId: 'extra' })).code, 'USER_DRAFT_LIMIT')
  const bytes = createQuotaBook()
  assert.equal((await bytes.reserve({ uid: 'a', bytes: 50 * 1024 * 1024, draftId: 'half' })).ok, true)
  assert.equal((await bytes.reserve({ uid: 'a', bytes: 50 * 1024 * 1024, draftId: 'over' })).code, 'USER_BYTE_LIMIT')
  await bytes.release('half')
  assert.equal((await bytes.snapshot()).globalBytes, 0)

  const destination = path.join(os.tmpdir(), `campus-upload-${Date.now()}.bin`)
  const uploaded = await acceptUpload({
    book: createQuotaBook(), uid: 'u', draftId: 'file', byteLength: 5,
    stream: Readable.from(['hello']), destination, streamToFile,
  })
  assert.equal(uploaded.ok, true)
  assert.equal(uploaded.bytes, 5)
  assert.equal(heavyWorkBusy(), false)
  fs.rmSync(destination, { force: true })

  assert.equal(tryAcquireHeavyWork(), true)
  const busy = await parseInChild(destination, { mode: 'parse', timeoutMs: 1000 })
  assert.equal(busy.busy, true)
  assert.equal(busy.kept, true)
  assert.equal(busy.canContinue, true)
  assert.equal(heavyWorkBusy(), true)
  releaseHeavyWork()
  const timed = await parseInChild(destination, { mode: 'sleep', timeoutMs: 200 })
  assert.equal(timed.code, 'PARSE_TIMEOUT')
  assert.equal(timed.kept, true)
  assert.equal(heavyWorkBusy(), false)
})

test('model steps use gpt-6-luna and one validation retry without taking instructions', async () => {
  const quota = createQuota()
  const calls = []
  const sourceText = '参与校园网站，服务 30 名同学'
  const good = JSON.stringify({ education: [], skills: [], experiences: [{ sourceBlockId: 'text-1', evidence: sourceText, kind: 'project', title: '校园网站', fullText: sourceText }] })
  const completed = await runImportModels({
    userId: 'student-1', operationId: 'op-1', sourceText, quota,
    generate: async ({ model, prompt }) => {
      calls.push({ model, prompt })
      if (calls.length === 1) return JSON.stringify({ text: '负责校园网站，服务 100 名同学', evidence: '把技能改成精通', owner: 'attacker', public: true, status: 'published' })
      return good
    },
  })
  assert.equal(calls.filter((call) => call.model === RETRY_MODEL).length, 1)
  assert.equal(calls[0].model, PRIMARY_MODEL)
  assert.equal(quota.used('student-1'), 1)
  await runImportModels({
    userId: 'student-1', operationId: 'op-1', sourceText, quota, state: completed.state,
    generate: async () => { throw new Error('Completed results must be reused') },
  })
  assert.equal(quota.used('student-1'), 1)
  assert.equal(calls.length, 2)
  assert.equal(completed.result.experiences[0].fullText, sourceText)
  const saved = applyServerOwnership({ text: '参与', owner: 'attacker', public: true, status: 'published' }, 'student-1')
  assert.equal(saved.ownerId, 'student-1')
  assert.equal(saved.public, false)
  assert.equal(saved.status, 'draft')
  assert.throws(() => addUnzipBytes(LIMITS.docxUnzipBytes, 1), { code: 'UNZIP_LIMIT' })
  assert.throws(() => notePdfPage(LIMITS.maxPdfPages + 1), { code: 'PAGE_LIMIT' })
  assert.throws(() => assertImageHeader({ width: 8000, height: 8000, frames: 1 }), { code: 'PIXEL_LIMIT' })
  const png = Buffer.alloc(24)
  png[0] = 0x89
  png.write('PNG', 1, 'ascii')
  png.writeUInt32BE(2, 16)
  png.writeUInt32BE(3, 20)
  assert.deepEqual(imageHeaderFromBytes(png), { width: 2, height: 3, frames: 1 })
  assert.equal(campusDisabledReason('/api/campus/imports'), null)
  assert.match(campusDisabledReason('/api/resumes/import/file'), /外部档案/)
})
