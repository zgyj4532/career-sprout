import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import UserProfile from '../../models/UserProfile.model.js'
import Resume from '../../models/Resume.model.js'
import { CampusConfirmLedger, CampusImportDraft, CampusImportQuota, CampusResumeTombstone, CampusStudent } from '../models.js'
import { createQuotaBook, QUOTA } from '../importQuota.js'
import { applyImportStep } from '../confirmLedger.js'
import { duplicateCandidates, freezeImport, reviewedMaterial, renderImportedResume } from '../importSave.js'

let memory, server, directory, uid = 'import-owner', confirmImport, restoreImport, resolveIssues
const originalEnvironment = Object.fromEntries(['NODE_ENV', 'REDIS_URL', 'CAMPUS_IMPORT_DIR'].map((key) => [key, process.env[key]]))
const models = { profile: UserProfile, student: CampusStudent, resume: Resume }
const source = {
  name: '测试同学', phone: '123456', email: 'student@example.invalid', summary: '已整理 1 段教育、1 段经历和 1 个技能',
  education: [{ institution: '测试大学', field: '计算机', degree: '本科', dateText: '2022.09—至今', precision: 'month', current: true, fullText: '2022.09—至今 测试大学 计算机 本科', sourceBlockId: 'page-1' }],
  experiences: [{ kind: 'project', title: '校园项目', dateText: '2025.01', precision: 'month', fullText: '参与校园项目，保留全文。'.repeat(300), brief: '参与校园项目。', sourceBlockId: 'page-1' }],
  skills: [{ name: 'SQL', evidence: 'SQL' }], otherMaterials: '校级奖项与证书原文',
}

before(async () => {
  process.env.NODE_ENV = 'test'
  process.env.REDIS_URL = ''
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'campus-import-persistence-'))
  process.env.CAMPUS_IMPORT_DIR = directory
  const cache = await import('../../middleware/cacheLayer.js')
  await cache.closeCacheConnection()
  ;({ confirmImport, restoreImport, resolveIssues } = await import('../importConfirm.js'))
  const { default: imports } = await import('../imports.js')
  const { default: growth } = await import('../growth.js')
  const { globalErrorHandler } = await import('../../middleware/globalErrorHandler.js')
  memory = await MongoMemoryServer.create()
  await mongoose.connect(memory.getUri())
  await Promise.all([CampusImportQuota.init(), CampusImportDraft.init(), CampusConfirmLedger.init(), UserProfile.init(), CampusStudent.init()])
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { req.user = { uid }; next() })
  app.use(imports, growth, globalErrorHandler)
  server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
})
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  await (await import('../../middleware/cacheLayer.js')).closeCacheConnection()
  await mongoose.disconnect()
  if (memory) await memory.stop()
  if (directory) await fs.rm(directory, { recursive: true, force: true })
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})
async function draftFor(userId) {
  const draft = await CampusImportDraft.create({ userId, status: 'ready', filename: '测试简历.docx', result: source, blocks: [{ id: 'page-1', text: '保留原文', status: 'read' }], uploadComplete: true, parseComplete: true })
  draft.filePath = path.join(directory, `${draft.id}.docx`)
  await fs.writeFile(draft.filePath, 'original-file')
  draft.bytes = 13
  await draft.save()
  return draft
}
async function call(route, method = 'GET', body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return { response, data: response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text() }
}

