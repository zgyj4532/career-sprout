import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CampusSessionProvider, safeReturnTo, SessionNavigation, useCampusSession } from '../auth'
import { CampusApiError, campusData } from '../api'
import RequestError from '../components/RequestError'

const clerkState = vi.hoisted(() => ({ isLoaded: false, sessionId: null, sessionStatus: null, status: 'loading', signOut: vi.fn() }))
vi.mock('@clerk/react', () => ({
  useSession: () => ({ isLoaded: clerkState.isLoaded, session: clerkState.sessionId ? { id: clerkState.sessionId, status: clerkState.sessionStatus } : null }),
  useClerk: () => ({ status: clerkState.status, signOut: clerkState.signOut }),
  SignIn: () => <div role="region" aria-label="Clerk sign-in form" />,
  SignUp: () => <div role="region" aria-label="Clerk sign-up form" />,
  UserProfile: () => <div role="region" aria-label="Clerk profile form" />,
}))
vi.mock('../api', async (importOriginal) => ({ ...(await importOriginal()), campusData: vi.fn() }))


const anonymous = { mode: 'clerk', authenticated: false, user: null }
const signedIn = { mode: 'clerk', authenticated: true, user: { id: 'test-user', emailVerified: true } }

function LocationProbe() {
  const { pathname, search, hash } = useLocation()
  return <output aria-label="Current destination">{`${pathname}${search}${hash}`}</output>
}

