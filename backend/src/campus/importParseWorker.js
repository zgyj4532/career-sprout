import { parseDocument } from './importDocument.js'

const mode = process.argv[2]
const filePath = process.argv[3]

function send(message) {
  return new Promise((resolve, reject) => process.send(message, (error) => error ? reject(error) : resolve()))
}

if (mode === 'sleep') {
  setInterval(() => {}, 1000)
} else {
  process.once('message', async ({ previousBlocks = [] }) => {
    try {
      const result = await parseDocument(filePath, mode, async (block) => {
        const acknowledged = new Promise((resolve) => process.once('message', resolve))
        await send({ type: 'block', block })
        await acknowledged
      }, previousBlocks)
      await send({ type: 'result', ...result })
      process.exit(0)
    } catch (error) {
      await send({ type: 'result', ok: false, complete: false, code: error.code || 'PARSE_FAILED' })
      process.exit(1)
    }
  })
}
