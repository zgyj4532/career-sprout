import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { repoRoot } from './lib.mjs'

const origin = 'http://127.0.0.1:5173'
const base = 'http://127.0.0.1:5002'
const audioPath = process.argv[2] || '/tmp/welcome.webm'
const evidence = path.join(repoRoot, 'docs/evidence/phase1')
mkdirSync(evidence, { recursive: true })

const results = []
function record(name, ok, detail) {
  const status = ok ? 'PASS' : 'FAIL'
  results.push({ name, status, detail })
  console.log(`${status} ${name} ${detail}`)
  if (!ok) {
    writeFileSync(path.join(evidence, 'interview-flow.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2))
    process.exit(1)
  }
}

async function api(pathname, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body && !(options.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  if ((options.method || 'GET') !== 'GET') headers.set('origin', origin)
  const response = await fetch(`${base}${pathname}`, { ...options, headers })
  const text = await response.text()
  let json = null
  try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 400) } }
  return { status: response.status, json }
}

const started = await api('/api/interview/start', {
  method: 'POST',
  body: JSON.stringify({
    jobRole: '软件开发实习生',
    industry: '校园招聘',
    experienceLevel: 'student',
    questionCount: 2,
    language: 'zh',
    mode: 'behavioral',
    resumeText: '计算机专业在读。做过一个 React 待办清单课程项目。这是接口测试数据，不是真人经历。',
    skipWarmup: true,
  }),
})
const interviewId = started.json?.data?.interviewId
const question = started.json?.data?.questions?.[0]
record('start', started.status === 200 && interviewId && question?.question, `status=${started.status} id=${interviewId || 'none'} requestId=${started.json?.requestId || ''}`)

const loaded = await api(`/api/interview/${interviewId}`)
record('read', loaded.status === 200 && loaded.json?.data?.jobRole, `status=${loaded.status} message=${loaded.json?.message || loaded.json?.error || ''}`)

const form = new FormData()
const audio = readFileSync(audioPath)
form.append('language', 'zh')
form.append('audio', new Blob([audio], { type: 'audio/webm' }), 'welcome.webm')
const transcribed = await api('/api/interview/transcribe', { method: 'POST', body: form })
const transcript = transcribed.json?.data?.text || ''
record('transcribe', transcribed.status === 200 && transcript.length > 0, `status=${transcribed.status} code=${transcribed.json?.code || ''} text=${transcript.slice(0, 40)} upstream=${transcribed.json?.data?.requestId || transcribed.json?.requestId || ''}`)

const answer = await api(`/api/interview/${interviewId}/answer`, {
  method: 'POST',
  body: (() => {
    const body = new FormData()
    body.append('questionId', question.questionId)
    body.append('transcript', transcript)
    body.append('duration', '2')
    body.append('isWarmup', 'false')
    return body
  })(),
})
const feedback = answer.json?.data?.analysis?.feedback
record('answer', answer.status === 200 && feedback, `status=${answer.status} code=${answer.json?.code || ''} feedback=${String(feedback || answer.json?.message || answer.json?.error || '').slice(0, 80)}`)

const reread = await api(`/api/interview/${interviewId}`)
const saved = (reread.json?.data?.answers || []).some((item) => item.transcript === transcript)
record('saved-answer', reread.status === 200 && saved, `status=${reread.status} answers=${reread.json?.data?.answers?.length || 0}`)

const completed = await api(`/api/interview/${interviewId}/complete`, { method: 'POST' })
record('complete', completed.status === 200 && completed.json?.data?.overallFeedback?.summary, `status=${completed.status} score=${completed.json?.data?.overallScore ?? 'none'} summary=${String(completed.json?.data?.overallFeedback?.summary || completed.json?.message || '').slice(0, 80)}`)

const history = await api('/api/interview/history')
const listed = (history.json?.data || []).some((item) => String(item._id) === String(interviewId))
record('history', history.status === 200 && listed, `status=${history.status} listed=${listed}`)

writeFileSync(path.join(evidence, 'interview-flow.json'), JSON.stringify({
  at: new Date().toISOString(),
  interviewId,
  transcript,
  results,
}, null, 2))
console.log('PASS interview-flow')
