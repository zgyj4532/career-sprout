import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function validatePersistenceEvidence(evidence) {
  const { runId, uid, database, base, resumeId, marker, originalText, title, revision } = evidence || {}
  const url = new URL(base)
  if (!/^campus_smoke_[a-f0-9]{32}$/.test(runId || '') || uid !== runId || database !== runId ||
      url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/' || url.search || url.hash || url.username || url.password ||
      !/^[a-f0-9]{24}$/.test(resumeId || '') || marker !== `校园隔离验收 ${runId}` ||
      typeof originalText !== 'string' || !originalText.includes(marker) || typeof title !== 'string' || !Number.isInteger(revision) || revision < 2) {
    throw new Error('Invalid run-scoped persistence evidence; fixed/developer IDs are not accepted')
  }
  return evidence
}

export async function requestJson(base, pathname, { signal, ...options } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    redirect: 'error',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
  })
  return { status: response.status, json: await response.json() }
}

export async function checkPersistence(evidence, { signal } = {}) {
  validatePersistenceEvidence(evidence)
  const { base, uid, resumeId, originalText, title, revision } = evidence
  // A healthy foreign listener is never sufficient evidence of our restarted child.
  const identity = await requestJson(base, '/api/campus/auth/status', { signal })
  if (identity.status !== 200 || identity.json?.data?.mode !== 'local' || identity.json.data.user?.uid !== uid) {
    throw new Error('Persistence listener does not belong to this smoke run')
  }
  const health = await requestJson(base, '/health', { signal })
  const resume = await requestJson(base, `/api/resumes/${resumeId}`, { signal })
  const data = resume.json?.data
  const kept = health.status === 200 && health.json?.database?.ok === true && health.json?.redis?.ok === true &&
    resume.status === 200 && data?.id === resumeId && data?.userId === uid && data?.originalText === originalText && data?.title === title && data?.revision === revision
  return { status: kept ? 'PASS' : 'FAIL', healthStatus: health.status, resumeStatus: resume.status, kept, runId: evidence.runId }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--evidence') throw new Error('Usage: node scripts/local/check-persist.mjs --evidence <current-run.json>')
    const result = await checkPersistence(JSON.parse(readFileSync(process.argv[3], 'utf8')))
    console.log(JSON.stringify(result))
    process.exitCode = result.status === 'PASS' ? 0 : 1
  } catch {
    console.log(JSON.stringify({ status: 'FAIL', code: 'PERSISTENCE_EVIDENCE_OR_REQUEST_FAILED' }))
    process.exitCode = 1
  }
}
