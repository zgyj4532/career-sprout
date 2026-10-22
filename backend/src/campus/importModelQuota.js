import { createHash } from 'node:crypto'
import { CampusImportModelQuota } from './models.js'
import { campusError } from './errors.js'

export const importModelQuota = {
  async take(uid, operationId) {
    const id = createHash('sha256').update(uid).digest('hex')
    const day = new Date().toISOString().slice(0, 10)
    const operation = String(operationId)
    // Remember operation identity across midnight/restarts; recovery never costs
    // another daily operation. Each day has its own atomic bounded admission.
    if (await CampusImportModelQuota.exists({ _id: { $regex: `^${id}:` }, operations: operation })) return { counted: false }
    const key = `${id}:${day}`
    await CampusImportModelQuota.updateOne({ _id: key }, { $setOnInsert: { operations: [] } }, { upsert: true }).catch((error) => { if (error.code !== 11000) throw error })
    const admitted = await CampusImportModelQuota.updateOne({ _id: key, $or: [{ operations: operation }, { 'operations.19': { $exists: false } }] }, { $addToSet: { operations: operation } })
    if (!admitted.matchedCount) throw campusError(429, 'IMPORT_DAILY_LIMIT', '今天的材料整理额度已用完，原件保留，可以明天继续。')
    return { counted: Boolean(admitted.modifiedCount) }
  },
}
