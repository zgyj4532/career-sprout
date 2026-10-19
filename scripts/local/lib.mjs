import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(here, '../..')
export const node24 = path.join(homedir(), '.nvm/versions/node/v24.14.1/bin/node')

export function isWsl() {
  if (process.platform !== 'linux') return false
  try {
    return readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')
  } catch {
    return false
  }
}

export function ensureNode24() {
  if (process.env.CAMPUS_NODE_REEXEC === '1') return false
  if (process.version === 'v24.14.1') return false
  if (!existsSync(node24)) return false
  const child = spawn(node24, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, CAMPUS_NODE_REEXEC: '1' },
  })
  child.on('exit', (code) => process.exit(code ?? 1))
  child.on('error', (error) => {
    console.error(error.message)
    process.exit(1)
  })
  return true
}

export function parseEnv(file) {
  if (!existsSync(file)) return {}
  const values = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    values[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  return values
}

export function presence(value) {
  if (!value) return 'missing'
  if (/your-|example|change-this|placeholder|pk_test_your|sk_test_your/i.test(value)) return 'placeholder'
  return 'set'
}

export function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      env: options.env || process.env,
      stdio: options.stdio || 'inherit',
    })
    child.on('exit', (code) => resolve(code ?? 1))
    child.on('error', () => resolve(127))
  })
}