async function renderAuthRoute(path, basename = '/') {
  const { default: AuthPage } = await import('../pages/AuthPage')
  const route = () => (
    <MemoryRouter basename={basename} initialEntries={[path]}>
      <CampusSessionProvider>
        <LocationProbe />
        <Routes>
          <Route path="/login/*" element={<AuthPage />} />
          <Route path="/register/*" element={<AuthPage />} />
          <Route path="/verify-email/*" element={<AuthPage />} />
          <Route path="*" element={<h1>Business destination</h1>} />
        </Routes>
      </CampusSessionProvider>
    </MemoryRouter>
  )
  const view = render(route())
  await act(async () => {})
  return { ...view, refreshSession: () => view.rerender(route()) }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function ready(sessionId = null) {
  clerkState.isLoaded = true
  clerkState.status = 'ready'
  clerkState.sessionId = sessionId
  clerkState.sessionStatus = sessionId ? 'active' : null
}

function SessionConsumer() {
  const { status, error, loadingStage, refresh } = useCampusSession()
  return <>
    {loadingStage && <p role="status">{loadingStage}</p>}
    <RequestError error={error} onRetry={refresh} />
    {status && <p>{status.authenticated ? 'Signed in' : 'Signed out'}</p>}
  </>
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'test-key-only-sdk-is-mocked')
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_CLERK_SIGN_UP_ENABLED', 'true')
  clerkState.isLoaded = false
  clerkState.sessionId = null
  clerkState.sessionStatus = null
  clerkState.status = 'loading'
  clerkState.signOut.mockReset().mockResolvedValue(undefined)
  campusData.mockReset().mockResolvedValue(anonymous)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('campus authentication lifecycle', () => {
  it('keeps pending provider tasks distinct from anonymous and refreshes when the same session becomes active', async () => {
    ready('session-pending')
    clerkState.sessionStatus = 'pending'
    const { result, rerender } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    await act(async () => {})
    expect(result.current.pendingSession).toBe(true)
    expect(result.current.clerkSessionActive).toBe(false)
    expect(result.current.status).toBeNull()
    expect(result.current.loadingStage).toBeNull()
    expect(campusData).not.toHaveBeenCalled()
    campusData.mockResolvedValue(signedIn)
    clerkState.sessionStatus = 'active'
    rerender()
    await act(async () => {})
    expect(result.current.pendingSession).toBe(false)
    expect(result.current.status).toEqual(signedIn)
  })

  it('does not restart sign-in when an active provider session is unrecognized by the backend', async () => {
    ready('session-active')
    const { result } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    await act(async () => {})
    expect(result.current.status).toBeNull()
    expect(result.current.error?.code).toBe('SESSION_NOT_RECOGNIZED')
    expect(result.current.clerkSessionActive).toBe(true)
    campusData.mockResolvedValue(signedIn)
    await act(() => result.current.refresh())
    expect(result.current.status).toEqual(signedIn)
    expect(result.current.error).toBeNull()
  })

  it('preserves deep-link query and fragment when offering sign-in without granting teacher access', async () => {
    ready()
    render(<MemoryRouter initialEntries={['/teacher?view=students#pending']}><CampusSessionProvider><SessionNavigation /></CampusSessionProvider></MemoryRouter>)
    await act(async () => {})
    expect(screen.getByRole('link', { name: '登录 / 注册' })).toHaveAttribute('href', '/login?returnTo=%2Fteacher%3Fview%3Dstudents%23pending')
    expect(screen.queryByRole('link', { name: '教师荐才' })).not.toBeInTheDocument()
  })

  it('bounds SDK initialization, exposes safe recovery and retries the current document instead of querying an unavailable SDK', async () => {
    const { result } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    expect(result.current.loadingStage).toBe('clerk')
    expect(campusData).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(result.current.status).toBeNull()
    expect(result.current.loadingStage).toBeNull()
    expect(result.current.error).toBeInstanceOf(CampusApiError)
    expect(result.current.error.code).toBe('CLERK_LOAD_TIMEOUT')
    expect(result.current.error.message).toMatch(/Clerk/)
    expect(result.current.error.message).toMatch(/未保存/)
    const location = { href: 'https://campus.test/login?returnTo=%2Fprofile', reload: vi.fn() }
    // JSDOM's Location.reload is unforgeable; replace only the global read used by refresh.
    vi.stubGlobal('window', { location })
    await act(() => result.current.refresh())
    expect(location.reload).toHaveBeenCalledOnce()
    expect(location.href).toBe('https://campus.test/login?returnTo=%2Fprofile')
    expect(campusData).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('shows an SDK-reported failure promptly without exposing provider internals', async () => {
    const { result, rerender } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    clerkState.status = 'error'
    rerender()
    expect(result.current.error?.code).toBe('CLERK_LOAD_FAILED')
    expect(result.current.loadingStage).toBeNull()
    expect(campusData).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(result.current.error.code).toBe('CLERK_LOAD_FAILED')
  })

  it.each([1000, 21000])('recovers when Clerk becomes ready after %i ms and clears the initialization timer', async (delay) => {
    const response = deferred()
    campusData.mockReturnValue(response.promise)
    const { result, rerender } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    await act(() => vi.advanceTimersByTimeAsync(delay))
    ready()
    rerender()
    expect(result.current.loadingStage).toBe('session')
    expect(result.current.error).toBeNull()
    await act(async () => { response.resolve(anonymous) })
    expect(result.current.status).toEqual(anonymous)
    expect(result.current.loadingStage).toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(result.current.error).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds a non-settling account request, aborts it and ignores its eventual success after recovery', async () => {
    ready()
    const stale = deferred()
    campusData.mockReturnValueOnce(stale.promise)
    const { result } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    const signal = campusData.mock.calls[0][1].signal
    expect(result.current.loadingStage).toBe('session')
    await act(() => vi.advanceTimersByTimeAsync(15000))
    expect(signal.aborted).toBe(true)
    expect(result.current.error?.code).toBe('SESSION_STATUS_TIMEOUT')
    expect(result.current.loadingStage).toBeNull()
    expect(result.current.status).toBeNull()
    await act(() => result.current.refresh())
    expect(result.current.status).toEqual(anonymous)
    expect(result.current.error).toBeNull()
    await act(async () => { stale.resolve(signedIn) })
    expect(result.current.status).toEqual(anonymous)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves visible safe API errors and recovers through the consumer retry action', async () => {
    ready()
    const response = deferred()
    const failure = new CampusApiError('账号服务暂时不可用，请稍后重试。', 503, { code: 'AUTH_UNAVAILABLE', requestId: 'test-request' })
    campusData.mockReturnValueOnce(response.promise)
    render(<CampusSessionProvider><SessionConsumer /></CampusSessionProvider>)
    expect(screen.getByRole('status')).toHaveTextContent('session')
    await act(async () => { response.reject(failure) })
    expect(screen.getByRole('alert')).toHaveTextContent('账号服务暂时不可用')
    expect(screen.getByRole('alert')).toHaveTextContent('test-request')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('Signed out')).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试' })) })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Signed out')).toBeVisible()
  })

  it('replaces unknown failures with safe session guidance rather than provider text', async () => {
    ready()
    campusData.mockRejectedValue(new Error('PRIVATE_PROVIDER_URL_AND_TOKEN'))
    render(<CampusSessionProvider><SessionConsumer /></CampusSessionProvider>)
    await act(async () => {})
    expect(screen.getByRole('alert')).toHaveTextContent('确认账号状态')
    expect(screen.getByRole('alert')).not.toHaveTextContent('PRIVATE_PROVIDER_URL_AND_TOKEN')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('ignores stale errors from an older refresh without clearing the newer pending stage', async () => {
    ready()
    const first = deferred()
    const next = deferred()
    campusData.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise)
    const { result } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    let refreshed
    act(() => { refreshed = result.current.refresh() })
    expect(campusData.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => { first.reject(new CampusApiError('Old failure')) })
    expect(result.current.loadingStage).toBe('session')
    expect(result.current.error).toBeNull()
    await act(async () => { next.resolve(anonymous); await refreshed })
    expect(result.current.status).toEqual(anonymous)
    expect(result.current.loadingStage).toBeNull()
  })

  it('clears old account state on a session change and rejects a prior identity response', async () => {
    ready('session-one')
    campusData.mockResolvedValueOnce(signedIn)
    const { result, rerender } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    await act(async () => {})
    expect(result.current.status).toEqual(signedIn)
    const oldResponse = deferred()
    const currentResponse = deferred()
    campusData.mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(currentResponse.promise)
    act(() => { void result.current.refresh() })
    ready('session-two')
    rerender()
    expect(result.current.status).toBeNull()
    expect(campusData.mock.calls[1][1].signal.aborted).toBe(true)
    const current = { ...signedIn, user: { id: 'test-user-two', emailVerified: true } }
    await act(async () => { currentResponse.resolve(current) })
    await act(async () => { oldResponse.resolve(signedIn) })
    expect(result.current.status).toEqual(current)
  })

  it('redirects Clerk sign-out to the app login route under the configured base path', async () => {
    vi.stubEnv('BASE_URL', '/career-sprout/')
    ready('session-one')
    const oldResponse = deferred()
    campusData.mockReturnValueOnce(oldResponse.promise)
    const { result } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    const signal = campusData.mock.calls[0][1].signal
    await act(() => result.current.signOut())
    expect(signal.aborted).toBe(true)
    expect(clerkState.signOut).toHaveBeenCalledWith({ redirectUrl: '/career-sprout/login' })
    expect(result.current.status).toEqual(anonymous)
    await act(async () => { oldResponse.resolve(signedIn) })
    expect(result.current.status).toEqual(anonymous)
  })

  it('refreshes account status after logout when Clerk keeps the same session ID', async () => {
    ready('session-one')
    campusData.mockResolvedValueOnce(signedIn).mockResolvedValueOnce(anonymous)
    const { result } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    await act(async () => {})
    expect(result.current.status).toEqual(signedIn)

    await act(() => result.current.signOut())

    expect(clerkState.sessionId).toBe('session-one')
    expect(campusData).toHaveBeenCalledTimes(2)
    expect(campusData.mock.calls[1][0]).toBe('/auth/status')
    expect(result.current.status).toEqual(anonymous)
  })

  it('ignores a stale logout failure after switching to another session', async () => {
    ready('session-one')
    const logout = deferred()
    clerkState.signOut.mockReturnValue(logout.promise)
    const { result, rerender } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    await act(async () => {})
    let signingOut
    act(() => { signingOut = result.current.signOut() })
    campusData.mockResolvedValue(signedIn)
    ready('session-two')
    rerender()
    await act(async () => {})
    await act(async () => { logout.reject(new Error('PRIVATE_SIGN_OUT_ERROR')); await signingOut })
    expect(result.current.status).toEqual(signedIn)
    expect(result.current.error).toBeNull()
  })

  it('keeps logout failures recoverable and does not expose raw SDK errors', async () => {
    ready('session-one')
    clerkState.signOut.mockRejectedValue(new Error('PRIVATE_SIGN_OUT_ERROR'))
    const { result } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    await act(() => result.current.signOut())
    expect(result.current.status).toBeNull()
    expect(result.current.loadingStage).toBeNull()
    expect(result.current.error?.code).toBe('SIGN_OUT_FAILED')
    expect(result.current.error.message).not.toContain('PRIVATE_SIGN_OUT_ERROR')
    campusData.mockResolvedValue(signedIn)
    await act(() => result.current.refresh())
    expect(result.current.status).toEqual(signedIn)
  })

  it('cancels timers and requests on unmount and tolerates StrictMode effect cleanup', async () => {
    ready()
    const abandoned = deferred()
    campusData.mockReturnValueOnce(abandoned.promise)
    const { result, unmount } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider, reactStrictMode: true })
    await act(async () => {})
    expect(campusData.mock.calls[0][1].signal.aborted).toBe(true)
    expect(result.current.status).toEqual(anonymous)
    const pending = deferred()
    campusData.mockReturnValueOnce(pending.promise)
    let refreshed
    act(() => { refreshed = result.current.refresh() })
    const signal = campusData.mock.calls.at(-1)[1].signal
    unmount()
    await act(async () => { await refreshed; abandoned.resolve(signedIn); pending.resolve(signedIn) })
    expect(signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shows SDK timeout guidance through RequestError rather than the generic fallback', async () => {
    render(<CampusSessionProvider><SessionConsumer /></CampusSessionProvider>)
    expect(screen.getByRole('status')).toHaveTextContent('clerk')
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(screen.getByRole('alert')).toHaveTextContent('Clerk')
    expect(screen.getByRole('alert')).toHaveTextContent('刷新当前页面')
    expect(screen.getByRole('alert')).toHaveTextContent('未保存')
    expect(screen.getByRole('button', { name: '重试' })).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('reports an unknown logout outcome after its deadline and reconciles without declaring success', async () => {
    ready('session-one')
    campusData.mockResolvedValue(signedIn)
    const logout = deferred()
    clerkState.signOut.mockReturnValue(logout.promise)
    const { result } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    await act(async () => {})
    let signingOut
    act(() => { signingOut = result.current.signOut() })
    await act(() => vi.advanceTimersByTimeAsync(15000))
    await act(async () => { await signingOut })
    expect(result.current.status).toBeNull()
    expect(result.current.loadingStage).toBeNull()
    expect(result.current.error?.code).toBe('SIGN_OUT_TIMEOUT')
    await act(() => result.current.refresh())
    expect(result.current.status).toEqual(signedIn)
    await act(async () => { logout.resolve() })
    expect(result.current.status).toEqual(signedIn)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not turn a missing account-status response into perpetual loading', async () => {
    ready()
    campusData.mockResolvedValue(undefined)
    const { result } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    await act(async () => {})
    expect(result.current.status).toBeNull()
    expect(result.current.loadingStage).toBeNull()
    expect(result.current.error?.code).toBe('INVALID_RESPONSE')
  })

  it('clears the SDK initialization timer on unmount', () => {
    const { unmount } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(campusData).not.toHaveBeenCalled()
  })

  it('still obtains the unconfigured local status from the backend without waiting for Clerk', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '')
    const local = { mode: 'local', authenticated: true, user: { id: 'test-local' } }
    campusData.mockResolvedValue(local)
    const { result } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    expect(result.current.loadingStage).toBe('session')
    await act(async () => {})
    expect(result.current.status).toEqual(local)
    expect(result.current.error).toBeNull()
    expect(result.current.loadingStage).toBeNull()
  })
 
  it.each([
    ['/login', 'Clerk sign-in form'],
    ['/register', 'Clerk sign-up form'],
  ])('keeps %s unavailable until backend status is known and offers retry after failure', async (path, form) => {
    ready()
    const response = deferred()
    campusData.mockReturnValueOnce(response.promise)
    await renderAuthRoute(`${path}?returnTo=%2Fprofile`)
    expect(within(screen.getByRole('region', { name: path === '/login' ? '账号登录' : '账号注册' })).getByRole('status')).toBeVisible()
    expect(screen.queryByRole('region', { name: form })).not.toBeInTheDocument()
    await act(async () => { response.reject(new CampusApiError('账号状态暂不可用', 503)) })
    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.queryByRole('region', { name: form })).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试' })) })
    expect(screen.getByRole('region', { name: form })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Current destination')).toHaveTextContent(`${path}?returnTo=%2Fprofile`)
    expect(screen.queryByRole('heading', { name: 'Business destination' })).not.toBeInTheDocument()
  })
})

