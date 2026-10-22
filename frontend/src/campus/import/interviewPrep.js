import { campusData } from '../api'

const PREP_KEY = 'campus-interview-prep'
export function emptyPrep() {
  return { jobRole: '', manualRole: '', mode: 'mixed', count: 4, resumeId: '', text: '', jobId: '', savedJobTitle: '' }
}
export function loadInterviewPrep(uid, storage = globalThis.localStorage) {
  if (!uid) return null
  try { const parsed = JSON.parse(storage.getItem(`${PREP_KEY}:${uid}`) || 'null'); return parsed ? { ...emptyPrep(), ...parsed } : null } catch { return null }
}
export function saveInterviewPrep(uid, prep, storage = globalThis.localStorage) {
  if (!uid) return prep
  const next = Object.fromEntries(Object.entries(emptyPrep()).map(([key, fallback]) => [key, prep[key] ?? fallback]))
  storage.setItem(`${PREP_KEY}:${uid}`, JSON.stringify(next))
  return next
}
export function persistInterviewPrep(prep) {
  const fields = Object.fromEntries(Object.entries(emptyPrep()).map(([key, fallback]) => [key, prep[key] ?? fallback]))
  return campusData('/me/interview-prep', { method: 'PUT', body: JSON.stringify({ ...fields, jobId: fields.jobId || null, resumeId: fields.resumeId || null }) })
}
export async function continueWithJob(uid, prep, job) {
  const next = saveInterviewPrep(uid, { ...emptyPrep(), ...prep, jobId: job.id, savedJobTitle: job.title, jobRole: job.title })
  await persistInterviewPrep(next)
  return next
}
