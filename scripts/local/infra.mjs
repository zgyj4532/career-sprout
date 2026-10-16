import { pathToFileURL } from 'node:url'
import { ensureNode24, isWsl, repoRoot, run } from './lib.mjs'

export async function infra(action) {
  if (!isWsl()) {
    console.error('infra commands must run in WSL')
    return 1
  }
  if (action !== 'up' && action !== 'down') {
    console.error('usage: infra.mjs up|down')
    return 2
  }
  const args = ['compose', '-f', 'compose.local.yml', '-p', 'career-pilot-local']
  args.push(...(action === 'up' ? ['up', '-d', '--wait'] : ['down']))
  return run('docker', args, { cwd: repoRoot })
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirect) {
  if (ensureNode24()) await new Promise(() => {})
  process.exit(await infra(process.argv[2]))
}
