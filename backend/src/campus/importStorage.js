import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { CampusImportQuota } from './models.js'
import { createQuotaBook } from './importQuota.js'
import { campusError } from './errors.js'

export const IMPORT_ROOT = path.resolve(process.env.CAMPUS_IMPORT_DIR || path.join(os.homedir(), '.career-sprout', 'imports'))
export const IMPORT_WORK_BYTES = 2 * 1024 * 1024
export const importQuotaBook = createQuotaBook(CampusImportQuota)

export function importRecordBytes(draft, ledger) {
  return Buffer.byteLength(JSON.stringify(draft?.toObject ? draft.toObject() : draft || {}))
    + (ledger ? Buffer.byteLength(JSON.stringify(ledger?.toObject ? ledger.toObject() : ledger)) : 0)
}

export async function accountImport(draft, ledger, { processing = false } = {}) {
  const bytes = (draft.bytes || 0) + importRecordBytes(draft, ledger) + (processing ? IMPORT_WORK_BYTES : 0)
  let settled = await importQuotaBook.settle(String(draft._id), bytes)
  if (settled.code === 'HOLD_MISSING') settled = await importQuotaBook.reserve({ uid: draft.userId, draftId: String(draft._id), bytes })
  if (!settled.ok) throw campusError(409, settled.code, '暂存空间不足，原件仍保留。请清理自己的导入，或稍后继续。')
  draft.reservedBytes = bytes
  return bytes
}

export async function removeImportFiles(draft) {
  const files = new Set([draft.filePath, ...(draft.files || []).map((file) => file.filePath)].filter(Boolean))
  for (const file of files) {
    await fs.rm(file, { force: true })
    await fs.rm(`${file}.partial`, { force: true })
  }
}
