import http from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { repoRoot } from './lib.mjs'

const origin = 'http://127.0.0.1:5173'
const base = 'http://127.0.0.1:5002'
const marker = `校园测试简历 ${new Date().toISOString()}`
const evidence = path.join(repoRoot, 'docs/evidence/phase1')
mkdirSync(evidence, { recursive: true })

async function api(pathname, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  if (options.method && options.method !== 'GET') headers.set('origin', origin)
  const response = await fetch(`${base}${pathname}`, { ...options, headers })
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/pdf')) {
    return { status: response.status, buffer: Buffer.from(await response.arrayBuffer()) }
  }
  const text = await response.text()
  let json = null
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  return { status: response.status, json }
}

function rawRequest(hostHeader) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: 5002,
      path: '/api/resumes',
      method: 'GET',
      headers: { host: hostHeader },
    }, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

const results = []
function record(name, status, detail) {
  results.push({ name, status, detail })
  console.log(`${status} ${name} ${detail || ''}`)
}

const health = await api('/health')
record('health', health.status === 200 && health.json?.database?.ok && health.json?.redis?.ok ? 'PASS' : 'FAIL', JSON.stringify({
  status: health.status,
  bodyStatus: health.json?.status,
  database: health.json?.database?.ok,
  redis: health.json?.redis?.ok,
}))

const disabled = await api('/api/payments')
record('disabled-payments', disabled.status === 404 && disabled.json?.code === 'CAMPUS_DISABLED' ? 'PASS' : 'FAIL', String(disabled.status))

const remoteHost = await rawRequest('10.0.0.8')
record('remote-host-rejected', remoteHost.status === 401 ? 'PASS' : 'FAIL', String(remoteHost.status))

const created = await api('/api/resumes', {
  method: 'POST',
  body: JSON.stringify({
    title: '校园测试',
    jobRole: '软件开发实习生',
    originalText: `# 测试同学\n\n${marker}\n\n这是合成测试数据，不是真人简历。`,
  }),
})
const resumeId = created.json?.data?.id
record('resume-create', created.status === 201 && resumeId ? 'PASS' : 'FAIL', String(created.status))

if (resumeId) {
  const loaded = await api(`/api/resumes/${resumeId}`)
  const same = loaded.json?.data?.originalText?.includes(marker)
  record('resume-read', loaded.status === 200 && same ? 'PASS' : 'FAIL', String(loaded.status))
  writeFileSync(path.join(evidence, 'resume-id.txt'), `${resumeId}\n${marker}\n`)
  const pdf = await api(`/api/resumes/${resumeId}/download?version=original&paperSize=A4`)
  if (pdf.buffer) {
    writeFileSync(path.join(evidence, 'campus-resume.pdf'), pdf.buffer)
    record('pdf-download', pdf.status === 200 && pdf.buffer.length > 1000 ? 'PASS' : 'FAIL', `bytes=${pdf.buffer.length}`)
  } else {
    record('pdf-download', 'FAIL', JSON.stringify(pdf.json))
  }
}

const jd = await api('/api/interview/parse-jd', {
  method: 'POST',
  body: JSON.stringify({ text: '招聘软件开发实习生。要求熟悉 JavaScript、Git，并能完成课程项目。' }),
})
record('parse-jd', jd.status === 200 && jd.json?.data?.jdText ? 'PASS' : 'FAIL', String(jd.status))

const crawl = await api('/api/interview/parse-jd', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://example.com/jobs/1' }),
})
record('parse-jd-url-disabled', crawl.status === 404 && crawl.json?.code === 'CAMPUS_DISABLED' ? 'PASS' : 'FAIL', String(crawl.status))

const gap = await api('/api/enhance/skill-gap', {
  method: 'POST',
  body: JSON.stringify({
    resumeText: '熟悉 JavaScript 的在读学生。这是合成测试数据。',
    jobDescription: '招聘软件开发实习生，要求 JavaScript 和 Git。',
  }),
})
record('skill-gap-no-key', gap.status === 403 && gap.json?.requireApiKey ? 'BLOCKED_EXTERNAL' : 'FAIL', String(gap.status))

const interview = await api('/api/interview/start', {
  method: 'POST',
  body: JSON.stringify({
    jobRole: '软件开发实习生',
    industry: '校园招聘',
    experienceLevel: 'student',
    questionCount: 2,
    language: 'zh',
    mode: 'behavioral',
    skipWarmup: true,
  }),
})
record('interview-start-no-key', interview.status === 403 && interview.json?.requireApiKey ? 'BLOCKED_EXTERNAL' : 'FAIL', String(interview.status))

writeFileSync(path.join(evidence, 'smoke-phase1.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2))
process.exit(results.some((item) => item.status === 'FAIL') ? 1 : 0)
