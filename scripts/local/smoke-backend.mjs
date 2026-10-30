// Smoke-only launcher: real campus server, ephemeral loopback socket, private IPC identity.
import { startCampusServer } from '../../backend/src/campusServer.js'

if (!process.send || !/^campus_smoke_[a-f0-9]{32}$/.test(process.env.CAMPUS_SMOKE_RUN_ID || '')) {
  throw new Error('This entry requires the smoke orchestrator IPC channel')
}
process.on('disconnect', () => process.kill(process.pid, 'SIGTERM'))
try {
  const server = await startCampusServer()
  process.send({
    type: 'ready',
    runId: process.env.CAMPUS_SMOKE_RUN_ID,
    uid: process.env.DEV_USER_UID,
    database: new URL(process.env.MONGODB_URI).pathname.slice(1),
    address: server.address(),
    pid: process.pid,
    execPath: process.execPath,
    node: process.version,
  })
} catch (error) {
  process.send({ type: 'failed', code: /^[A-Z_]+$/.test(error.code || '') ? error.code : 'BACKEND_START_FAILED' })
  process.exitCode = 1
  process.disconnect()
}
