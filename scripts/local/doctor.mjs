import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { ensureNode24, isWsl, parseEnv, presence, repoRoot } from './lib.mjs'

if (ensureNode24()) await new Promise(() => {})

function report(status, message) {
  console.log(`${status} ${message}`)
}

function version(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  return {
    ok: result.status === 0,
    text: (result.stdout || result.stderr || 'missing').trim().split('\n')[0],
  }
}

report(isWsl() ? 'OK' : 'FAIL', `wsl=${isWsl()} platform=${process.platform}`)
report('OK', `node=${process.version}`)
const npm = version('npm', ['--version'])
report(npm.ok ? 'OK' : 'FAIL', `npm=${npm.text}`)
const pythonBin = existsSync('/usr/bin/python3') ? '/usr/bin/python3' : 'python3'
const python = version(pythonBin, ['--version'])
report(python.ok ? 'OK' : 'FAIL', `python3=${pythonBin} ${python.text}`)
const docker = version('docker', ['info', '--format', '{{.ServerVersion}}'])
report(docker.ok ? 'OK' : 'FAIL', docker.ok ? `docker=${docker.text}` : 'docker daemon unavailable')

const backendEnv = parseEnv(path.join(repoRoot, 'backend/.env'))
const frontendEnv = {
  ...parseEnv(path.join(repoRoot, 'frontend/.env')),
  ...parseEnv(path.join(repoRoot, 'frontend/.env.local')),
}
for (const key of ['MONGODB_URI', 'REDIS_URL', 'CLERK_SECRET_KEY', 'DEV_BYPASS_AUTH', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY', 'EMAIL_PASS', 'RAZORPAY_KEY_SECRET']) {
  report('INFO', `${key}=${presence(backendEnv[key])}`)
}
for (const key of ['VITE_CLERK_PUBLISHABLE_KEY', 'VITE_DEV_BYPASS_AUTH', 'VITE_APP_PROFILE', 'VITE_API_BASE']) {
  report('INFO', `${key}=${presence(frontendEnv[key])}`)
}
report(existsSync(path.join(repoRoot, 'backend/node_modules')) ? 'OK' : 'WARN', 'backend/node_modules')
report(existsSync(path.join(repoRoot, 'frontend/node_modules')) ? 'OK' : 'WARN', 'frontend/node_modules')
report('INFO', 'ports=5173,5002,27018,6380')

if (!isWsl() || !python.ok || !docker.ok || !npm.ok) process.exit(1)
