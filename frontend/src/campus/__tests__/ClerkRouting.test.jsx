import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createBrowserRouter, Route, RouterProvider, Routes } from 'react-router-dom'
import CampusClerkProvider from '../CampusClerkProvider'
import UnsavedWorkProvider from '../components/UnsavedWorkProvider'
import useUnsavedWork from '../hooks/useUnsavedWork'

const clerk = vi.hoisted(() => ({ callbacks: null, mounts: 0 }))
const session = vi.hoisted(() => ({ value: null }))
vi.mock('@clerk/react', async () => {
  const { useEffect } = await import('react')
  function Step({ routing, path, forceRedirectUrl, signInUrl, signUpUrl, label }) {
    return <section aria-label={label}>
      <button onClick={() => clerk.callbacks.routerPush(routing === 'path' ? `${path}/continue` : '#/continue')}>Next Clerk step</button>
      <button onClick={() => clerk.callbacks.routerReplace(`${path}/verify-email-address`)}>Replace Clerk step</button>
      <button onClick={() => clerk.callbacks.routerPush(forceRedirectUrl)}>Finish Clerk flow</button>
      <button onClick={() => clerk.callbacks.routerPush(signInUrl || signUpUrl)}>Switch Clerk flow</button>
      <button onClick={() => clerk.callbacks.routerReplace(clerk.callbacks.signUpUrl)}>Recover signup at configured entry</button>
      <button onClick={() => clerk.callbacks.routerReplace(clerk.callbacks.signInUrl)}>Recover login at configured entry</button>
    </section>
  }
  return {
    ClerkProvider: ({ children, ...props }) => {
      clerk.callbacks = props
      useEffect(() => { clerk.mounts += 1 }, [])
      return children
    },
    SignUp: props => <Step {...props} label="Official sign-up" />,
    SignIn: props => <Step {...props} label="Official sign-in" />,
    UserProfile: props => <Step {...props} label="Official profile" />,
  }
})
vi.mock('../auth', async importOriginal => ({
  ...(await importOriginal()),
  useCampusSession: () => session.value,
}))

let router
function Draft() {
  const [text, setText] = useState('')
  useUnsavedWork(Boolean(text))
  return <label>Draft<input value={text} onChange={event => setText(event.target.value)} /></label>
}
async function mount(path = '/career-sprout/register', basename = '/career-sprout/') {
  const { default: AuthPage } = await import('../pages/AuthPage')
  window.history.replaceState(null, '', path)
  router = createBrowserRouter([{ path: '*', element: <CampusClerkProvider>
    <UnsavedWorkProvider>
      <Routes>
        <Route path="/register/*" element={<AuthPage />} />
        <Route path="/login/*" element={<AuthPage />} />
        <Route path="/verify-email/*" element={<AuthPage />} />
        <Route path="/profile" element={<Draft />} />
      </Routes>
    </UnsavedWorkProvider>
  </CampusClerkProvider> }], { basename })
  render(<RouterProvider router={router} />)
}
async function click(name) {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })) })
}
async function backTo(path) {
  await act(async () => { window.history.back() })
  await waitFor(() => expect(router.state.location.pathname).toBe(path))
}

beforeEach(() => {
  vi.stubEnv('BASE_URL', '/career-sprout/')
  vi.stubEnv('VITE_APP_PROFILE', 'campus-local')
  vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'test-key-sdk-is-mocked')
  vi.stubEnv('VITE_CLERK_SIGN_UP_ENABLED', 'true')
  clerk.callbacks = null
  clerk.mounts = 0
  session.value = { status: { mode: 'clerk', authenticated: false }, error: null, loadingStage: null, pendingSession: false }
})
afterEach(() => {
  cleanup()
  router?.dispose()
  router = null
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it('keeps official step push/replace and browser back in data-router history without remounting the provider', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await mount()
  const index = window.history.state.idx
  await click('Next Clerk step')
  expect(window.location.pathname).toBe('/career-sprout/register/continue')
  expect(router.state.location.pathname).toBe(window.location.pathname)
  expect(window.history.state.idx).toBe(index + 1)
  expect(router.state.historyAction).toBe('PUSH')
  await click('Replace Clerk step')
  expect(window.location.pathname).toBe('/career-sprout/register/verify-email-address')
  expect(window.history.state.idx).toBe(index + 1)
  expect(router.state.historyAction).toBe('REPLACE')
  await backTo('/career-sprout/register')
  expect(window.history.state.idx).toBe(index)
  expect(clerk.mounts).toBe(1)
  expect(warning.mock.calls.flat().join(' ')).not.toMatch(/POP navigation|not created by @remix-run\/router/)
})

it('still cancels and accepts browser back after Clerk navigation when an editor is dirty', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  await mount('/career-sprout/register?returnTo=%2Fprofile')
  await click('Next Clerk step')
  // Clerk owns the return URL during its flow; exercise that same document URL at completion.
  await act(async () => { await clerk.callbacks.routerPush('/career-sprout/profile') })
  fireEvent.change(screen.getByRole('textbox', { name: 'Draft' }), { target: { value: 'Keep this draft' } })
  const index = window.history.state.idx
  await act(async () => { window.history.back() })
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
  await waitFor(() => expect(window.location.pathname).toBe('/career-sprout/profile'))
  expect(window.history.state.idx).toBe(index)
  expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('Keep this draft')
  confirm.mockReturnValue(true)
  await backTo('/career-sprout/register/continue')
  expect(window.history.state.idx).toBe(index - 1)
  expect(confirm).toHaveBeenCalledTimes(2)
})

