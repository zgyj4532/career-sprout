import { afterEach, expect, it, vi } from 'vitest'
import { campusFetch } from '../api'
import { materialSaveOperation, saveMaterialOperation } from '../saveOperation'

vi.mock('../api', () => ({ campusFetch: vi.fn() }))
afterEach(() => vi.resetAllMocks())

it('recovers a committed create after response loss without posting twice', async () => {
  const saved = { id: 'resume', revision: 1, originalText: 'reviewed text' }
  campusFetch.mockRejectedValueOnce({ status: 0, code: 'NETWORK_ERROR' }).mockResolvedValueOnce({ data: saved })
  const operation = materialSaveOperation('/api/resumes', '', { title: 'draft', originalText: 'reviewed text' })
  expect(await saveMaterialOperation(operation)).toEqual(saved)
  expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
  expect(campusFetch.mock.calls[1][0]).toBe(operation.recoveryPath)
})

it('preserves the frozen operation through unavailable recovery and only replays after explicit absence', async () => {
  campusFetch.mockRejectedValueOnce({ status: 0 }).mockRejectedValueOnce({ status: 503 })
  const payload = { originalText: 'frozen', revision: 7 }
  const operation = materialSaveOperation('/api/resumes', 'resume', payload)
  await expect(saveMaterialOperation(operation)).rejects.toEqual({ status: 0 })
  payload.originalText = 'later edit'
  expect(operation.unknown).toBe(true)
  campusFetch.mockRejectedValueOnce({ code: 'SAVE_NOT_FOUND', status: 404 }).mockResolvedValueOnce({ data: { id: 'resume', revision: 8 } })
  expect(await saveMaterialOperation(operation)).toEqual({ id: 'resume', revision: 8 })
  const writes = campusFetch.mock.calls.filter(([, options]) => options?.method === 'PUT')
  expect(writes).toHaveLength(2)
  expect(writes[0][1].body).toBe(writes[1][1].body)
  expect(JSON.parse(writes[1][1].body).originalText).toBe('frozen')
})

it('does not replay an unknown save when recovery is unavailable', async () => {
  const operation = materialSaveOperation('/api/campus/jobs', '', { title: 'job' })
  operation.unknown = true
  campusFetch.mockRejectedValue({ status: 503 })
  await expect(saveMaterialOperation(operation)).rejects.toEqual({ status: 503 })
  expect(campusFetch).toHaveBeenCalledExactlyOnceWith(operation.recoveryPath)
})

it('keeps a confirmed version conflict editable without treating it as an unknown create', async () => {
  const operation = materialSaveOperation('/api/campus/jobs', 'job', { expectedUpdatedAt: '2026-10-21T00:00:00.000Z' })
  campusFetch.mockRejectedValue({ status: 409, code: 'JOB_CHANGED' })
  await expect(saveMaterialOperation(operation)).rejects.toMatchObject({ code: 'JOB_CHANGED' })
  expect(operation.unknown).toBe(false)
  expect(campusFetch).toHaveBeenCalledTimes(1)
})

it('keeps an admitted pending operation frozen instead of allocating another create', async () => {
  const operation = materialSaveOperation('/api/campus/jobs', '', { title: 'job' })
  campusFetch.mockRejectedValueOnce({ status: 409, code: 'SAVE_PENDING' }).mockRejectedValueOnce({ status: 404, code: 'SAVE_NOT_FOUND' })
  await expect(saveMaterialOperation(operation)).rejects.toMatchObject({ code: 'SAVE_PENDING' })
  expect(operation.unknown).toBe(true)
  expect(campusFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
})

it('treats the durable SAVE_UNKNOWN conflict as uncertain rather than a rejected write', async () => {
  const operation = materialSaveOperation('/api/resumes', '', { title: 'draft' })
  campusFetch.mockRejectedValueOnce({ status: 409, code: 'SAVE_UNKNOWN' }).mockRejectedValueOnce({ status: 503 })
  await expect(saveMaterialOperation(operation)).rejects.toMatchObject({ code: 'SAVE_UNKNOWN' })
  expect(operation.unknown).toBe(true)
  expect(campusFetch.mock.calls[1][0]).toBe(operation.recoveryPath)
})

it('clears uncertainty when an existing recovery operation is acknowledged', async () => {
  const operation = materialSaveOperation('/api/resumes', '', { title: 'draft' })
  operation.unknown = true
  campusFetch.mockResolvedValue({ data: { id: 'saved', revision: 1 } })
  await saveMaterialOperation(operation)
  expect(operation.unknown).toBe(false)
  expect(campusFetch).toHaveBeenCalledTimes(1)
})
