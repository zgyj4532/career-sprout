import { createWriteStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { heavyWorkBusy, releaseHeavyWork, tryAcquireHeavyWork } from '../services/pdfGenerator.js'
import { LIMITS, limitError, imageHeaderFromBytes } from './importLimits.js'
import { readBoundedFile } from './importDocument.js'

export async function streamToFile(readable, destination, { maxBytes = LIMITS.fileBytes } = {}) {
  let bytes = 0
  const counter = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length
      callback(bytes > maxBytes ? limitError('FILE_LIMIT') : null, chunk)
    },
  })
  try { await pipeline(readable, counter, createWriteStream(destination, { flags: 'wx', mode: 0o600 })) }
  catch (error) { if (error.code !== 'EEXIST') await rm(destination, { force: true }); throw error }
  return bytes
}

export async function readImportImage(filePath, kind) {
  if (!['png', 'jpeg', 'webp'].includes(kind)) throw limitError('IMPORT_TYPE')
  const bytes = await readBoundedFile(filePath)
  imageHeaderFromBytes(bytes)
  return `data:image/${kind};base64,${bytes.toString('base64')}`
}

const workerPath = fileURLToPath(new URL('./importParseWorker.js', import.meta.url))

export async function parseInChild(filePath, { timeoutMs = 20000, mode = 'parse', signal, onBlock = async () => {}, previousBlocks = [] } = {}) {
  if (!tryAcquireHeavyWork()) return { busy: true, kept: true, canContinue: true, filePath }
  let child
  let timer
  let abort
  let exited
  const blocks = [...previousBlocks]
  let checkpoint = Promise.resolve()
  try {
    child = fork(workerPath, [mode, filePath].filter(Boolean), { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: ['--max-old-space-size=192'] })
    exited = new Promise((resolve) => child.once('close', resolve))
    return await new Promise((resolve) => {
      let settled = false
      const finish = (result) => {
        if (settled) return
        settled = true
        resolve({ kept: true, filePath, blocks, ...result })
      }
      const stop = (code) => { child.kill('SIGKILL'); finish({ ok: false, complete: false, code, canContinue: true }) }
      timer = setTimeout(() => stop('PARSE_TIMEOUT'), timeoutMs)
      abort = () => stop('PARSE_CANCELLED')
      signal?.addEventListener('abort', abort, { once: true })
      child.on('message', (message) => {
        if (settled) return
        if (message.type === 'block') {
          checkpoint = checkpoint.then(async () => {
            await onBlock(message.block)
            const index = blocks.findIndex((block) => block.id === message.block.id)
            if (index < 0) blocks.push(message.block)
            else blocks[index] = message.block
            if (!settled && child.connected) child.send({ acknowledged: true })
          }).catch(() => stop('PARSE_CHECKPOINT_FAILED'))
        } else if (message.type === 'result') finish(message)
      })
      child.once('error', () => finish({ ok: false, code: 'PARSE_FAILED', canContinue: true }))
      child.once('exit', () => finish({ ok: false, code: 'PARSE_FAILED', canContinue: true }))
      if (signal?.aborted) abort()
      else child.send({ previousBlocks })
    })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await exited
    await checkpoint
    releaseHeavyWork()
  }
}

export async function acceptUpload({ book, uid, draftId, byteLength, stream, destination, streamToFile: writeStream = streamToFile }) {
  if (!Number.isSafeInteger(byteLength) || byteLength < 1 || byteLength > LIMITS.fileBytes) return { ok: false, code: 'FILE_LIMIT' }
  const reserved = await book.reserve({ uid, bytes: byteLength, draftId })
  if (!reserved.ok) return reserved
  try {
    const actual = await writeStream(stream, destination, { maxBytes: byteLength })
    const settled = await book.settle(draftId, actual)
    if (!settled.ok) { await rm(destination, { force: true }); await book.release(draftId); return settled }
    return { ok: true, bytes: actual, filePath: destination, busy: heavyWorkBusy() }
  } catch (error) {
    await rm(destination, { force: true })
    await book.release(draftId)
    throw error
  }
}
