import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ClassMembership from '../components/ClassMembership'
import { campusData } from '../api'

vi.mock('../api', () => ({ campusData: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('shows the class and disclosed purposes before the one-step join', async () => {
  campusData.mockImplementation(async (path) => {
    if (path === '/me/classes' || path === '/me/guidance') return []
    if (path === '/classes/invitation') return { id: 'class-1', name: '测试班', teacherName: '李老师', consentVersion: 'class-recommendation-v1' }
    if (path === '/classes/join') return { id: 'class-1' }
    throw new Error('Unexpected request')
  })
  render(<ClassMembership />)
  fireEvent.change(screen.getByLabelText('教师给你的班级邀请码'), { target: { value: 'fixture' } })
  fireEvent.click(screen.getByRole('button', { name: '查看邀请' }))
  expect(await screen.findByText('教师：李老师')).toBeVisible()
  expect(screen.getByText(/经 AI 处理/)).toBeVisible()
  expect(screen.getByText(/已下载的文件无法收回/)).toBeVisible()
  expect(campusData).not.toHaveBeenCalledWith('/classes/join', expect.anything())
  fireEvent.click(screen.getByRole('button', { name: '同意以上用途并加入班级' }))
  await waitFor(() => expect(campusData).toHaveBeenCalledWith('/classes/join', expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'fixture', consent: true, consentVersion: 'class-recommendation-v1' }) })))
})
