import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { checkLock, classifyPort, parseArguments, readStepEvidence, runStep, runtimeEnvironment, saveReport, selectedRuntime } from './acceptance.mjs'

test('argument parsing does not pass unknown or malformed flags to children', () => {
  assert.deepEqual(parseArguments([]), { includeUpstream: false })
  assert.equal(parseArguments(['--include-upstream'], { upstream: true }).includeUpstream, true)
  assert.equal(parseArguments(['--report', 'a report.json']).report, path.resolve('a report.json'))
  for (const args of [['--report'], ['--report', '--include-upstream'], ['--include-upstream'], ['--unknown']]) assert.throws(() => parseArguments(args))
})

test('runtime environment pins node search and campus profiles without mutating caller', () => {
  const executable = path.resolve('selected node', 'bin', 'node')
  const source = { PATH: 'foreign-node-path', APP_PROFILE: 'upstream', VITE_APP_PROFILE: 'upstream', KEEP_ME: 'yes' }
  const env = runtimeEnvironment(executable, source)
  assert.equal(env.PATH.split(path.delimiter)[0], path.dirname(executable))
  assert.equal(env.npm_node_execpath, executable)
  assert.equal(env.APP_PROFILE, 'campus-local')
  assert.equal(env.VITE_APP_PROFILE, 'campus-local')
  assert.equal(env.KEEP_ME, 'yes')
  assert.equal(source.APP_PROFILE, 'upstream')
})

test('runtime selection rejects a mismatched pin rather than falling back to ambient npm', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'campus-runtime-'))
  try {
    writeFileSync(path.join(directory, '.nvmrc'), '0.0.0\n')
    const runtime = selectedRuntime(directory)
    assert.equal(runtime.ok, false)
    assert.equal(runtime.expected, 'v0.0.0')
    assert.equal(runtime.version, process.version)
    assert.match(runtime.reason, /nvm use/)
    assert.equal(runtime.npmCli, undefined)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('manifest/lock comparison catches changes, missing roots and unsupported formats', () => {
  const manifest = { name: 'fixture', version: '1.0.0', dependencies: { alpha: '^1' }, devDependencies: { beta: '^2' }, engines: { node: '>=24' } }
  const lock = { name: manifest.name, version: manifest.version, lockfileVersion: 3, packages: { '': structuredClone(manifest) } }
  assert.deepEqual(checkLock(manifest, lock), [])
  lock.packages[''].dependencies.alpha = '^2'
  delete lock.packages[''].devDependencies.beta
  lock.packages[''].engines.node = '>=18'
  assert.deepEqual(checkLock(manifest, lock), ['dependencies.alpha differs from package.json', 'devDependencies.beta differs from package.json', 'engines.node differs from package.json'])
  assert.equal(checkLock(manifest, { lockfileVersion: 1 }).length, 2)
})

test('free, owned, foreign and unidentified ports remain distinct', () => {
  assert.deepEqual(classifyPort({ state: 'FREE' }), { status: 'PASS', ownership: 'FREE' })
  assert.deepEqual(classifyPort({ state: 'OCCUPIED', projectOwner: true }), { status: 'PASS', ownership: 'PROJECT' })
  assert.deepEqual(classifyPort({ state: 'OCCUPIED', foreignOwner: true }), { status: 'BLOCKED_EXTERNAL', ownership: 'FOREIGN' })
  assert.deepEqual(classifyPort({ state: 'OCCUPIED' }), { status: 'BLOCKED_EXTERNAL', ownership: 'UNKNOWN' })
  assert.deepEqual(classifyPort({ state: 'UNKNOWN' }), { status: 'BLOCKED_EXTERNAL', ownership: 'UNKNOWN' })
})

function fakeSpawn(events, inspect = () => {}) {
  return (command, args, options) => {
    inspect(command, args, options)
    const child = new EventEmitter()
    child.kill = () => { queueMicrotask(() => child.emit('close', null, 'SIGTERM')); return true }
    queueMicrotask(() => { for (const [name, ...values] of events) child.emit(name, ...values) })
    return child
  }
}
const step = { name: 'fixture', command: [process.execPath, 'file with spaces.mjs', '--flag'], cwd: tmpdir() }

test('child command stays argv-based and records failed exit without suppression', async () => {
  const result = await runStep(step, { env: { TEST: 'yes' }, spawnChild: fakeSpawn([['close', 7, null]], (command, args, options) => {
    assert.equal(command, process.execPath)
    assert.deepEqual(args, ['file with spaces.mjs', '--flag'])
    assert.equal(options.env.TEST, 'yes')
    assert.equal(options.shell, undefined)
  }) })
  assert.equal(result.status, 'FAIL')
  assert.equal(result.code, 7)
  assert.ok(result.startedAt)
  assert.ok(result.endedAt)
})

test('spawn error then close settles once and preserves error instead of inventing an exit code', async () => {
  const result = await runStep(step, { spawnChild: fakeSpawn([['error', Object.assign(new Error('private text'), { code: 'ENOENT' })], ['close', null, null], ['close', 0, null]]) })
  assert.equal(result.status, 'FAIL')
  assert.equal(result.spawnError, 'ENOENT')
  assert.equal(result.code, null)
  assert.equal(JSON.stringify(result).includes('private text'), false)
})

test('signals and cancellation cannot be converted to success', async () => {
  const signalled = await runStep(step, { spawnChild: fakeSpawn([['close', null, 'SIGTERM']]) })
  assert.equal(signalled.status, 'FAIL')
  assert.equal(signalled.signal, 'SIGTERM')
  const controller = new AbortController()
  controller.abort()
  const cancelled = await runStep(step, { signal: controller.signal, spawnChild: () => assert.fail('must not spawn') })
  assert.equal(cancelled.cancelled, true)
  assert.equal(cancelled.code, null)
})

test('abort signals the owned child and waits for its close', async () => {
  const controller = new AbortController()
  const promise = runStep(step, { signal: controller.signal, spawnChild: fakeSpawn([]) })
  controller.abort()
  const result = await promise
  assert.equal(result.cancelled, true)
  assert.equal(result.signal, 'SIGTERM')
  assert.equal(result.status, 'FAIL')
})

test('a real owned child ignoring SIGTERM is killed after cancellation grace', { skip: process.platform === 'win32', timeout: 5000 }, async () => {
  const controller = new AbortController()
  let child
  const command = [process.execPath, '-e', 'process.on("SIGTERM", () => {}); process.send("ready"); setInterval(() => {}, 1000)']
  try {
    const result = await runStep({ ...step, command, processGroup: true }, {
      signal: controller.signal, cancellationGraceMs: 50,
      spawnChild(executable, args, options) {
        child = spawn(executable, args, { ...options, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
        child.once('message', () => controller.abort())
        return child
      },
    })
    assert.equal(result.status, 'FAIL')
    assert.equal(result.forcedTermination, true)
    assert.equal(result.signal, 'SIGKILL')
    assert.equal(result.cleanup.status, 'FAIL')
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
})

test('incremental reports retain completed failures and pending reasons', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'campus-report-'))
  const file = path.join(directory, 'nested', 'report.json')
  try {
    const report = { results: [{ name: 'first', status: 'FAIL', code: 9 }, { name: 'second', status: 'NOT_RUN', reason: 'queued' }] }
    saveReport(file, report)
    report.results[1] = { name: 'second', status: 'PASS', code: 0 }
    saveReport(file, report)
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), report)
    assert.equal(readStepEvidence(file).results[0].code, 9)
    assert.equal(readStepEvidence(path.join(directory, 'missing.json')), null)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
