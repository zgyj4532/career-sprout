import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { accessSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { repoRoot, parseEnv } from './lib.mjs'
import { checkPersistence, requestJson } from './check-persist.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const origin = 'http://127.0.0.1:5173'
const requireBackend = createRequire(path.join(repoRoot, 'backend/package.json'))
const stages = ['runtime', 'infrastructure', 'backend-start', 'health', 'disabled-payments', 'remote-host-rejected', 'foreign-origin-rejected', 'invalid-resume-rejected', 'resume-create', 'resume-edit', 'resume-read', 'pdf-download', 'backend-stop', 'backend-restart', 'restart-persistence']

class SmokeError extends Error {
  constructor(code, status = 'FAIL') { super(code); this.code = code; this.status = status }
}

export function requestForeignHost(base, signal) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(new URL('/api/resumes', base), {
      method: 'GET',
      headers: { host: '10.0.0.8', 'x-forwarded-host': 'localhost', 'x-forwarded-for': '127.0.0.1' },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    }, (response) => {
      response.on('error', reject)
      response.resume()
      response.once('end', () => resolve({ status: response.statusCode }))
    })
    request.once('error', reject)
    request.end()
  })
}

export function isolatedDatabaseUri(source, runId) {
  if (!/^campus_smoke_[a-f0-9]{32}$/.test(runId)) throw new SmokeError('INVALID_RUN_ID')
  const url = new URL(source)
  // Never send even a preflight request to a cloud/developer-selected remote service.
  if (url.protocol !== 'mongodb:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new SmokeError('LOCAL_MONGODB_REQUIRED', 'BLOCKED_EXTERNAL')
  url.pathname = `/${runId}`
  return url.toString()
}

export function backendEnvironment(parent, { runId, directory, mongoUri, redisUrl }) {
  const env = {}
  for (const key of ['PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'LD_LIBRARY_PATH', 'PUPPETEER_CACHE_DIR']) {
    if (parent[key] !== undefined) env[key] = parent[key]
  }
  return { ...env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${env.PATH || ''}`,
    APP_PROFILE: 'campus-local', VITE_APP_PROFILE: 'campus-local', NODE_ENV: 'development',
    HOST: '127.0.0.1', PORT: '0', FRONTEND_URL: origin,
    MONGODB_URI: mongoUri, REDIS_URL: redisUrl, DEV_BYPASS_AUTH: 'true', DEV_USER_UID: runId,
    DEV_USER_EMAIL: 'smoke@localhost', CLERK_SECRET_KEY: '', CAMPUS_TEACHER_UIDS: '',
    CAMPUS_IMPORT_DIR: path.join(directory, 'imports'), CAMPUS_LOG_DIR: path.join(directory, 'logs'),
    CAMPUS_SMOKE_RUN_ID: runId, ENABLE_GITHUB_SYNC_CRON: 'false', BULL_BOARD_ENABLED: 'false',
  }
}

export function trackChild(child) {
  const state = { child, outcome: null }
  state.closed = new Promise((resolve) => {
    child.once('error', (error) => { state.spawnError = error.code || 'SPAWN_ERROR' })
    child.once('close', (code, signal) => { state.outcome = { code, signal }; resolve(state.outcome) })
  })
  return state
}

export async function stopBackend(state) {
  if (!state) return { stopped: true, forced: false }
  if (state.outcome) return { stopped: true, forced: false, ...state.outcome }
  state.child.kill('SIGTERM')
  let timer
  const exited = await Promise.race([state.closed.then(() => true), new Promise((resolve) => { timer = setTimeout(() => resolve(false), 5000) })])
  clearTimeout(timer)
  if (!exited) {
    state.child.kill('SIGKILL')
    const killed = await Promise.race([state.closed.then(() => true), new Promise((resolve) => { timer = setTimeout(() => resolve(false), 5000) })])
    clearTimeout(timer)
    if (!killed) throw new SmokeError('OWNED_CHILD_DID_NOT_STOP')
  }
  return { stopped: true, forced: !exited, ...state.outcome }
}

export async function cleanupOwnedRun(resources) {
  const results = []
  let stopped = false
  try {
    const detail = await stopBackend(resources.backend)
    stopped = true
    results.push({ name: 'cleanup-backend', status: detail.forced || detail.code != null && detail.code !== 0 || detail.signal ? 'FAIL' : 'PASS', detail })
  }
  catch { results.push({ name: 'cleanup-backend', status: 'FAIL', code: 'OWNED_CHILD_DID_NOT_STOP' }) }
  if (resources.mongo) {
    try {
      if (!stopped) throw new SmokeError('CHILD_STILL_RUNNING')
      if (resources.databaseTouched) {
        if (!/^campus_smoke_[a-f0-9]{32}$/.test(resources.runId || '')) throw new SmokeError('INVALID_RUN_ID')
        const db = resources.mongo.db(resources.runId)
        const owner = await db.collection('_smoke_owner').findOne({ _id: resources.runId })
        if (owner?.uid !== resources.runId) throw new SmokeError('DATABASE_OWNERSHIP_MISMATCH')
        await db.dropDatabase()
      }
      results.push({ name: 'cleanup-database', status: 'PASS', detail: resources.databaseTouched ? 'Owned database dropped' : 'No database writes attempted' })
    } catch { results.push({ name: 'cleanup-database', status: 'FAIL', code: 'DATABASE_CLEANUP_FAILED' }) }
    finally { try { await resources.mongo.close() } catch { results.push({ name: 'cleanup-mongo-client', status: 'FAIL' }) } }
  }
  if (resources.directory) {
    try {
      if (!stopped || readFileSync(path.join(resources.directory, 'owner'), 'utf8') !== resources.runId) throw new SmokeError('FILE_OWNERSHIP_MISMATCH')
      rmSync(resources.directory, { recursive: true })
      results.push({ name: 'cleanup-files', status: 'PASS' })
    } catch { results.push({ name: 'cleanup-files', status: 'FAIL', code: 'OWNED_FILES_CLEANUP_FAILED' }) }
  }
  return results
}

async function launchBackend(resources, env, signal) {
  signal.throwIfAborted()
  const child = spawn(process.execPath, [path.join(here, 'smoke-backend.mjs')], {
    cwd: resources.directory, env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  })
  const state = trackChild(child)
  resources.backend = state
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new SmokeError('BACKEND_START_TIMEOUT')), 20000)
    const abort = () => finish(new SmokeError('INTERRUPTED'))
    const closed = () => finish(new SmokeError(state.spawnError || 'BACKEND_EXITED_BEFORE_READY'))
    const message = (value) => {
      if (value?.type === 'failed') finish(new SmokeError(value.code))
      else if (value?.type === 'ready') finish(null, value)
    }
    function finish(error, value) {
      clearTimeout(timer); signal.removeEventListener('abort', abort)
      child.removeListener('message', message); child.removeListener('close', closed)
      if (error) reject(error); else resolve(value)
    }
    signal.addEventListener('abort', abort, { once: true })
    child.on('message', message); child.once('close', closed)
  })
  if (ready.runId !== resources.runId || ready.uid !== resources.runId || ready.database !== resources.runId ||
      ready.pid !== child.pid || ready.execPath !== process.execPath || ready.node !== process.version ||
      ready.address?.address !== '127.0.0.1' || !Number.isInteger(ready.address.port) || ready.address.port < 1) {
    throw new SmokeError('BACKEND_IDENTITY_MISMATCH')
  }
  resources.base = `http://127.0.0.1:${ready.address.port}`
  return { pid: ready.pid, base: resources.base, node: ready.node, execPath: ready.execPath }
}

export async function runSmoke({ reportFile, pdf = false } = {}) {
  const runId = `campus_smoke_${randomUUID().replaceAll('-', '')}`
  reportFile ||= path.join(repoRoot, 'docs/evidence/phase1', `${runId}.json`)
  const resources = { runId }
  const report = { schemaVersion: 1, runId, uid: runId, database: runId, startedAt: new Date().toISOString(),
    node: process.version, execPath: process.execPath, status: 'RUNNING', results: [],
    boundaries: { formalClerk: 'NOT_RUN', externalAI: 'NOT_RUN', ASR: 'NOT_RUN', pdfVisualReadability: 'NOT_RUN', identity: 'isolated synthetic local bypass, not formal authentication' },
    redisScope: 'PING only; selected auth/resume/disabled routes do not invoke cache or AI rate-limit writers. No shared Redis keys or volumes are deleted.',
  }
  const controller = new AbortController()
  let interrupted
  const interrupt = (signal) => { interrupted ||= signal; controller.abort() }
  const onInt = () => interrupt('SIGINT')
  const onTerm = () => interrupt('SIGTERM')
  process.on('SIGINT', onInt); process.on('SIGTERM', onTerm)
  const persist = () => { mkdirSync(path.dirname(reportFile), { recursive: true }); writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }) }
  const record = (name, status, detail) => { report.results.push({ name, status, detail }); persist() }
  let current = 'runtime'
  const step = async (name, operation) => { current = name; controller.signal.throwIfAborted(); const detail = await operation(); record(name, 'PASS', detail) }
  const expect = (condition, code, observedStatus) => {
    if (!condition) { const error = new SmokeError(code); error.observedStatus = observedStatus; throw error }
  }
  const api = (pathname, options = {}) => requestJson(resources.base, pathname, {
    signal: controller.signal, ...options,
    headers: { origin, 'content-type': 'application/json', ...options.headers },
  })
  try {
    persist()
    await step('runtime', async () => { if (process.versions.node.split('.')[0] !== '24') throw new SmokeError('NODE_24_REQUIRED', 'BLOCKED_EXTERNAL'); return { execPath: process.execPath, node: process.version } })
    resources.directory = mkdtempSync(path.join(tmpdir(), `${runId}-`))
    writeFileSync(path.join(resources.directory, 'owner'), runId, { mode: 0o600 })
    current = 'infrastructure'
    const defaults = parseEnv(path.join(repoRoot, 'config/campus-local.backend.env'))
    const local = parseEnv(path.join(repoRoot, 'backend/.env'))
    const mongoUri = isolatedDatabaseUri(process.env.MONGODB_URI || local.MONGODB_URI || defaults.MONGODB_URI, runId)
    const redisUrl = process.env.REDIS_URL || local.REDIS_URL || defaults.REDIS_URL
    const redisAddress = new URL(redisUrl)
    if (!['redis:', 'rediss:'].includes(redisAddress.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(redisAddress.hostname)) throw new SmokeError('LOCAL_REDIS_REQUIRED', 'BLOCKED_EXTERNAL')
    await step('infrastructure', async () => {
      let Redis, MongoClient
      try { ({ MongoClient } = requireBackend('mongoose').mongo); Redis = requireBackend('ioredis') }
      catch { throw new SmokeError('BACKEND_DEPENDENCIES_MISSING', 'BLOCKED_EXTERNAL') }
      resources.mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000, socketTimeoutMS: 3000, timeoutMS: 5000 })
      const redis = new Redis(redisUrl, { lazyConnect: true, connectTimeout: 3000, commandTimeout: 3000, retryStrategy: () => null, maxRetriesPerRequest: 0 })
      redis.on('error', () => {})
      try { await resources.mongo.connect(); await resources.mongo.db(runId).command({ ping: 1 }); await redis.connect(); expect(await redis.ping() === 'PONG', 'REDIS_PING_FAILED') }
      catch { throw new SmokeError('MONGO_OR_REDIS_UNAVAILABLE', 'BLOCKED_EXTERNAL') }
      finally { redis.disconnect() }
      controller.signal.throwIfAborted()
      const db = resources.mongo.db(runId)
      expect((await db.listCollections().toArray()).length === 0, 'DATABASE_ALREADY_EXISTS')
      resources.databaseTouched = true
      await db.collection('_smoke_owner').insertOne({ _id: runId, uid: runId })
      return { mongo: 'reachable', redis: 'reachable', database: runId }
    })
    const env = backendEnvironment(process.env, { runId, directory: resources.directory, mongoUri, redisUrl })
    await step('backend-start', () => launchBackend(resources, env, controller.signal))
    await step('health', async () => {
      const identity = await api('/api/campus/auth/status')
      expect(identity.status === 200 && identity.json?.data?.mode === 'local' && identity.json.data.user?.uid === runId, 'API_IDENTITY_MISMATCH')
      const health = await api('/health')
      expect(health.status === 200 && health.json?.database?.ok && health.json?.redis?.ok && health.json?.profile === 'campus-local', 'HEALTH_FAILED')
      return { database: true, redis: true, identity: runId }
    })
    await step('disabled-payments', async () => { const r = await api('/api/payments'); expect(r.status === 404 && r.json?.code === 'CAMPUS_DISABLED', 'DISABLED_BOUNDARY_FAILED'); return { status: r.status } })
    await step('remote-host-rejected', async () => {
      const response = await requestForeignHost(resources.base, controller.signal)
      expect(response.status === 401, 'HOST_BOUNDARY_FAILED', response.status)
      return { status: response.status }
    })
    await step('foreign-origin-rejected', async () => { const r = await api('/api/resumes', { method: 'POST', headers: { origin: 'https://example.invalid' }, body: JSON.stringify({ originalText: 'must not be saved' }) }); expect(r.status === 401, 'ORIGIN_BOUNDARY_FAILED'); return { status: r.status } })
    await step('invalid-resume-rejected', async () => { const r = await api('/api/resumes', { method: 'POST', body: JSON.stringify({ originalText: '' }) }); expect(r.status === 400 && r.json?.code === 'VALIDATION_FAILED', 'VALIDATION_BOUNDARY_FAILED'); return { status: r.status } })
    const marker = `校园隔离验收 ${runId}`
    let evidence
    await step('resume-create', async () => {
      const r = await api('/api/resumes', { method: 'POST', body: JSON.stringify({ title: '隔离合成简历', jobRole: '软件开发实习生', originalText: `# 测试同学\n\n${marker}\n\n合成测试数据，不是真人简历。` }) })
      expect(r.status === 201 && /^[a-f0-9]{24}$/.test(r.json?.data?.id || '') && r.json.data.userId === runId, 'RESUME_CREATE_FAILED')
      evidence = { runId, uid: runId, database: runId, base: resources.base, resumeId: r.json.data.id, marker, revision: r.json.data.revision }
      return { status: r.status, resumeId: evidence.resumeId }
    })
    await step('resume-edit', async () => {
      evidence.title = '隔离合成简历'
      evidence.originalText = `# 测试同学\n\n${marker}\n\n已通过编辑保存的合成测试数据。`
      const r = await api(`/api/resumes/${evidence.resumeId}`, { method: 'PUT', body: JSON.stringify({ originalText: evidence.originalText, revision: evidence.revision }) })
      expect(r.status === 200 && r.json?.data?.revision === evidence.revision + 1, 'RESUME_EDIT_FAILED')
      evidence.revision = r.json.data.revision
      return { status: r.status, revision: evidence.revision }
    })
    await step('resume-read', async () => { const result = await checkPersistence(evidence, { signal: controller.signal }); expect(result.kept, 'RESUME_READ_FAILED'); return result })
    if (pdf) await step('pdf-download', async () => {
      const puppeteer = requireBackend('puppeteer')
      try { accessSync(puppeteer.executablePath()) } catch { throw new SmokeError('PDF_BROWSER_MISSING', 'BLOCKED_EXTERNAL') }
      const response = await fetch(`${resources.base}/api/resumes/${evidence.resumeId}/download?version=original`, { redirect: 'error', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) })
      const buffer = Buffer.from(await response.arrayBuffer())
      expect(response.status === 200 && response.headers.get('content-type')?.includes('application/pdf') && buffer.subarray(0, 5).toString() === '%PDF-', 'PDF_EXPORT_FAILED')
      return { status: response.status, bytes: buffer.length, visualReadability: 'NOT_RUN' }
    })
    else record('pdf-download', 'NOT_RUN', 'Separate optional export check: --pdf; does not prove Chinese visual readability')
    await step('backend-stop', async () => { const result = await stopBackend(resources.backend); expect(!result.forced && result.code === 0, 'BACKEND_SHUTDOWN_FAILED'); return result })
    await step('backend-restart', async () => { const result = await launchBackend(resources, env, controller.signal); evidence.base = resources.base; return result })
    await step('restart-persistence', async () => { const result = await checkPersistence(evidence, { signal: controller.signal }); expect(result.kept, 'RESTART_PERSISTENCE_FAILED'); return result })
    report.persistence = evidence
  } catch (error) {
    record(current, error.status || 'FAIL', {
      code: interrupted ? 'INTERRUPTED' : error instanceof SmokeError ? error.code : 'SMOKE_OPERATION_FAILED',
      errorType: /^[A-Za-z]{1,60}$/.test(error.name || '') ? error.name : 'Error',
      ...(Number.isInteger(error.observedStatus) ? { observedStatus: error.observedStatus } : {}),
    })
  } finally {
    for (const name of stages) if (!report.results.some((entry) => entry.name === name)) report.results.push({ name, status: 'NOT_RUN', detail: 'Earlier required step did not complete' })
    report.cleanup = await cleanupOwnedRun(resources)
    report.results.push(...report.cleanup)
    process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onTerm)
    report.signal = interrupted || null
    report.finishedAt = new Date().toISOString()
    report.status = interrupted || report.results.some((entry) => entry.status === 'FAIL') ? 'FAIL' : report.results.some((entry) => entry.status === 'BLOCKED_EXTERNAL') ? 'BLOCKED_EXTERNAL' : 'PASS'
    report.exitCode = interrupted === 'SIGINT' ? 130 : interrupted ? 143 : report.status === 'PASS' ? 0 : 1
    persist()
  }
  return { report, reportFile }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    let reportFile, pdf = false
    for (let index = 2; index < process.argv.length; index++) {
      if (process.argv[index] === '--pdf') pdf = true
      else if (process.argv[index] === '--report' && process.argv[index + 1] && !reportFile) reportFile = path.resolve(process.argv[++index])
      else throw new SmokeError('USAGE: smoke-phase1.mjs [--report PATH] [--pdf]')
    }
    const result = await runSmoke({ reportFile, pdf })
    console.log(JSON.stringify({ status: result.report.status, exitCode: result.report.exitCode, runId: result.report.runId, reportFile: result.reportFile }))
    process.exitCode = result.report.exitCode
  } catch {
    console.log(JSON.stringify({ status: 'FAIL', code: 'SMOKE_ARGUMENT_OR_REPORT_WRITE_FAILED' }))
    process.exitCode = 1
  }
}