test('real confirm writes a resume, keeps originals, retries frozen content and restores safely', async () => {
  uid = 'roundtrip-owner'
  const draft = await draftFor(uid)
  const first = await call(`/imports/${draft.id}/confirm`, 'POST', { resumeTitle: '已确认的标题' })
  assert.equal(first.response.status, 200)
  assert.equal(first.data.saved, true)
  const resumeId = first.data.data.resumeId
  const resume = await Resume.findById(resumeId).lean()
  assert.equal(resume.title, '已确认的标题')
  assert.match(resume.originalText, /2022.09—至今/)
  assert.doesNotMatch(resume.originalText, /已整理 1 段/)
  assert.ok(resume.originalText.includes(source.experiences[0].fullText))
  assert.deepEqual(resume.preferences.skills, ['SQL'])
  const profile = await UserProfile.findOne({ uid }).select('+phone').lean()
  assert.equal(profile.phone, source.phone)
  assert.equal(profile.education[0].dateText, '2022.09—至今')
  assert.equal((await CampusStudent.findOne({ uid })).experiences[0].fullText, source.experiences[0].fullText)
  const retry = await call(`/imports/${draft.id}/confirm`, 'POST', { result: { ...source, name: '不能替换冻结内容' } })
  assert.equal(retry.response.status, 200)
  assert.equal(await Resume.countDocuments({ userId: uid }), 1)
  assert.equal((await UserProfile.findOne({ uid })).displayName, source.name)
  assert.equal((await call(`/imports/${draft.id}/source`)).data, 'original-file')
  const restored = await call(`/imports/${draft.id}/restore`, 'POST')
  assert.equal(restored.response.status, 200)
  assert.equal(restored.data.data.status, 'restored')
  assert.equal(await Resume.countDocuments({ userId: uid }), 0)
  assert.equal(await UserProfile.countDocuments({ uid }), 0)
  assert.ok(await CampusResumeTombstone.exists({ resumeId }))
  assert.equal((await call(`/imports/${draft.id}/confirm`, 'POST')).response.status, 409)
})

test('duplicate candidates are explicit, existing content survives, and later manual edits block restore', async () => {
  const userId = 'existing-owner'
  const existingProfile = await UserProfile.create({ uid: userId, displayName: '原有姓名', bio: '原有简介', skills: ['Java'], education: [{ institution: '测试大学', degree: '博士', field: '数学' }], otherMaterials: '原有证书' })
  await CampusStudent.create({ uid: userId, interests: ['保持兴趣'], experiences: [{ id: 'old', title: '校园项目', fullText: '已经润色的原有全文' }] })
  const resume = await Resume.create({ userId, originalText: '已有正文不覆盖', enhancedText: '已润色正文不覆盖', title: '原有标题', preferences: { skills: ['Java'] } })
  const draft = await draftFor(userId)
  await assert.rejects(() => confirmImport(draft), { code: 'IMPORT_DECISIONS_REQUIRED' })
  const material = reviewedMaterial(source, undefined, draft.id)
  const candidates = duplicateCandidates(material, existingProfile, await CampusStudent.findOne({ uid: userId }).lean(), draft.id)
  const decisions = Object.fromEntries(candidates.map((candidate) => [candidate.id, 'add']))
  await confirmImport(draft, { decisions, resumeId: resume.id })
  const saved = await UserProfile.findOne({ uid: userId }).lean()
  assert.equal(saved.displayName, '原有姓名')
  assert.equal(saved.bio, '原有简介')
  assert.equal(saved.education.length, 2)
  assert.deepEqual(saved.skills, ['Java', 'SQL'])
  assert.match(saved.otherMaterials, /原有证书/)
  assert.equal((await Resume.findById(resume.id)).originalText, '已有正文不覆盖')
  assert.equal((await Resume.findById(resume.id)).enhancedText, '已润色正文不覆盖')
  assert.equal(await Resume.countDocuments({ userId }), 1)
  await UserProfile.updateOne({ uid: userId }, { $set: { bio: '之后手改', updatedAt: new Date(Date.now() + 1000) } }, { timestamps: false })
  await assert.rejects(() => restoreImport(draft), { code: 'RESTORE_CONFLICT' })
  assert.equal((await UserProfile.findOne({ uid: userId })).bio, '之后手改')
  assert.equal((await CampusStudent.findOne({ uid: userId })).experiences.length, 2)
  const failedRestore = await CampusConfirmLedger.findOne({ draftId: draft._id }).lean()
  assert.equal(failedRestore.status, 'saved')
  assert.equal(failedRestore.restoreStarted, false)
  assert.equal(failedRestore.restoredAt, null)
  uid = userId
  assert.equal((await call(`/imports/${draft.id}`)).data.data.status, 'saved')
  assert.equal((await call(`/imports/${draft.id}`, 'DELETE')).response.status, 200)
})

