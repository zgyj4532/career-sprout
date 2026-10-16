import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ensureNode24, isWsl, repoRoot } from './lib.mjs'

if (ensureNode24()) await new Promise(() => {})

function runStep(name, command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: 'inherit' })
    child.on('exit', (code) => resolve({ name, command: [command, ...args].join(' '), code: code ?? 1 }))
    child.on('error', (error) => resolve({ name, command: [command, ...args].join(' '), code: 127, error: error.message }))
  })
}

const steps = [
  ['doctor', 'node', ['scripts/local/doctor.mjs'], repoRoot],
  ['identity', 'node', ['--test', 'src/config/__tests__/localDevIdentity.test.js', 'src/campus/__tests__/campusProfile.test.js'], path.join(repoRoot, 'backend')],
]
if (isWsl()) {
  steps.push(['backend-test', 'npm', ['test'], path.join(repoRoot, 'backend')])
  steps.push(['frontend-lint', 'npm', ['run', 'lint'], path.join(repoRoot, 'frontend')])
  steps.push(['frontend-test', 'npm', ['test'], path.join(repoRoot, 'frontend')])
  steps.push(['frontend-build', 'npm', ['run', 'build'], path.join(repoRoot, 'frontend')])
}

const results = []
for (const [name, command, args, cwd] of steps) {
  results.push(await runStep(name, command, args, cwd))
}
const outDir = path.join(repoRoot, 'docs/evidence/phase1')
mkdirSync(outDir, { recursive: true })
writeFileSync(path.join(outDir, 'verify-phase1.json'), JSON.stringify({
  at: new Date().toISOString(),
  node: process.version,
  results,
}, null, 2))
for (const result of results) {
  console.log(`${result.name} exit=${result.code}`)
}
const failed = results.find((result) => result.code !== 0)
process.exit(failed ? failed.code : 0)
