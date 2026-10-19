import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import ProfilePage from '../ProfilePage'
import { campusData, campusFetch } from '../../api'

vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), downloadDiagnostics: vi.fn(), errorText: () => '请求未完成' }))
vi.mock('../../components/SharingControls', () => ({ default: () => null }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
it('sends an explicit blank stage when clearing a previously saved year and reloads it', async () => {
  let profile = { displayName: '测试学生', studyStage: '大三', location: '', bio: '', skills: [] }
  const student = { interests: [], experiences: [], skillAssessments: [], availability: {}, targetJobId: null }
  campusData.mockImplementation(async () => ({ profile, student }))
  campusFetch.mockImplementation(async (path, options) => {
    expect(path).toBe('/api/user-profiles/me')
    profile = { ...profile, ...JSON.parse(options.body) }
    return { profile }
  })
  const view = render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  const stage = await screen.findByLabelText('年级')
  expect(stage).toHaveValue('大三')
  fireEvent.change(stage, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: '保存档案与成长材料' }))
  await waitFor(() => expect(campusFetch).toHaveBeenCalledOnce())
  expect(JSON.parse(campusFetch.mock.calls[0][1].body).studyStage).toBe('')
  await screen.findByText(/档案与成长材料已保存/)
  view.unmount()
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  expect(await screen.findByLabelText('年级')).toHaveValue('')
})
