import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { isWsl, repoRoot } from './lib.mjs'
import { parseArguments, readStepEvidence, runStep, saveReport, selectedRuntime } from './acceptance.mjs'

let options
try { options = parseArguments(process.argv.slice(2), { upstream: true }) } catch (error) {
  console.error(error.message)
  process.exitCode = 2
}
if (options) {
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
  const runDirectory = path.join(repoRoot, 'docs/evidence/phase1/runs', runId)
  const reportFile = options.report || path.join(repoRoot, 'docs/evidence/phase1/verify-phase1.json')
  const doctorFile = path.join(runDirectory, 'doctor.json')
  const smokeFile = path.join(runDirectory, 'smoke.json')
  const report = {
    runId, startedAt: new Date().toISOString(), endedAt: null, status: 'NOT_RUN',
    profile: 'campus-local', includeUpstream: options.includeUpstream,
    node: { executable: process.execPath, version: process.version }, results: [],
    externalAcceptance: [
      { name: 'Clerk real accounts, verified email, teacher authorization and two-account isolation', status: 'BLOCKED_EXTERNAL', reason: 'Requires user-controlled credentials/accounts and an explicit real-session acceptance run; never inferred from environment presence.' },
      { name: 'Live LLM/ASR providers and physical-device microphone/playback', status: 'NOT_RUN', reason: 'No paid/provider calls or real-device interactions in deterministic verification.' },
    ],
    fullAcceptance: false,
  }
  const persist = () => {
    saveReport(path.join(runDirectory, 'verify-phase1.json'), report)
    saveReport(reportFile, report)
  }
  const controller = new AbortController()
  const interrupt = (signal) => { report.cancellation = signal; controller.abort() }
  const onInterrupt = () => interrupt('SIGINT')
  const onTerminate = () => interrupt('SIGTERM')
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onTerminate)
  try {
    persist()
    const runtime = selectedRuntime()
    report.node = { executable: runtime.executable, version: runtime.version, expected: runtime.expected, npmCli: runtime.npmCli, npmVersion: runtime.npmVersion }
    const backend = path.join(repoRoot, 'backend')
    const frontend = path.join(repoRoot, 'frontend')
    const node = (name, args, cwd = repoRoot, extra = {}) => ({ name, scope: 'campus', command: [runtime.executable, ...args], cwd, processGroup: true, ...extra })
    const npm = (name, args, cwd, extra = {}) => node(name, [runtime.npmCli || '<selected-node-npm-unavailable>', ...args], cwd, { processGroup: true, ...extra })
    // Backend modules call dotenv.config() themselves. An owned cwd without .env
    // prevents developer credentials from being reloaded even when tests delete a key.
    const testDirectory = path.join(runDirectory, 'backend-tests')
    mkdirSync(testDirectory, { recursive: true })
    const testEnv = { NODE_ENV: 'test', REDIS_URL: '', MONGODB_URI: '', ASR_PROVIDER: '', CLERK_SECRET_KEY: '', DOTENV_CONFIG_PATH: path.join(testDirectory, '.env-absent') }
    for (const key of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'REQUESTY_API_KEY', 'CUSTOM_API_KEY', 'DASHSCOPE_API_KEY', 'QWEN_API_KEY']) testEnv[key] = ''
    const backendScript = (name, script, scope = 'campus') => {
      const manifest = JSON.parse(readFileSync(path.join(backend, 'package.json'), 'utf8'))
      const tokens = manifest.scripts[script]?.trim().split(/\s+/) || []
      if (tokens.shift() !== 'node' || !tokens.includes('--test') || tokens.some((token) => !/^--[\w=-]+$/.test(token) && !/^src\/[\w/.-]+\.test\.js$/.test(token))) throw new Error('Unsupported backend test script; update the verifier explicitly.')
      if (!tokens.some((token) => token.startsWith('--test-concurrency='))) tokens.unshift('--test-concurrency=1')
      return node(name, tokens.map((token) => token.startsWith('src/') ? path.join(backend, token) : token), testDirectory, { scope, env: testEnv, manifestScript: `backend/package.json scripts.${script}`, processGroup: true })
    }
    const steps = [
      node('doctor', ['scripts/local/doctor.mjs', '--report', doctorFile], repoRoot, { evidence: doctorFile }),
      node('local-script-tests', ['--test', '--test-concurrency=1', 'scripts/local/acceptance.test.mjs', 'scripts/local/smoke-phase1.test.mjs']),
      backendScript('backend-campus-tests', 'test:campus'),
      node('backend-shared-tests', ['--test', '--test-concurrency=1', ...['src/schemas/__tests__/schemas.test.js', 'src/schemas/__tests__/interview-extended.test.js', 'src/services/__tests__/interview-coding.test.js', 'src/services/__tests__/transcription.test.js'].map((file) => path.join(backend, file))], testDirectory, { env: testEnv, processGroup: true }),
      node('backend-campus-lint', ['node_modules/eslint/bin/eslint.js', 'src/campus', 'src/campusServer.js', 'src/config/localDevIdentity.js'], backend),
      node('frontend-campus-lint', ['node_modules/eslint/bin/eslint.js', 'src/campus', 'src/main.jsx', 'src/utils/interviewScores.js', 'src/utils/interviewDifficulty.js', 'src/utils/interviewAnalyzer.js'], frontend),
      npm('frontend-campus-tests', ['test', '--', 'src/campus', '--maxWorkers=1', '--no-file-parallelism'], frontend),
      npm('frontend-campus-build', ['run', 'build'], frontend, { env: { NODE_OPTIONS: '--max-old-space-size=384' } }),
      node('isolated-smoke-persistence', ['scripts/local/smoke-phase1.mjs', '--report', smokeFile], repoRoot, { processGroup: false, evidence: smokeFile, dependsOn: ['local-script-tests', 'backend-campus-tests'] }),
    ]
    if (options.includeUpstream) {
      steps.push(
        backendScript('upstream-backend-tests', 'test', 'upstream'),
        npm('upstream-backend-lint', ['run', 'lint'], backend, { scope: 'upstream' }),
        npm('upstream-frontend-tests', ['test', '--', '--maxWorkers=1', '--no-file-parallelism'], frontend, { scope: 'upstream' }),
        npm('upstream-frontend-lint', ['run', 'lint'], frontend, { scope: 'upstream' }),
      )
    }
    report.results = steps.map((step) => ({ ...step, node: report.node, startedAt: null, endedAt: null, code: null, status: 'NOT_RUN', reason: 'Queued; steps run sequentially.' }))
    persist()
    const prerequisite = !isWsl() ? 'Run the full verifier in WSL; native platform subsets are not acceptance.' : !runtime.ok ? runtime.reason : null
    if (prerequisite) {
      report.runtimeBlocker = prerequisite
      for (const result of report.results) result.reason = prerequisite
    } else {
      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index]
        const failedDependencies = (step.dependsOn || []).filter((name) => report.results.find((result) => result.name === name)?.status !== 'PASS')
        if (controller.signal.aborted || failedDependencies.length) {
          report.results[index].reason = controller.signal.aborted ? 'Verification cancelled; not started.' : `Required predecessor did not pass: ${failedDependencies.join(', ')}`
          persist()
          continue
        }
        report.results[index].reason = 'Running; no result yet.'
        report.results[index].startedAt = new Date().toISOString()
        persist()
        console.log(`\n[${step.scope}] ${step.name}`)
        const result = await runStep(step, { env: runtime.env, signal: controller.signal, cancellationGraceMs: step.name === 'isolated-smoke-persistence' ? 30000 : 10000 })
        result.node = report.node
        if (step.evidence) {
          const evidence = readStepEvidence(step.evidence)
          if (!evidence) {
            result.status = 'FAIL'
            result.reason = 'Child did not produce readable run-specific JSON evidence.'
          } else {
            result.evidenceStatus = evidence.status
            if (result.code !== 0 && evidence.status === 'BLOCKED_EXTERNAL' && !result.signal && !result.spawnError && !result.cancelled) result.status = 'BLOCKED_EXTERNAL'
            else if (evidence.status !== 'PASS' || result.code !== 0) result.status = 'FAIL'
            if (evidence.cleanup && !result.forcedTermination) result.cleanup = evidence.cleanup
          }
        }
        report.results[index] = result
        persist()
      }
    }
    for (const scope of ['campus', 'upstream']) {
      const scoped = report.results.filter((result) => result.scope === scope)
      report[`${scope}Status`] = !scoped.length ? 'NOT_RUN' : scoped.some((result) => result.status === 'FAIL') ? 'FAIL' : prerequisite || scoped.some((result) => result.status === 'BLOCKED_EXTERNAL') ? 'BLOCKED_EXTERNAL' : scoped.some((result) => result.status === 'NOT_RUN') ? 'NOT_RUN' : 'PASS'
    }
    report.status = report.cancellation || report.campusStatus === 'FAIL' || report.upstreamStatus === 'FAIL' ? 'FAIL' : report.campusStatus === 'BLOCKED_EXTERNAL' || report.upstreamStatus === 'BLOCKED_EXTERNAL' ? 'BLOCKED_EXTERNAL' : report.campusStatus === 'PASS' && (!options.includeUpstream || report.upstreamStatus === 'PASS') ? 'PASS' : 'FAIL'
  } catch (error) {
    report.status = 'FAIL'
    report.internalError = error.code || error.name
  } finally {
    report.endedAt = new Date().toISOString()
    persist()
    process.removeListener('SIGINT', onInterrupt)
    process.removeListener('SIGTERM', onTerminate)
  }
  for (const result of report.results) console.log(`${result.scope}/${result.name}: ${result.status} exit=${result.code ?? 'not available'}${result.reason ? ` (${result.reason})` : ''}`)
  console.log(`Engineering gates: ${report.status}; full acceptance NOT complete. Real-account/provider/device gates remain external.\nReport: ${reportFile}`)
  process.exitCode = report.cancellation === 'SIGINT' ? 130 : report.cancellation ? 143 : report.status === 'PASS' ? 0 : report.status === 'BLOCKED_EXTERNAL' ? 2 : 1
}
