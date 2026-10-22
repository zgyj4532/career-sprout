import { afterEach, expect, it, vi } from 'vitest'
import { campusData } from '../api'
import { continueWithJob, emptyPrep, loadInterviewPrep, saveInterviewPrep } from '../import/interviewPrep'
vi.mock('../api', () => ({ campusData: vi.fn() }))
afterEach(() => { localStorage.clear(); vi.clearAllMocks() })
it('keeps preparation isolated by authenticated identity', () => {
  saveInterviewPrep('student-a', { ...emptyPrep(), text: '私有经历', count: 8 })
  expect(loadInterviewPrep('student-b')).toBeNull()
  expect(loadInterviewPrep('student-a')).toMatchObject({ text: '私有经历', count: 8 })
  expect(loadInterviewPrep(null)).toBeNull()
})
it('persists the saved job title while retaining the handwritten direction and settings', async () => {
  campusData.mockResolvedValue({})
  const next = await continueWithJob('student-a', { ...emptyPrep(), manualRole: '手填方向', jobRole: '手填方向', count: 6, mode: 'technical', text: '项目经历' }, { id: '123456789012345678901234', title: '已保存岗位' })
  expect(next).toMatchObject({ manualRole: '手填方向', jobRole: '已保存岗位', savedJobTitle: '已保存岗位', count: 6, mode: 'technical', text: '项目经历' })
  expect(loadInterviewPrep('student-a')).toEqual(next)
  expect(JSON.parse(campusData.mock.calls[0][1].body)).toMatchObject({ jobRole: '已保存岗位', resumeId: null })
})
it('keeps the saved job locally when account preparation saving fails', async () => {
  campusData.mockRejectedValue(new Error('offline'))
  await expect(continueWithJob('student-a', emptyPrep(), { id: 'saved', title: '真实岗位' })).rejects.toThrow('offline')
  expect(loadInterviewPrep('student-a')).toMatchObject({ jobId: 'saved', jobRole: '真实岗位' })
})
