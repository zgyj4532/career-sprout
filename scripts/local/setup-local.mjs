import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { ensureNode24, isWsl, repoRoot, run } from './lib.mjs'

if (ensureNode24()) await new Promise(() => {})
if (!isWsl()) {
  console.error('setup:local must run in WSL')
  process.exit(1)
}

const copies = [
  ['config/campus-local.backend.env', 'backend/.env'],
  ['config/campus-local.frontend.env', 'frontend/.env.local'],
]
for (const [from, to] of copies) {
  const target = path.join(repoRoot, to)
  if (existsSync(target)) {
    console.log(`keep existing ${to}`)
  } else {
    copyFileSync(path.join(repoRoot, from), target)
    console.log(`created ${to}`)
  }
}

for (const prefix of ['backend', 'frontend']) {
  const modules = path.join(repoRoot, prefix, 'node_modules')
  if (existsSync(modules)) {
    console.log(`keep existing ${prefix}/node_modules`)
    continue
  }
  const code = await run('npm', ['ci', '--prefix', prefix])
  if (code !== 0) process.exit(code)
}
console.log('setup:local complete')