describe('safe return destinations', () => {
  it.each([
    ['/teacher?view=students#pending', '/teacher?view=students#pending'],
    ['/history/record-42?label=%E7%AE%80%E5%8E%86#notes', '/history/record-42?label=%E7%AE%80%E5%8E%86#notes'],
    ['/career-sprout/teacher?view=students#pending', '/teacher?view=students#pending'],
    ['/career-sprout/', '/'],
    ['/resume/../profile', '/profile'],
  ])('preserves internal destination %s without duplicating the deployment base', (input, expected) => {
    vi.stubEnv('BASE_URL', '/career-sprout/')
    expect(safeReturnTo(input)).toBe(expected)
  })

  it.each([
    null, '', 'https://evil.test', '//evil.test', '/\\evil.test', '/%2f%2fevil.test',
    '/%5cevil.test', '/%252f%252fevil.test', '/%00', '/bad%encoding', '/login',
    '/register/verify-email', '/verify-email?returnTo=/teacher', '/resume/../login',
    '/career-sprout/login', '/career-sprout/%6cogin', '/career-sprout/register#verify',
  ])('rejects unsafe or looping destination %s', (input) => {
    vi.stubEnv('BASE_URL', '/career-sprout/')
    expect(safeReturnTo(input)).toBe('/')
  })
})

