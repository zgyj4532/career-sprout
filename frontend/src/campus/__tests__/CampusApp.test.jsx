import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import useUnsavedWork from '../hooks/useUnsavedWork'
import CampusApp from '../CampusApp'

vi.mock('../bits/Particles', () => ({ default: () => null }))
vi.mock('../auth', () => ({
  CampusSessionProvider: ({ children }) => children,
  SessionNavigation: () => <span>Session navigation</span>,
}))
vi.mock('../pages/HomePage', () => ({ default: () => <h1>Home route</h1> }))
vi.mock('../pages/ResumePage', () => ({ default: DraftPage }))
vi.mock('../pages/JobsPage', () => ({ default: () => <h1>Jobs route</h1> }))
vi.mock('../pages/ProfilePage', () => ({ default: () => <h1>Profile route</h1> }))
vi.mock('../pages/InterviewPage', () => ({ default: () => <h1>Interview route</h1> }))
vi.mock('../pages/DiscoveryPage', () => ({ default: () => <h1>Discovery route</h1> }))
vi.mock('../pages/InterviewSessionPage', () => ({ default: SessionPage }))
vi.mock('../pages/HistoryPage', () => ({
  HistoryPage: () => <h1>History route</h1>,
  HistoryDetailPage: HistoryDetail,
}))
vi.mock('../pages/AuthPage', () => ({ default: AuthRoute }))
vi.mock('../pages/TeacherPage', () => ({ default: () => <h1>Teacher route</h1> }))
vi.mock('../pages/ClosedPage', () => ({ default: () => <h1>Closed route</h1> }))

function SessionPage() {
  const { id } = useParams()
  return <h1>Session {id}</h1>
}
function HistoryDetail() {
  const { id } = useParams()
  return <h1>History {id}</h1>
}
function AuthRoute() {
  const { pathname } = useLocation()
  return <h1>Auth {pathname}</h1>
}
function DraftPage() {
  const [text, setText] = useState('')
  const allowLeave = useUnsavedWork(Boolean(text))
  const navigate = useNavigate()
  return <>
    <h1>Resume route</h1>
    <label>Resume draft<input value={text} onChange={event => setText(event.target.value)} /></label>
    <button type="button" onClick={() => navigate('/profile')}>Open profile</button>
    <button type="button" onClick={() => { allowLeave(); navigate('/profile') }}>Acknowledge and continue</button>
  </>
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})

it.each([
  ['/', 'Home route'],
  ['/resume', 'Resume route'],
  ['/jd', 'Jobs route'],
  ['/profile', 'Profile route'],
  ['/interview', 'Interview route'],
  ['/discovery', 'Discovery route'],
  ['/interview/session/session-42', 'Session session-42'],
  ['/history', 'History route'],
  ['/history/history-42', 'History history-42'],
  ['/login/sso-callback', 'Auth /login/sso-callback'],
  ['/register/verify-email-address', 'Auth /register/verify-email-address'],
  ['/verify-email/continue', 'Auth /verify-email/continue'],
  ['/teacher', 'Teacher route'],
  ['/unavailable-feature', 'Closed route'],
])('opens the preserved deep link %s inside its eager shell', async (path, heading) => {
  window.history.replaceState(null, '', path)
  render(<CampusApp />)
  expect(await screen.findByRole('heading', { name: heading })).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  if (path.startsWith('/interview/session/')) {
    expect(screen.getByRole('link', { name: '退出练习' })).toHaveAttribute('href', '/interview')
  } else {
    expect(screen.getAllByText('Session navigation').length).toBeGreaterThan(0)
  }
})

it('keeps its data router and dirty editor stable across application rerenders and cancelled navigation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  window.history.replaceState(null, '', '/resume')
  const view = render(<CampusApp />)
  const input = await screen.findByRole('textbox', { name: 'Resume draft' })
  fireEvent.change(input, { target: { value: 'Unsaved resume material' } })
  view.rerender(<CampusApp />)
  expect(screen.getByRole('textbox', { name: 'Resume draft' })).toBe(input)
  expect(input).toHaveValue('Unsaved resume material')
  fireEvent.click(screen.getByRole('button', { name: 'Open profile' }))
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
  expect(window.location.pathname).toBe('/resume')
  expect(input).toHaveValue('Unsaved resume material')
  fireEvent.click(screen.getByRole('button', { name: 'Acknowledge and continue' }))
  expect(await screen.findByRole('heading', { name: 'Profile route' })).toBeVisible()
  expect(window.location.pathname).toBe('/profile')
  expect(confirm).toHaveBeenCalledOnce()
})