test('expired confirmation recognizes committed writes, repairs missing targets, and never resurrects deleted resume', async () => {
  const userId = 'crash-owner'
  const draft = await draftFor(userId)
  const material = reviewedMaterial(source, undefined, draft.id)
  const frozen = freezeImport({ models, draft, profile: null, student: null, resume: null, material })
  const resumePlan = frozen.plans.find((plan) => plan.kind === 'resume')
  await applyImportStep(Resume, resumePlan, draft.id)
  await CampusConfirmLedger.create({ userId, draftId: draft._id, frozen, status: 'saving', leaseUntil: new Date(0), steps: { profile: { targetId: frozen.plans[0].id, recordExists: true } } })
  await confirmImport(draft, { result: { ...source, name: '新的未冻结内容' } })
  assert.equal(await Resume.countDocuments({ userId }), 1)
  assert.equal((await UserProfile.findOne({ uid: userId })).displayName, source.name)
  await CampusConfirmLedger.updateOne({ draftId: draft._id }, { $set: { status: 'unknown', leaseUntil: null } })
  await CampusResumeTombstone.create({ userId, resumeId: resumePlan.id })
  await Resume.deleteOne({ _id: resumePlan.id })
  await assert.rejects(() => confirmImport(draft), { code: 'RESUME_DELETED' })
  assert.equal(await Resume.countDocuments({ userId }), 0)
  assert.equal((await CampusConfirmLedger.findOne({ draftId: draft._id })).status, 'unknown')
})

test('lease exclusion, owner isolation, history pagination, source ownership and cleanup are enforced', async () => {
  uid = 'security-owner'
  const draft = await draftFor(uid)
  await CampusImportDraft.updateOne({ _id: draft._id }, { $set: { leaseUntil: new Date(Date.now() + 60000), leaseToken: 'other-request' } })
  assert.equal((await call(`/imports/${draft.id}/confirm`, 'POST')).response.status, 409)
  uid = 'other-owner'
  assert.equal((await call(`/imports/${draft.id}/source`)).response.status, 404)
  assert.equal((await call(`/imports/${draft.id}`, 'DELETE')).response.status, 404)
  uid = 'security-owner'
  await CampusImportDraft.updateOne({ _id: draft._id }, { $set: { leaseUntil: null } })
  const list = await call('/imports?page=1&limit=1')
  assert.equal(list.data.data.items.length, 1)
  assert.equal(list.data.data.total, 1)
  assert.equal((await call(`/imports/${draft.id}`, 'DELETE')).response.status, 200)
  await assert.rejects(() => fs.stat(draft.filePath), { code: 'ENOENT' })
})

test('known preflight conflict can be discarded or explicitly reviewed again without any partial writes', async () => {
  for (const action of ['discard', 'review']) {
    uid = `preflight-${action}`
    const profile = await UserProfile.create({ uid, bio: '冻结前简介' })
    const draft = await draftFor(uid)
    const frozen = freezeImport({ models, draft, profile: profile.toObject(), student: null, resume: null, material: reviewedMaterial(source, undefined, draft.id) })
    await CampusConfirmLedger.create({ userId: uid, draftId: draft._id, frozen, status: 'pending', steps: {} })
    await UserProfile.updateOne({ uid }, { $set: { bio: '其他页面刚修改', updatedAt: new Date(Date.now() + 1000) } }, { timestamps: false })
    assert.equal((await call(`/imports/${draft.id}/confirm`, 'POST')).response.status, 409)
    const ledger = await CampusConfirmLedger.findOne({ draftId: draft._id }).lean()
    assert.equal(ledger.status, 'conflicted')
    assert.equal(ledger.writeStarted, false)
    assert.equal(await Resume.countDocuments({ userId: uid }), 0)
    assert.equal(await CampusStudent.countDocuments({ uid }), 0)
    const view = (await call(`/imports/${draft.id}`)).data.data
    assert.equal(view.frozen, false)
    assert.equal(view.status, 'review')
    assert.equal((await call(`/imports/${draft.id}/confirm`, 'POST')).data.code, 'IMPORT_REVIEW_REQUIRED')
    if (action === 'discard') {
      assert.equal((await call(`/imports/${draft.id}`, 'DELETE')).response.status, 200)
      assert.equal(await CampusConfirmLedger.countDocuments({ draftId: draft._id }), 0)
    } else {
      const saved = await call(`/imports/${draft.id}/confirm`, 'POST', { result: { ...source, name: '重新核对的姓名' } })
      assert.equal(saved.response.status, 200)
      assert.equal(saved.data.saved, true)
      assert.equal((await UserProfile.findOne({ uid })).bio, '其他页面刚修改')
      assert.equal((await UserProfile.findOne({ uid })).displayName, '重新核对的姓名')
      assert.equal(await Resume.countDocuments({ userId: uid }), 1)
    }
  }
})

