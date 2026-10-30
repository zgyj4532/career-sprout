import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CampusSessionProvider, useCampusSession } from '../auth'
import { CampusApiError, campusData } from '../api'
import RequestError from '../components/RequestError'

const clerkState = vi.hoisted(() => ({ isLoaded: false, sessionId: null, status: 'loading', signOut: vi.fn() }))
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: clerkState.isLoaded, sessionId: clerkState.sessionId }),
  useClerk: () => ({ status: clerkState.status, signOut: clerkState.signOut }),
}))
vi.mock('../api', async (importOriginal) => ({ ...(await importOriginal()), campusData: vi.fn() }))

const anonymous = { mode: 'clerk', authenticated: false, user: null }
const signedIn = { mode: 'clerk', authenticated: true, user: { id: 'test-user', emailVerified: true } }

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
  clerkState.isLoaded = false
  clerkState.sessionId = null
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

  it('does not reuse a signed-in response after logout and refreshes even when the session id has not changed', async () => {
    ready('session-one')
    const oldResponse = deferred()
    campusData.mockReturnValueOnce(oldResponse.promise)
    const { result } = renderHook(() => useCampusSession(), { wrapper: CampusSessionProvider })
    const signal = campusData.mock.calls[0][1].signal
    await act(() => result.current.signOut())
    expect(signal.aborted).toBe(true)
    expect(clerkState.signOut).toHaveBeenCalledWith({ redirectUrl: '/login' })
    expect(result.current.status).toEqual(anonymous)
    await act(async () => { oldResponse.resolve(signedIn) })
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
})
