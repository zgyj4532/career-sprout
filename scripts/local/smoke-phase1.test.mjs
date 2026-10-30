import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { backendEnvironment, cleanupOwnedRun, isolatedDatabaseUri, requestForeignHost, stopBackend, trackChild } from './smoke-phase1.mjs'
import { checkPersistence, validatePersistenceEvidence } from './check-persist.mjs'

const runId = `campus_smoke_${'a'.repeat(32)}`
const evidence = { runId, uid: runId, database: runId, base: 'http://127.0.0.1:54321', resumeId: 'b'.repeat(24), marker: `校园隔离验收 ${runId}`, originalText: `校园隔离验收 ${runId}\n已编辑`, title: '合成数据', revision: 2 }

function ownedDirectory() {
  const directory = mkdtempSync(path.join(tmpdir(), 'campus-smoke-unit-'))
  writeFileSync(path.join(directory, 'owner'), runId)
  return directory
}

function fakeChild(onKill) {
  const child = new EventEmitter()
  child.kill = (signal) => { onKill?.(signal); queueMicrotask(() => child.emit('close', 0, null)); return true }
  return trackChild(child)
}

test('database isolation never keeps developer DB or accepts remote services', () => {
  const uri = isolatedDatabaseUri('mongodb://user:secret@127.0.0.1:27018/developer?authSource=admin', runId)
  const parsed = new URL(uri)
  assert.equal(parsed.pathname, `/${runId}`)
  assert.equal(parsed.searchParams.get('authSource'), 'admin')
  assert.throws(() => isolatedDatabaseUri('mongodb://remote.example/private', runId), /LOCAL_MONGODB_REQUIRED/)
  assert.throws(() => isolatedDatabaseUri('mongodb://127.0.0.1:27018/private', 'developer'), /INVALID_RUN_ID/)
})

test('child gets owned paths and current runtime but never parent credentials or dotenv overrides', () => {
  const directory = path.join(tmpdir(), runId)
  const env = backendEnvironment({ PATH: '/other', HOME: '/home/test', CLERK_SECRET_KEY: 'private', OPENAI_API_KEY: 'private', NODE_OPTIONS: '--require unsafe', DOTENV_CONFIG_PATH: '/private/.env', DEV_USER_UID: 'developer' }, {
    runId, directory, mongoUri: `mongodb://127.0.0.1:27018/${runId}`, redisUrl: 'redis://127.0.0.1:6380',
  })
  assert.equal(env.DEV_USER_UID, runId)
  assert.equal(env.CLERK_SECRET_KEY, '')
  assert.equal(env.OPENAI_API_KEY, undefined)
  assert.equal(env.NODE_OPTIONS, undefined)
  assert.equal(env.DOTENV_CONFIG_PATH, undefined)
  assert.equal(env.CAMPUS_IMPORT_DIR, path.join(directory, 'imports'))
  assert.equal(env.CAMPUS_LOG_DIR, path.join(directory, 'logs'))
  assert.equal(env.PORT, '0')
  assert.equal(env.HOST, '127.0.0.1')
  assert.equal(env.PATH.split(path.delimiter)[0], path.dirname(process.execPath))
})

test('fixed IDs, changed ownership and foreign persistence listeners are refused before request', async () => {
  assert.equal(validatePersistenceEvidence(evidence), evidence)
  for (const override of [{ uid: 'developer' }, { database: 'career_pilot_local' }, { runId: 'old-id' }, { marker: 'old-marker' }, { base: 'http://example.invalid:5002' }, { base: 'http://127.0.0.1:5002/api' }, { revision: 1 }]) {
    assert.throws(() => validatePersistenceEvidence({ ...evidence, ...override }))
  }
  await assert.rejects(checkPersistence({ ...evidence, uid: 'developer' }))
})

