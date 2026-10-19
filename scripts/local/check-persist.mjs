const id = '6ad07b39638c2cf6e2b0fdeb'
const marker = '校园测试简历 2026-10-15T07:05:29.591Z'
const healthResponse = await fetch('http://127.0.0.1:5002/health')
const health = await healthResponse.json()
const resumeResponse = await fetch(`http://127.0.0.1:5002/api/resumes/${id}`)
const resume = await resumeResponse.json()
const text = resume.data?.originalText || ''
console.log(JSON.stringify({
  healthStatus: healthResponse.status,
  database: health.database?.ok,
  redis: health.redis?.ok,
  resumeStatus: resumeResponse.status,
  kept: text.includes(marker),
}))
if (healthResponse.status !== 200 || !text.includes(marker)) process.exit(1)