it.each([
  ['/login', 'Official sign-in'],
  ['/verify-email', 'Official profile'],
])('routes %s official steps under the basename', async (path, label) => {
  if (path === '/verify-email') session.value.status = { mode: 'clerk', authenticated: true, user: { emailVerified: false } }
  await mount(`/career-sprout${path}`)
  expect(screen.getByRole('region', { name: label })).toBeVisible()
  await click('Next Clerk step')
  expect(window.location.pathname).toBe(`/career-sprout${path}/continue`)
})

it('keeps pending registration tasks in official SignIn at their existing route root', async () => {
  session.value.status = null
  session.value.pendingSession = true
  await mount('/career-sprout/register/tasks')
  expect(screen.getByRole('region', { name: 'Official sign-in' })).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Official sign-up' })).not.toBeInTheDocument()
  await click('Next Clerk step')
  expect(window.location.pathname).toBe('/career-sprout/register/continue')
})

it('preserves safe return query and fragment and applies the deployment base once', async () => {
  await mount('/career-sprout/register?returnTo=%2Fcareer-sprout%2Fprofile%3Ftab%3Dskills%23draft')
  await click('Switch Clerk flow')
  expect(window.location.pathname).toBe('/career-sprout/login')
  expect(new URLSearchParams(window.location.search).get('returnTo')).toBe('/profile?tab=skills#draft')
  await click('Finish Clerk flow')
  expect(window.location.pathname).toBe('/career-sprout/profile')
  expect(window.location.search).toBe('?tab=skills')
  expect(window.location.hash).toBe('#draft')
})

it('replaces only the observed legacy registration continuation, retaining its search and history index', async () => {
  await mount('/career-sprout/register?returnTo=%2Fprofile#/continue')
  await waitFor(() => expect(window.location.pathname).toBe('/career-sprout/register/continue'))
  expect(window.location.search).toBe('?returnTo=%2Fprofile')
  expect(window.location.hash).toBe('')
  expect(window.history.state.idx).toBe(0)
  expect(router.state.historyAction).toBe('REPLACE')
})

it.each([
  ['/career-sprout/', 'true', '/career-sprout/register', 'Official sign-up'],
  ['/career-sprout/', 'false', '/career-sprout/login', 'Official sign-in'],
  ['/', 'true', '/register', 'Official sign-up'],
  ['/', 'false', '/login', 'Official sign-in'],
])('recovers signup through the configured app entry at base %s with registration=%s', async (basename, enabled, destination, label) => {
  vi.stubEnv('BASE_URL', basename)
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_CLERK_SIGN_UP_ENABLED', enabled)
  // Simulate Clerk's configured-entry redirect when no resumable attempt exists.
  // Provider request/attempt detection itself still needs the real-browser smoke.
  const entry = enabled === 'true' ? 'register' : 'login'
  await mount(`${basename}${entry}${enabled === 'true' ? '#/continue' : '/continue'}`, basename)
  await waitFor(() => expect(window.location.pathname).toBe(`${basename}${entry}/continue`))
  const index = window.history.state.idx
  await click('Recover signup at configured entry')
  expect(window.location.pathname).toBe(destination)
  expect(router.state.location.pathname).toBe(destination)
  expect(window.history.state.idx).toBe(index)
  expect(screen.getByRole('region', { name: label })).toBeVisible()
})

it('keeps missing sign-in attempt recovery inside the app', async () => {
  await mount('/career-sprout/login/continue')
  await click('Recover login at configured entry')
  expect(window.location.pathname).toBe('/career-sprout/login')
  expect(screen.getByRole('region', { name: 'Official sign-in' })).toBeVisible()
})

it('does not reinterpret unrelated auth fragments as routes', async () => {
  await mount('/career-sprout/register#help')
  expect(window.location.pathname).toBe('/career-sprout/register')
  expect(window.location.hash).toBe('#help')
})

it.each(['routerPush', 'routerReplace'])('leaves external OAuth and outside-basename URLs to official document navigation through %s', async method => {
  await mount()
  const windowNavigate = vi.fn()
  for (const destination of ['https://accounts.example.com/oauth?state=opaque#callback', '/another-app/callback']) {
    await act(async () => { await clerk.callbacks[method](destination, { windowNavigate }) })
    expect(windowNavigate).toHaveBeenLastCalledWith(destination)
    expect(router.state.location.pathname).toBe('/career-sprout/register')
  }
})

it('accepts same-origin absolute Clerk destinations without adding the basename twice', async () => {
  await mount()
  await act(async () => { await clerk.callbacks.routerPush(`${window.location.origin}/career-sprout/login?returnTo=%2Fprofile`) })
  expect(window.location.pathname).toBe('/career-sprout/login')
  expect(window.location.search).toBe('?returnTo=%2Fprofile')
})

it('also routes official steps when deployed at the origin root', async () => {
  vi.stubEnv('BASE_URL', '/')
  await mount('/register', '/')
  await click('Next Clerk step')
  expect(window.location.pathname).toBe('/register/continue')
})

it.each(['false', 'true'])('does not mount Clerk without a public key, including local bypass=%s', async bypass => {
  vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '')
  vi.stubEnv('VITE_DEV_BYPASS_AUTH', bypass)
  session.value.status = { mode: bypass === 'true' ? 'local' : 'unavailable', authenticated: false }
  await mount()
  expect(clerk.mounts).toBe(0)
  expect(screen.queryByRole('region', { name: 'Official sign-up' })).not.toBeInTheDocument()
})
