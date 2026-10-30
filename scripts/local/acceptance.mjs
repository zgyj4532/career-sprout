import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { repoRoot } from './lib.mjs'

export function parseArguments(args, { upstream = false } = {}) {
  const options = { includeUpstream: false }
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--include-upstream' && upstream) options.includeUpstream = true
    else if (args[i] === '--report' && args[i + 1] && !args[i + 1].startsWith('--')) options.report = path.resolve(args[++i])
    else throw new Error('Expected --report <path>' + (upstream ? ' or --include-upstream' : ''))
  }
  return options
}

export function runtimeEnvironment(execPath, source = process.env) {
  return {
    ...source,
    PATH: `${path.dirname(execPath)}${path.delimiter}${source.PATH || ''}`,
    npm_node_execpath: execPath,
    APP_PROFILE: 'campus-local',
    VITE_APP_PROFILE: 'campus-local',
  }
}

export function selectedRuntime(root = repoRoot) {
  const expected = `v${readFileSync(path.join(root, '.nvmrc'), 'utf8').trim()}`
  const executable = realpathSync(process.execPath)
  const npmCli = path.resolve(path.dirname(executable), '../lib/node_modules/npm/bin/npm-cli.js')
  const env = runtimeEnvironment(executable)
  if (process.version !== expected) return { ok: false, executable, version: process.version, expected, env, reason: 'Select the exact .nvmrc Node version in WSL (nvm use).' }
  if (!existsSync(npmCli)) return { ok: false, executable, version: process.version, expected, env, reason: 'npm CLI is missing from the selected Node installation; repair that installation manually.' }
  const npm = spawnSync(executable, [npmCli, '--version'], { env, encoding: 'utf8', timeout: 10000, maxBuffer: 8192 })
  const version = npm.stdout?.trim()
  if (npm.status !== 0 || !/^\d+\.\d+\.\d+/.test(version || '')) return { ok: false, executable, version: process.version, expected, env, reason: 'The selected Node installation cannot run its npm CLI.' }
  return { ok: true, executable, version: process.version, expected, npmCli, npmVersion: version, env }
}

export function saveReport(file, report) {
  mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
  renameSync(temporary, file)
}

export function checkLock(manifest, lock) {
  const problems = []
  if (![2, 3].includes(lock.lockfileVersion)) problems.push('Expected package-lock format 2 or 3')
  const root = lock.packages?.['']
  if (!root) return [...problems, 'Missing lockfile root package declarations']
  for (const field of ['name', 'version']) {
    if (manifest[field] !== root[field] || manifest[field] !== lock[field]) problems.push(`Root ${field} differs from package.json`)
  }
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'engines']) {
    const expected = manifest[field] || {}, actual = root[field] || {}
    for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      if (expected[key] !== actual[key]) problems.push(`${field}.${key} differs from package.json`)
    }
  }
  return problems
}

export function classifyPort({ state, projectOwner = false, foreignOwner = false }) {
  if (state === 'FREE') return { status: 'PASS', ownership: 'FREE' }
  if (state !== 'OCCUPIED') return { status: 'BLOCKED_EXTERNAL', ownership: 'UNKNOWN' }
  if (projectOwner) return { status: 'PASS', ownership: 'PROJECT' }
  return { status: 'BLOCKED_EXTERNAL', ownership: foreignOwner ? 'FOREIGN' : 'UNKNOWN' }
}

// Wait for close, not exit: descendants must release inherited output before another gate starts.
export function runStep(step, { env, signal, spawnChild = spawn, cancellationGraceMs = 10000 } = {}) {
  const startedAt = new Date().toISOString()
  return new Promise((resolve) => {
    let child, spawnError, escalation, finalDeadline, settled = false, cancelled = false, forcedTermination = false
    const finish = (code, exitSignal) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', cancel)
      clearTimeout(escalation)
      clearTimeout(finalDeadline)
      resolve({
        ...step, startedAt, endedAt: new Date().toISOString(), code,
        signal: exitSignal || null,
        status: !spawnError && !cancelled && !exitSignal && code === 0 ? 'PASS' : 'FAIL',
        ...(spawnError ? { spawnError } : {}),
        ...(cancelled ? { cancelled: true } : {}),
        ...(forcedTermination ? { forcedTermination: true, cleanup: { status: 'FAIL', reason: 'Cancellation grace expired; forced owned process termination cannot prove resource cleanup.' } } : {}),
      })
    }
    const sendSignal = (name) => {
      try {
        if (step.processGroup && child?.pid) process.kill(-child.pid, name)
        else child?.kill(name)
      } catch (error) {
        if (error.code !== 'ESRCH') spawnError = error.code || 'SIGNAL_FAILED'
      }
    }
    const cancel = () => {
      cancelled = true
      sendSignal('SIGTERM')
      escalation = setTimeout(() => {
        forcedTermination = true
        sendSignal('SIGKILL')
        finalDeadline = setTimeout(() => finish(null, 'SIGKILL'), 2000)
      }, cancellationGraceMs)
    }
    if (signal?.aborted) { cancelled = true; finish(null, null); return }
    try {
      child = spawnChild(step.command[0], step.command.slice(1), {
        cwd: step.cwd, env: { ...env, ...step.env }, stdio: 'inherit', detached: Boolean(step.processGroup),
      })
      child.once('error', (error) => { spawnError = error.code || 'SPAWN_ERROR' })
      child.once('close', finish)
      signal?.addEventListener('abort', cancel, { once: true })
      if (signal?.aborted) cancel()
    } catch (error) {
      spawnError = error.code || 'SPAWN_ERROR'
      finish(null, null)
    }
  })
}

export function readStepEvidence(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}
