import { spawn } from 'node:child_process'
import path from 'node:path'
import { ensureNode24, isWsl, node24, parseEnv, repoRoot } from './lib.mjs'
import { infra } from './infra.mjs'
import { logEvent, safeErrorMetadata } from '../../backend/src/utils/diagnostics.js'
process.env.CAMPUS_LOG_FILE = 'runtime'

if (ensureNode24()) await new Promise(() => {})
if (!isWsl()) {
  console.error('dev:local must run in WSL')
  process.exit(1)
}

const upCode = await infra('up')
if (upCode !== 0) process.exit(upCode)

const backendEnvFile = parseEnv(path.join(repoRoot, 'backend/.env'))
const env = {
  ...process.env,
  ...backendEnvFile,
  APP_PROFILE: 'campus-local',
  HOST: '127.0.0.1',
  PORT: '5002',
  NODE_ENV: 'development',
  FRONTEND_URL: 'http://127.0.0.1:5173',
  MONGODB_URI: 'mongodb://127.0.0.1:27018/career_pilot_local',
  REDIS_URL: 'redis://127.0.0.1:6380',
  ENABLE_GITHUB_SYNC_CRON: 'false',
  BULL_BOARD_ENABLED: 'false',
  CAMPUS_LOG_DIR: path.join(repoRoot, 'logs'),
  CAMPUS_LOG_FILE: 'backend',
}

const nodeBin = process.execPath
const children = []
let stopping = false

function start(command, args, childEnv, cwd) {
  const child = spawn(command, args, { cwd, env: childEnv, stdio: 'inherit' })
  children.push(child)
  logEvent('runtime.child_started', { state: cwd === path.join(repoRoot, 'backend') ? 'backend' : 'frontend' })
  child.on('error', (error) => { logEvent('runtime.child_failed', safeErrorMetadata(error)); stop(1) })
  child.on('exit', (code, signal) => {
    logEvent('runtime.child_exited', { status: code, state: signal || 'exited' })
    if (!stopping) stop(code && code > 0 ? code : 1)
  })
}

function stop(code = 0) {
  if (stopping) return
  stopping = true
  logEvent('runtime.stopping')
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGINT')
  }
  setTimeout(() => {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    process.exit(code)
  }, 400)
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

start(nodeBin, ['src/campusServer.js'], env, path.join(repoRoot, 'backend'))
start(nodeBin, [path.join(repoRoot, 'frontend/node_modules/vite/bin/vite.js')], {
  ...process.env,
  VITE_APP_PROFILE: 'campus-local',
  VITE_DEV_BYPASS_AUTH: env.CLERK_SECRET_KEY ? 'false' : (env.DEV_BYPASS_AUTH || 'true'),
  VITE_API_BASE: '/api',
  VITE_BIND_LOOPBACK: '1',
}, path.join(repoRoot, 'frontend'))

logEvent('runtime.started')
console.log('dev:local http://127.0.0.1:5173 -> http://127.0.0.1:5002')
if (nodeBin !== node24 && process.version !== 'v24.14.1') {
  console.log(`WARN node=${process.version}; preferred ${node24}`)
}
await new Promise(() => {})