test('cleanup stops only owned child, drops only proven run DB and removes owned files', async () => {
  const directory = ownedDirectory()
  const calls = []
  const backend = fakeChild((signal) => calls.push(signal))
  const mongo = {
    db(name) {
      assert.equal(name, runId)
      return { collection(name) { assert.equal(name, '_smoke_owner'); return { async findOne(query) { assert.equal(query._id, runId); return { uid: runId } } } }, async dropDatabase() { calls.push('drop') } }
    },
    async close() { calls.push('close') },
  }
  const result = await cleanupOwnedRun({ runId, directory, backend, mongo, databaseTouched: true })
  assert.deepEqual(calls, ['SIGTERM', 'drop', 'close'])
  assert.ok(result.every((entry) => entry.status === 'PASS'))
  assert.equal(existsSync(directory), false)
})

test('failure cleanup never drops an unowned DB or removes unowned directory', async () => {
  const directory = ownedDirectory()
  writeFileSync(path.join(directory, 'owner'), 'not-this-run')
  let dropped = false, closed = false
  try {
    const result = await cleanupOwnedRun({ runId, directory, databaseTouched: true, mongo: {
      db() { return { collection() { return { async findOne() { return { uid: 'developer' } } } }, async dropDatabase() { dropped = true } } },
      async close() { closed = true },
    } })
    assert.equal(dropped, false)
    assert.equal(closed, true)
    assert.equal(existsSync(directory), true)
    assert.equal(result.find((entry) => entry.name === 'cleanup-database').status, 'FAIL')
    assert.equal(result.find((entry) => entry.name === 'cleanup-files').status, 'FAIL')
  } finally { rmSync(directory, { recursive: true }) }
})

test('failed infrastructure cleanup closes clients without touching any database', async () => {
  let closed = false
  const result = await cleanupOwnedRun({ runId, mongo: { db() { assert.fail('must not access DB') }, async close() { closed = true } } })
  assert.equal(closed, true)
  assert.ok(result.every((entry) => entry.status === 'PASS'))
})

test('child spawn error and close settle once; stop does not signal an already closed process', async () => {
  let killed = false
  const state = fakeChild(() => { killed = true })
  state.child.emit('error', Object.assign(new Error('spawn'), { code: 'ENOENT' }))
  state.child.emit('close', -2, null)
  assert.deepEqual(await state.closed, { code: -2, signal: null })
  assert.equal(state.spawnError, 'ENOENT')
  await stopBackend(state)
  assert.equal(killed, false)
})

test('persistence requires exact marker, revision and owner from the live API', async () => {
  let foreign = true, changed = false, resumeReads = 0
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.url === '/api/campus/auth/status') res.end(JSON.stringify({ data: { mode: 'local', user: { uid: foreign ? 'developer' : runId } } }))
    else if (req.url === '/health') res.end(JSON.stringify({ database: { ok: true }, redis: { ok: true } }))
    else {
      resumeReads++
      res.end(JSON.stringify({ data: { id: evidence.resumeId, userId: runId, originalText: changed ? `${evidence.originalText} stale` : evidence.originalText, title: evidence.title, revision: evidence.revision } }))
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const scoped = { ...evidence, base: `http://127.0.0.1:${server.address().port}` }
  try {
    await assert.rejects(checkPersistence(scoped), /does not belong/)
    assert.equal(resumeReads, 0)
    foreign = false
    assert.equal((await checkPersistence(scoped)).status, 'PASS')
    changed = true
    assert.equal((await checkPersistence(scoped)).status, 'FAIL')
  } finally {
    server.closeAllConnections()
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('foreign Host probe sends literal Host independently of connection address', async () => {
  let received
  const server = createServer((req, res) => {
    received = { path: req.url, host: req.headers.host, forwardedHost: req.headers['x-forwarded-host'], forwardedFor: req.headers['x-forwarded-for'] }
    res.writeHead(401)
    res.end('rejected')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const result = await requestForeignHost(`http://127.0.0.1:${server.address().port}`)
    assert.equal(result.status, 401)
    assert.deepEqual(received, { path: '/api/resumes', host: '10.0.0.8', forwardedHost: 'localhost', forwardedFor: '127.0.0.1' })
  } finally {
    server.closeAllConnections()
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
