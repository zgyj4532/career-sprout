import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import ProfilePage from '../ProfilePage'
import { campusData, campusFetch } from '../../api'

vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), downloadBlob: vi.fn(), downloadDiagnostics: vi.fn(), errorText: (error) => error?.message }))
vi.mock('../../components/SharingControls', () => ({ default: () => null }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('locks the actual profile inputs during import confirmation and the following refresh', async () => {
  const student = { interests: [], experiences: [], skillAssessments: [], availability: {} }
  const draft = { id: 'draft', status: 'ready', resumeId: 'resume', resumeTitle: '确认简历', resumeChoices: [{ id: 'resume', title: '确认简历' }], issues: [], candidates: [], result: { name: '导入姓名', education: [], experiences: [], skills: [], otherMaterials: '' } }
  let finishSave
  let finishRefresh
  let profileReads = 0
  campusData.mockImplementation(async (path) => {
    if (path === '/imports') return { items: [draft] }
    if (path === '/imports/draft') return draft
    if (path === '/me') {
      profileReads += 1
      if (profileReads === 1) return { profile: { displayName: '原姓名', skills: [] }, student }
      return new Promise((resolve) => { finishRefresh = resolve })
    }
    throw new Error(path)
  })
  campusFetch.mockImplementation(() => new Promise((resolve) => { finishSave = resolve }))
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  const input = await screen.findByDisplayValue('原姓名')
  fireEvent.click(await screen.findByRole('button', { name: '确认简历 · ready' }))
  fireEvent.click(await screen.findByRole('button', { name: '补充我的档案，并更新《确认简历》' }))
  expect(input).toBeDisabled()
  await act(async () => finishSave({ saved: true, data: { ...draft, saved: true, status: 'saved' } }))
  await waitFor(() => expect(profileReads).toBe(2))
  expect(input).toBeDisabled()
  await act(async () => finishRefresh({ profile: { displayName: '已保存姓名', skills: [] }, student }))
  await waitFor(() => expect(input).toBeEnabled())
  expect(input).toHaveValue('已保存姓名')
  fireEvent.change(input, { target: { value: '刷新后的新编辑' } })
  expect(input).toHaveValue('刷新后的新编辑')
})