test('skill labels use ordinary editor normalization and preserve existing spelling and assessments', async () => {
  uid = 'normalized-skills-owner'
  await UserProfile.create({ uid, skills: ['SQL', 'Machine Learning'] })
  await CampusStudent.create({ uid, skillAssessments: [{ name: 'SQL', level: 2, evidence: '原有证据' }, { name: 'Machine Learning', level: 1, evidence: '原有课程' }] })
  const draft = await draftFor(uid)
  const result = { ...source, skills: [
    { name: 'sql', evidence: '导入 SQL' }, { name: ' ＳＱＬ ', evidence: '全角重复' },
    { name: 'machine   learning', evidence: '空白重复' },
    { name: 'Python', evidence: '项目依据' }, { name: ' ｐｙｔｈｏｎ ', evidence: '全角重复' },
  ] }
  const saved = await call(`/imports/${draft.id}/confirm`, 'POST', { result })
  assert.equal(saved.response.status, 200)
  assert.deepEqual(saved.data.data.result.skills.map((item) => item.name), ['SQL', 'Machine Learning', 'Python'])
  const profile = await UserProfile.findOne({ uid }).lean()
  assert.deepEqual(profile.skills, ['SQL', 'Machine Learning', 'Python'])
  const student = await CampusStudent.findOne({ uid }).lean()
  assert.deepEqual(student.skillAssessments.map((item) => item.name), ['SQL', 'Machine Learning', 'Python'])
  assert.equal(student.skillAssessments[0].level, 2)
  assert.equal(student.skillAssessments[0].evidence, '原有证据')
  assert.equal(student.skillAssessments[2].level, undefined)
  const edited = await call('/me', 'PUT', { skillAssessments: student.skillAssessments })
  assert.equal(edited.response.status, 200)
  assert.deepEqual(edited.data.data.student.skillAssessments.map((item) => item.name), ['SQL', 'Machine Learning', 'Python'])
})

test('continue projects hydrated Mongo blocks and reuses received model output without another provider call', async () => {
  uid = 'hydrated-checkpoint-owner'
  const draft = await draftFor(uid)
  draft.status = 'failed'
  draft.errorCode = '25'
  draft.result = null
  draft.modelState = { calls: [{ model: 'gpt-6-luna', status: 'received', raw: JSON.stringify({ education: [], experiences: [], skills: [], transcription: [] }) }] }
  await draft.save()
  const resumed = await call(`/imports/${draft.id}/continue`, 'POST')
  assert.equal(resumed.response.status, 200)
  assert.ok(['ready', 'review'].includes(resumed.data.data.status))
  assert.equal(resumed.data.data.result.otherMaterials, '保留原文')
  assert.equal(resumed.data.data.code, null)
  const persisted = await CampusImportDraft.findById(draft._id).lean()
  assert.equal(persisted.modelState.calls.length, 1)
  assert.equal(persisted.modelState.calls[0].status, 'completed')
  assert.equal(persisted.modelState.result.blocks[0].text, '保留原文')
  assert.equal(persisted.blocks[0].text, '保留原文')
})

