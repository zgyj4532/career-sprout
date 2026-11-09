import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CampusSessionProvider } from '../../auth'
import { campusData } from '../../api'

const clerkState = vi.hoisted(() => ({ session: null, signOut: vi.fn() }))
vi.mock('@clerk/react', () => ({
  useSession: () => ({ isLoaded: true, session: clerkState.session }),
  useClerk: () => ({ status: 'ready', signOut: clerkState.signOut }),
  SignIn: () => <div role="region" aria-label="Clerk sign-in form" />,
  SignUp: () => <div role="region" aria-label="Clerk sign-up form" />,
  UserProfile: () => <div role="region" aria-label="Clerk profile form" />,
}))
vi.mock('../../api', async (importOriginal) => ({ ...(await importOriginal()), campusData: vi.fn() }))

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <output aria-label="Current destination">{pathname}{search}</output>
}

async function renderRegistration() {
  // This module captures the production registration flag at import time.
  const { default: AuthPage } = await import('../AuthPage')
  render(<MemoryRouter basename="/career-sprout" initialEntries={['/career-sprout/register?returnTo=%2Fcareer-sprout%2Fprofile']}>
    <CampusSessionProvider>
      <LocationProbe />
      <Routes>
        <Route path="/register/*" element={<AuthPage />} />
        <Route path="/login/*" element={<AuthPage />} />
        <Route path="*" element={<h1>Business destination</h1>} />
      </Routes>
    </CampusSessionProvider>
  </MemoryRouter>)
  await act(async () => {})
}

beforeEach(() => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_CLERK_SIGN_UP_ENABLED', 'false')
  vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'test-key-only-sdk-is-mocked')
  vi.stubEnv('BASE_URL', '/career-sprout/')
  clerkState.session = null
  clerkState.signOut.mockReset().mockResolvedValue(undefined)
  campusData.mockReset().mockResolvedValue({ mode: 'clerk', authenticated: false, user: null })
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

it('blocks public registration but keeps existing-account login reachable with a safe destination', async () => {
  await renderRegistration()
  expect(screen.queryByRole('region', { name: 'Clerk sign-up form' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Clerk sign-in form' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '注册' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Business destination' })).not.toBeInTheDocument()
  await act(async () => { fireEvent.click(screen.getByRole('link', { name: '登录' })) })
  expect(screen.getByRole('region', { name: 'Clerk sign-in form' })).toBeVisible()
  expect(screen.getByLabelText('Current destination')).toHaveTextContent(/^\/login\?returnTo=%2Fprofile$/)
})

it('keeps pending-session recovery available without enabling public registration or granting backend identity', async () => {
  clerkState.session = { id: 'session-pending', status: 'pending' }
  await renderRegistration()
  expect(screen.getByRole('region', { name: 'Clerk sign-in form' })).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Clerk sign-up form' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '退出并更换账号' })).toBeEnabled()
  expect(screen.queryByRole('heading', { name: 'Business destination' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Current destination')).toHaveTextContent(/^\/register\?/)
  expect(campusData).not.toHaveBeenCalled()
})
