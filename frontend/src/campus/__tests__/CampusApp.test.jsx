import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import useUnsavedWork from '../hooks/useUnsavedWork'
import CampusApp from '../CampusApp'
import { CampusApiError } from '../api'

const session = vi.hoisted(() => ({ status: null, error: null, loadingStage: null, pendingSession: false, refresh: vi.fn() }))

vi.mock('../bits/Particles', () => ({ default: () => null }))
vi.mock('../auth', () => ({
  CampusSessionProvider: ({ children }) => children,
  SessionNavigation: () => <span>Session navigation</span>,
  useCampusSession: function useMockSession() {
    const [value, setValue] = useState({ ...session })
    session.update = setValue
    return value
  },
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

beforeEach(() => {
  session.status = { mode: 'clerk', authenticated: true, user: { uid: 'student' } }
  session.error = null
  session.loadingStage = null
  session.pendingSession = false
  session.refresh.mockReset()
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
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

it('opens the business homepage for the local identity without a login redirect', async () => {
  session.status = { mode: 'local', authenticated: true, user: { uid: 'campus-local-dev', isTeacher: false } }
  render(<CampusApp />)
  expect(await screen.findByRole('heading', { name: 'Home route' })).toBeVisible()
  expect(window.location.pathname).toBe('/')
  expect(screen.queryByRole('heading', { name: 'Auth /login' })).not.toBeInTheDocument()
})

it('redirects only the anonymous root and retains explicit public deep links', async () => {
  session.status = { mode: 'clerk', authenticated: false, user: null }
  const view = render(<CampusApp />)
  expect(await screen.findByRole('heading', { name: 'Auth /login' })).toBeVisible()
  expect(window.location.pathname).toBe('/login')
  view.unmount()
  window.history.replaceState(null, '', '/teacher?view=students')
  render(<CampusApp />)
  expect(await screen.findByRole('heading', { name: 'Teacher route' })).toBeVisible()
  expect(window.location.search).toBe('?view=students')
})

it('waits for real session status at root and retains the business homepage after sign-in', async () => {
  session.status = null
  session.loadingStage = 'session'
  render(<CampusApp />)
  expect(screen.getByRole('status')).toHaveTextContent('正在确认账号服务状态')
  expect(screen.queryByRole('heading', { name: 'Home route' })).not.toBeInTheDocument()
  expect(window.location.pathname).toBe('/')
  session.status = { mode: 'clerk', authenticated: true, user: { uid: 'student' } }
  session.loadingStage = null
  act(() => session.update({ ...session }))
  expect(await screen.findByRole('heading', { name: 'Home route' })).toBeVisible()
  expect(window.location.pathname).toBe('/')
})

it('keeps session errors actionable at root without redirect loops', async () => {
  session.status = null
  session.error = new CampusApiError('账号状态暂不可用，请重试。', 503, { code: 'AUTH_UNAVAILABLE' })
  render(<CampusApp />)
  expect(screen.getByRole('alert')).toHaveTextContent('账号状态暂不可用')
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  expect(session.refresh).toHaveBeenCalledOnce()
  expect(window.location.pathname).toBe('/')
  fireEvent.click(screen.getByRole('link', { name: '前往登录与账号恢复' }))
  expect(await screen.findByRole('heading', { name: 'Auth /login' })).toBeVisible()
})

it('routes pending provider tasks to account recovery, not the business homepage', async () => {
  session.status = null
  session.pendingSession = true
  render(<CampusApp />)
  expect(await screen.findByRole('heading', { name: 'Auth /login' })).toBeVisible()
})

it('keeps the deployment basename exactly once on anonymous root redirect', async () => {
  vi.stubEnv('BASE_URL', '/career-sprout/')
  session.status = { mode: 'clerk', authenticated: false, user: null }
  window.history.replaceState(null, '', '/career-sprout/')
  render(<CampusApp />)
  expect(await screen.findByRole('heading', { name: 'Auth /login' })).toBeVisible()
  expect(window.location.pathname).toBe('/career-sprout/login')
})