describe('authentication page session navigation', () => {
  it.each(['/login', '/register'])('leaves %s for a signed-in user and preserves the deep destination', async (path) => {
    ready('session-active')
    campusData.mockResolvedValue(signedIn)
    await renderAuthRoute(`${path}?returnTo=${encodeURIComponent('/history/record-42?view=notes#answer')}`)
    expect(screen.getByLabelText('Current destination')).toHaveTextContent('/history/record-42?view=notes#answer')
    expect(screen.getByRole('heading', { name: 'Business destination' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Clerk sign-in form' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Clerk sign-up form' })).not.toBeInTheDocument()
  })

  it.each(['/login', '/register'])('sends an unsafe signed-in destination from %s to home without a login loop', async (path) => {
    ready('session-active')
    campusData.mockResolvedValue(signedIn)
    await renderAuthRoute(`${path}?returnTo=https%3A%2F%2Fevil.test`)
    expect(screen.getByLabelText('Current destination')).toHaveTextContent(/^\/$/)
    expect(screen.getByRole('heading', { name: 'Business destination' })).toBeVisible()
  })

  it.each(['/login', '/register'])('strips the public basename once before navigation from %s', async (path) => {
    vi.stubEnv('BASE_URL', '/career-sprout/')
    ready('session-active')
    campusData.mockResolvedValue(signedIn)
    await renderAuthRoute(`/career-sprout${path}?returnTo=%2Fcareer-sprout%2Fprofile`, '/career-sprout')
    expect(screen.getByLabelText('Current destination')).toHaveTextContent(/^\/profile$/)
  })

  it('keeps explicit email verification available for the authenticated account', async () => {
    ready('session-active')
    campusData.mockResolvedValue(signedIn)
    await renderAuthRoute('/verify-email?returnTo=%2Fprofile')
    expect(screen.getByRole('region', { name: 'Clerk profile form' })).toBeVisible()
    expect(screen.getByRole('link', { name: '继续使用职芽' })).toHaveAttribute('href', '/profile')
    expect(screen.getByLabelText('Current destination')).toHaveTextContent('/verify-email')
  })

  it.each(['/login', '/register'])('denies teacher access from %s until fresh server authorization allows continuation', async (path) => {
    ready('session-active')
    campusData.mockResolvedValue(signedIn)
    await renderAuthRoute(`${path}?returnTo=%2Fteacher`)
    expect(screen.getByText(/当前账号尚未获得教师授权/)).toBeVisible()
    expect(screen.getByRole('link', { name: '教师登录' })).toHaveAttribute('href', '/login?returnTo=/teacher')
    expect(screen.getByRole('button', { name: '退出并更换账号' })).toBeEnabled()
    expect(screen.queryByRole('heading', { name: 'Business destination' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Clerk sign-up form' })).not.toBeInTheDocument()
    campusData.mockResolvedValue({ ...signedIn, user: { ...signedIn.user, isTeacher: true } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重新确认教师权限' })) })
    expect(screen.getByLabelText('Current destination')).toHaveTextContent(/^\/teacher$/)
  })

  it('retains required Clerk tasks instead of restarting registration', async () => {
    ready('session-pending')
    clerkState.sessionStatus = 'pending'
    await renderAuthRoute('/register?returnTo=%2Fprofile')
    expect(screen.getByRole('region', { name: 'Clerk sign-in form' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Clerk sign-up form' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '退出并更换账号' })).toBeEnabled()
    expect(campusData).not.toHaveBeenCalled()
  })

  it('continues registration through pending tasks and waits for backend identity before leaving', async () => {
    ready()
    const view = await renderAuthRoute('/register?returnTo=%2Fprofile')
    expect(screen.getByRole('region', { name: 'Clerk sign-up form' })).toBeVisible()
    ready('session-new')
    clerkState.sessionStatus = 'pending'
    act(() => view.refreshSession())
    expect(screen.getByRole('region', { name: 'Clerk sign-in form' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Clerk sign-up form' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Business destination' })).not.toBeInTheDocument()
    expect(campusData).toHaveBeenCalledTimes(1)

    const identity = deferred()
    campusData.mockReturnValueOnce(identity.promise)
    clerkState.sessionStatus = 'active'
    act(() => view.refreshSession())
    expect(within(screen.getByRole('region', { name: '账号注册' })).getByRole('status')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Business destination' })).not.toBeInTheDocument()
    await act(async () => { identity.resolve(signedIn) })
    expect(screen.getByLabelText('Current destination')).toHaveTextContent(/^\/profile$/)
    expect(screen.getByRole('heading', { name: 'Business destination' })).toBeVisible()
  })

  it.each(['rejected', 'timed out'])('restores pending task continuation and another sign-out attempt after logout %s', async (outcome) => {
    ready('session-pending')
    clerkState.sessionStatus = 'pending'
    const logout = deferred()
    clerkState.signOut.mockReturnValueOnce(logout.promise)
    await renderAuthRoute('/register?returnTo=%2Fprofile')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '退出并更换账号' })) })
    if (outcome === 'rejected') {
      await act(async () => { logout.reject(new Error('PRIVATE_PROVIDER_ERROR')) })
    } else {
      await act(() => vi.advanceTimersByTimeAsync(15000))
    }
    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Clerk sign-in form' })).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试' })) })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Clerk sign-in form' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Clerk sign-up form' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '退出并更换账号' })).toBeEnabled()
    expect(campusData).not.toHaveBeenCalled()
    if (outcome === 'timed out') {
      await act(async () => { logout.reject(new Error('LATE_PRIVATE_PROVIDER_ERROR')) })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    }
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '退出并更换账号' })) })
    expect(clerkState.signOut).toHaveBeenCalledTimes(2)
  })

  it.each(['/login', '/register'])('lets an unrecognized active session at %s sign out instead of starting another account flow', async (path) => {
    ready('session-active')
    await renderAuthRoute(`${path}?returnTo=%2Fprofile`)
    expect(screen.getByRole('alert')).toHaveTextContent('职芽尚未确认账号')
    expect(screen.queryByRole('region', { name: 'Clerk sign-in form' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Clerk sign-up form' })).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '退出并更换账号' })) })
    expect(clerkState.signOut).toHaveBeenCalledOnce()
  })
})
