import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { createConnection } from 'node:net'
import path from 'node:path'
import { isWsl, parseEnv, presence, repoRoot } from './lib.mjs'
import { checkLock, classifyPort, parseArguments, saveReport, selectedRuntime } from './acceptance.mjs'

const startedAt = new Date().toISOString()
const results = []
function record(name, status, detail, extra = {}) {
  results.push({ name, status, detail, ...extra })
  console.log(`${status} ${name}: ${detail}`)
}
function command(executable, args, env) {
  const result = spawnSync(executable, args, { cwd: repoRoot, env, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 })
  return { ok: result.status === 0, stdout: result.stdout || '', code: result.status, error: result.error?.code || null, signal: result.signal }
}
function json(file) { return JSON.parse(readFileSync(file, 'utf8')) }
function configured(value) {
  return presence(typeof value === 'string' ? value.trim().replace(/^(['"])(.*)\1$/, '$2') : value)
}
function socketState(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    let settled = false
    const finish = (state) => { if (!settled) { settled = true; socket.destroy(); resolve(state) } }
    socket.once('connect', () => finish('OCCUPIED'))
    socket.once('error', (error) => finish(error.code === 'ECONNREFUSED' ? 'FREE' : 'UNKNOWN'))
    socket.setTimeout(1500, () => finish('UNKNOWN'))
  })
}
function processOwner(port, env) {
  const result = command('ss', ['-H', '-ltnp', `sport = :${port}`], env)
  if (!result.ok) return { identified: false, project: false, reason: 'Install iproute2 or inspect the listening process manually; ss unavailable.' }
  const pids = [...new Set([...result.stdout.matchAll(/pid=(\d+)/g)].map((match) => match[1]))]
  if (!pids.length) return { identified: false, project: false, reason: 'Listener PID unavailable; inspect ownership with sufficient read permissions.' }
  const owners = pids.map((pid) => {
    try {
      const cwd = realpathSync(`/proc/${pid}/cwd`)
      const root = realpathSync(repoRoot)
      const relative = path.relative(root, cwd)
      const executable = realpathSync(`/proc/${pid}/exe`)
      const argv = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean)
      const expected = port === 5002 ? path.join(root, 'backend/src/campusServer.js') : port === 5173 ? path.join(root, 'frontend/node_modules/vite/bin/vite.js') : null
      const script = argv[1] && !argv[1].startsWith('-') ? realpathSync(path.resolve(cwd, argv[1])) : null
      const inCheckout = relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
      return { pid: Number(pid), project: Boolean(inCheckout && path.basename(executable) === 'node' && expected && script === realpathSync(expected)) }
    } catch { return { pid: Number(pid), project: null } }
  })
  return { identified: owners.every((owner) => owner.project !== null), project: owners.every((owner) => owner.project === true), pids: owners.map((owner) => owner.pid) }
}

let options
try { options = parseArguments(process.argv.slice(2)) } catch (error) {
  console.error(error.message)
  process.exitCode = 2
}
if (options) {
  const reportFile = options.report || path.join(repoRoot, 'docs/evidence/phase1/doctor.json')
  try {
    const runtime = selectedRuntime()
    record('wsl', isWsl() ? 'PASS' : 'BLOCKED_EXTERNAL', isWsl() ? 'WSL Linux environment' : 'Run from the WSL checkout, not native Windows/Linux.')
    record('node', runtime.ok ? 'PASS' : 'BLOCKED_EXTERNAL', runtime.ok ? `${runtime.version}; npm ${runtime.npmVersion}` : runtime.reason, {
      executable: runtime.executable, version: runtime.version, expected: runtime.expected, npmCli: runtime.npmCli, npmVersion: runtime.npmVersion,
    })
    const python = command('python3', ['--version'], runtime.env)
    const pythonVersion = python.stdout.match(/Python (\d+)\.(\d+)\.(\d+)/)
    const supportedPython = python.ok && pythonVersion && (Number(pythonVersion[1]) > 3 || (Number(pythonVersion[1]) === 3 && Number(pythonVersion[2]) >= 9))
    record('python', supportedPython ? 'PASS' : 'BLOCKED_EXTERNAL', supportedPython ? pythonVersion[0] : 'Python 3.9+ required; install/select manually.', { code: python.code, error: python.error })
    const compose = command('docker', ['compose', 'version', '--short'], runtime.env)
    record('compose', compose.ok ? 'PASS' : 'BLOCKED_EXTERNAL', compose.ok ? 'Docker Compose plugin available' : 'Enable/install Docker Compose in this WSL distribution.', { code: compose.code, error: compose.error })
    const daemon = command('docker', ['info', '--format', '{{.ServerVersion}}'], runtime.env)
    record('docker-daemon', daemon.ok ? 'PASS' : 'BLOCKED_EXTERNAL', daemon.ok ? 'Docker daemon reachable' : 'Start Docker or enable WSL integration and approved socket access; never chmod 666 docker.sock.', { code: daemon.code, error: daemon.error })

    let containers = []
    if (compose.ok && daemon.ok) {
      const listing = command('docker', ['compose', '-f', 'compose.local.yml', '-p', 'career-pilot-local', 'ps', '--format', 'json'], runtime.env)
      try {
        const text = listing.stdout.trim()
        containers = text.startsWith('[') ? JSON.parse(text) : text.split('\n').filter(Boolean).map((line) => JSON.parse(line))
        record('compose-services', listing.ok ? 'PASS' : 'BLOCKED_EXTERNAL', listing.ok ? `${containers.length} project containers; idle services are allowed.` : 'Cannot inspect project containers.')
      } catch { record('compose-services', 'BLOCKED_EXTERNAL', 'Cannot decode Compose service ownership; inspect docker compose ps manually.') }
    }
    for (const port of [5173, 5002, 27018, 6380]) {
      const state = await socketState(port)
      let owner = { identified: false, project: false }
      let health = 'NOT_RUN'
      if (state === 'OCCUPIED') {
        owner = processOwner(port, runtime.env)
        const service = port === 27018 ? 'mongodb' : port === 6380 ? 'redis' : null
        if (service && containers.some((container) => container.Project === 'career-pilot-local' && container.Service === service && container.Publishers?.some((publisher) => publisher.PublishedPort === port))) {
          owner = { identified: true, project: true, source: 'compose-project-service-port' }
        }
        if (port === 5002) {
          try {
            const response = await fetch('http://127.0.0.1:5002/health', { signal: AbortSignal.timeout(2000), redirect: 'error' })
            const data = await response.json()
            health = data.profile === 'campus-local' ? (response.ok ? 'CAMPUS_HEALTHY' : 'CAMPUS_DEGRADED') : 'OTHER_SERVICE'
            // A health profile alone does not prove which checkout owns the process.
          } catch { health = 'UNKNOWN' }
          if (!health.startsWith('CAMPUS_')) owner.project = false
        }
      }
      const classification = classifyPort({ state, projectOwner: owner.project, foreignOwner: owner.identified && !owner.project })
      record(`port-${port}`, classification.status, `${classification.ownership}; ${owner.reason || (classification.ownership === 'UNKNOWN' || classification.ownership === 'FOREIGN' ? 'Identify owner or stop it manually before startup; no process was changed.' : 'No process was changed.')}`, { state, ...classification, owner, health })
    }

    for (const directory of ['', 'backend', 'frontend']) {
      const name = directory || 'root'
      const base = path.join(repoRoot, directory)
      try {
        const manifest = json(path.join(base, 'package.json'))
        const lock = json(path.join(base, 'package-lock.json'))
        const problems = checkLock(manifest, lock)
        record(`${name}-lock`, problems.length ? 'FAIL' : 'PASS', problems.length ? problems.join('; ') : 'Root declarations match; structural check only, npm ci was NOT run.', { lockfileVersion: lock.lockfileVersion, engines: manifest.engines || {} })
        const packages = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter((dependency) => !existsSync(path.join(base, 'node_modules', dependency, 'package.json')))
        record(`${name}-installed`, packages.length ? 'BLOCKED_EXTERNAL' : 'PASS', packages.length ? 'Direct dependencies missing; run setup:local in WSL after reviewing locks.' : 'Direct dependency manifests present; installed versions/integrity not proven.', { missing: packages })
      } catch { record(`${name}-lock`, 'FAIL', 'Missing or unreadable package manifest/lockfile; inspect and reconcile manually.') }
      const npmrc = path.join(base, '.npmrc')
      record(`${name}-npmrc`, 'PASS', existsSync(npmrc) ? 'Configuration present; values are not printed.' : 'No package-local npm configuration.')
    }

    const backend = { ...parseEnv(path.join(repoRoot, 'backend/.env')), ...process.env }
    const frontend = { ...parseEnv(path.join(repoRoot, 'frontend/.env')), ...parseEnv(path.join(repoRoot, 'frontend/.env.local')), ...process.env }
    for (const key of ['MONGODB_URI', 'REDIS_URL']) {
      const value = configured(backend[key])
      record(`config-${key}`, value === 'set' ? 'PASS' : 'BLOCKED_EXTERNAL', value, { required: true })
    }
    for (const key of ['APP_PROFILE', 'HOST', 'DEV_BYPASS_AUTH', 'CLERK_SECRET_KEY', 'CAMPUS_TEACHER_UIDS', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'ASR_PROVIDER', 'DASHSCOPE_API_KEY', 'QWEN_API_KEY', 'QWEN_ASR_BASE_URL', 'QWEN_ASR_MODEL', 'FFMPEG_PATH']) {
      record(`config-${key}`, 'PASS', `presence=${configured(backend[key])}; capability not exercised`, { required: false })
    }
    for (const key of ['VITE_CLERK_PUBLISHABLE_KEY', 'VITE_DEV_BYPASS_AUTH', 'VITE_APP_PROFILE', 'VITE_API_BASE']) {
      record(`config-${key}`, 'PASS', `presence=${configured(frontend[key])}; capability not exercised`, { required: false })
    }
    const privateFrontendKeys = Object.keys(frontend).filter((key) => key.startsWith('VITE_') && /SECRET|PRIVATE|API_KEY|TOKEN|PASSWORD/.test(key) && configured(frontend[key]) === 'set')
    record('frontend-secret-boundary', privateFrontendKeys.length ? 'FAIL' : 'PASS', privateFrontendKeys.length ? 'Potential private credentials in VITE variables; remove from client configuration.' : 'No private-looking configured VITE variable names.', { fields: privateFrontendKeys })
    const ffmpeg = command(backend.FFMPEG_PATH || '/mnt/c/Users/ll/scoop/shims/ffmpeg.exe', ['-version'], runtime.env)
    record('asr-converter', ffmpeg.ok ? 'PASS' : 'NOT_RUN', ffmpeg.ok ? 'Configured/default ffmpeg executable available; transcription not exercised.' : 'ASR conversion unavailable: set FFMPEG_PATH to a working executable; text-only acceptance remains independent.', { required: false, code: ffmpeg.code, error: ffmpeg.error })
    record('formal-auth', 'BLOCKED_EXTERNAL', 'Real Clerk email verification, teacher authorization and two-account isolation require an explicit real-account session; presence is not proof.', { required: false })
    record('live-providers', 'NOT_RUN', 'LLM/ASR providers were not contacted. API-key presence and converter availability do not establish service capability.', { required: false })
  } catch (error) {
    record('doctor-internal', 'FAIL', 'Diagnostic could not complete; inspect the referenced local files/tools.', { error: error.code || error.name })
  }
  const required = results.filter((result) => result.required !== false)
  const status = required.some((result) => result.status === 'FAIL') ? 'FAIL' : required.some((result) => result.status === 'BLOCKED_EXTERNAL') ? 'BLOCKED_EXTERNAL' : 'PASS'
  saveReport(reportFile, { startedAt, endedAt: new Date().toISOString(), status, node: { executable: process.execPath, version: process.version }, results })
  process.exitCode = status === 'PASS' ? 0 : status === 'BLOCKED_EXTERNAL' ? 2 : 1
}
