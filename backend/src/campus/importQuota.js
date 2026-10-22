export const QUOTA = {
  maxDrafts: 10,
  userBytes: 80 * 1024 * 1024,
  globalBytes: 500 * 1024 * 1024,
}

// A single compare-and-swap document admits all users together. Separate user
// and global counters cannot provide this guarantee without Mongo transactions.
export function createQuotaBook(model) {
  let memory = { revision: 0, holds: {} }
  const load = async () => {
    if (!model) return structuredClone(memory)
    await model.updateOne({ _id: 'imports' }, { $setOnInsert: { revision: 0, holds: {} } }, { upsert: true }).catch((error) => { if (error.code !== 11000) throw error })
    return model.findById('imports').lean()
  }
  const mutate = async (operation) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const state = await load()
      const result = operation(state.holds)
      if (!result.ok || result.unchanged) return result
      if (!model) {
        if (memory.revision !== state.revision) continue
        memory = { revision: state.revision + 1, holds: state.holds }
        return result
      }
      const written = await model.updateOne({ _id: 'imports', revision: state.revision }, { $set: { holds: state.holds }, $inc: { revision: 1 } })
      if (written.matchedCount) return result
    }
    throw Object.assign(new Error('容量预留繁忙，请稍后再试。'), { code: 'QUOTA_BUSY', statusCode: 503 })
  }
  const usage = (holds, uid) => Object.values(holds).reduce((total, hold) => {
    total.globalBytes += hold.bytes
    if (hold.uid === uid) {
      total.bytes += hold.bytes
      total.drafts += hold.unfinished === false ? 0 : 1
    }
    return total
  }, { globalBytes: 0, bytes: 0, drafts: 0 })
  return {
    async snapshot() {
      const { holds } = await load()
      return { globalBytes: usage(holds).globalBytes, users: new Set(Object.values(holds).map((hold) => hold.uid)).size, holds: Object.keys(holds).length }
    },
    reserve({ uid, bytes, draftId }) {
      if (!Number.isSafeInteger(bytes) || bytes < 0 || !/^[a-zA-Z0-9_-]+$/.test(draftId)) throw new Error('Invalid quota reservation')
      return mutate((holds) => {
        if (holds[draftId]) return holds[draftId].uid === uid ? { ok: true, reserved: holds[draftId].bytes, reused: true, unchanged: true } : { ok: false, code: 'QUOTA_OWNER' }
        const used = usage(holds, uid)
        if (used.drafts >= QUOTA.maxDrafts) return { ok: false, code: 'USER_DRAFT_LIMIT' }
        if (used.bytes + bytes > QUOTA.userBytes) return { ok: false, code: 'USER_BYTE_LIMIT' }
        if (used.globalBytes + bytes > QUOTA.globalBytes) return { ok: false, code: 'GLOBAL_FULL', retry: used.bytes ? 'discard-own' : 'later' }
        holds[draftId] = { uid, bytes, unfinished: true }
        return { ok: true, reserved: bytes }
      })
    },
    settle(draftId, bytes) {
      if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid quota usage')
      return mutate((holds) => {
        const hold = holds[draftId]
        if (!hold) return { ok: false, code: 'HOLD_MISSING' }
        const used = usage(holds, hold.uid)
        const delta = bytes - hold.bytes
        if (delta > 0 && (used.bytes + delta > QUOTA.userBytes || used.globalBytes + delta > QUOTA.globalBytes)) return { ok: false, code: 'QUOTA_SETTLE' }
        hold.bytes = bytes
        return { ok: true, bytes }
      })
    },
    complete(draftId) {
      return mutate((holds) => {
        if (holds[draftId]) holds[draftId].unfinished = false
        return { ok: true }
      })
    },
    release(draftId) {
      return mutate((holds) => { delete holds[draftId]; return { ok: true } })
    },
  }
}

export function actualUsage(parts) {
  return parts.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
}