test('skipping salvaged unsupported fields preserves grounded same-page entries and original leftovers', async () => {
  uid = 'salvage-issues-owner'
  const draft = await draftFor(uid)
  draft.status = 'review'
  draft.result = { ...source, name: '', education: [{ ...source.education[0], degree: '' }], experiences: [{ ...source.experiences[0], titleIsSourceExcerpt: true }] }
  draft.issues = [
    { id: 'removed', code: 'UNGROUNDED_ENTRY', blockId: 'page-1' },
    { id: 'degree', code: 'UNGROUNDED_FIELD', blockId: 'page-1', field: 'education.0.degree' },
    { id: 'name', code: 'UNGROUNDED_FIELD', field: 'name' },
  ]
  await draft.save()
  const material = reviewedMaterial(draft.result, undefined, draft.id)
  material.name = '尚未确认的修改'
  material.education[0].degree = '尚未确认的学位'
  const skipped = resolveIssues(draft, material, {}, true)
  assert.equal(skipped.name, '')
  assert.equal(skipped.education[0].degree, '')
  assert.equal(skipped.experiences.length, 1)
  assert.equal(skipped.otherMaterials, source.otherMaterials)
  const confirmed = resolveIssues(draft, material, { removed: 'confirmed', degree: 'confirmed', name: 'confirmed' }, false)
  assert.equal(confirmed.education[0].degree, '尚未确认的学位')
  const saved = await call(`/imports/${draft.id}/confirm`, 'POST', { result: material, skipIssues: true })
  assert.equal(saved.response.status, 200)
  const profile = await UserProfile.findOne({ uid }).lean()
  assert.equal(profile.displayName, '')
  assert.equal(profile.education.length, 1)
  assert.equal(profile.education[0].degree, '')
  const student = await CampusStudent.findOne({ uid }).lean()
  assert.equal(student.experiences.length, 1)
  assert.equal(student.experiences[0].titleIsSourceExcerpt, true)
  const edited = await call('/me', 'PUT', { experiences: student.experiences })
  assert.equal(edited.response.status, 200)
  assert.equal(edited.data.data.student.experiences[0].titleIsSourceExcerpt, true)
})

test('database quota survives new instances and concurrent users never exceed global capacity', async () => {
  await CampusImportQuota.deleteMany({})
  const books = [createQuotaBook(CampusImportQuota), createQuotaBook(CampusImportQuota)]
  const admissions = await Promise.all(Array.from({ length: 8 }, (_, index) => books[index % 2].reserve({ uid: `quota-${index}`, draftId: `quota-${index}`, bytes: QUOTA.userBytes })))
  assert.equal(admissions.filter((entry) => entry.ok).length, 6)
  const restarted = createQuotaBook(CampusImportQuota)
  assert.equal((await restarted.snapshot()).globalBytes, QUOTA.userBytes * 6)
  const acceptedIndex = admissions.findIndex((entry) => entry.ok)
  await restarted.release(`quota-${acceptedIndex}`)
  assert.equal((await books[0].snapshot()).globalBytes, QUOTA.userBytes * 5)
})

test('date skip retains other facts on same page and concise text requires adoption', () => {
  const material = reviewedMaterial(source, undefined, 'draft-reviewed')
  const resolved = resolveIssues({ result: source, issues: [{ id: 'date', code: 'DATE_ASSOCIATION', blockId: 'page-1', field: 'education.0.dateText' }] }, material, {}, true)
  assert.equal(resolved.education.length, 1)
  assert.equal(resolved.experiences.length, 1)
  assert.equal(resolved.education[0].dateText, '')
  assert.ok(renderImportedResume(material).includes(source.experiences[0].fullText))
  material.experiences[0].useConcise = true
  assert.equal(renderImportedResume(material).includes(source.experiences[0].fullText), false)
  assert.ok(renderImportedResume(material).includes(source.experiences[0].brief))
})
