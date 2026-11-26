import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import useMobileWorkspaceView from '../useMobileWorkspaceView'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function Workspace() {
  const { isMobile, mobileView, openMobileView } = useMobileWorkspaceView()
  const { pathname, search, hash, state } = useLocation()
  const navigate = useNavigate()
  return <>
    <p>{isMobile ? 'Phone' : 'Desktop'}: {mobileView || 'overview'}</p>
    <p>{pathname}{search}{hash}</p>
    {state?.via && <p>{state.via}</p>}
    <button type="button" onClick={() => openMobileView('review', { state: { via: 'Review action' } })}>Open review</button>
    <button type="button" onClick={() => openMobileView('gap')}>Open unrelated panel</button>
    <button type="button" onClick={() => openMobileView('', { replace: true })}>Replace with overview</button>
    <button type="button" onClick={() => navigate(-1)}>Back</button>
    <button type="button" onClick={() => navigate(1)}>Forward</button>
  </>
}

function setupPhone() {
  const media = Object.assign(new EventTarget(), { matches: true })
  vi.stubGlobal('matchMedia', vi.fn((query) => query === '(max-width: 767px)' ? media : undefined))
  return media
}

it('responds to media changes without replacing the addressable panel', () => {
  const media = setupPhone()
  render(<MemoryRouter initialEntries={['/resume?panel=review']}><Workspace /></MemoryRouter>)
  expect(screen.getByText('Phone: review')).toBeVisible()
  act(() => { media.matches = false; media.dispatchEvent(new Event('change')) })
  expect(screen.getByText('Desktop: review')).toBeVisible()
  expect(screen.getByText('/resume?panel=review')).toBeVisible()
})

it('opens and closes a panel without changing other parameters or the fragment', () => {
  setupPhone()
  const overview = '/resume?jobId=42&source=a&source=b#editor'
  const review = '/resume?jobId=42&source=a&source=b&panel=review#editor'
  render(<MemoryRouter initialEntries={[overview]}><Workspace /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Open unrelated panel' }))
  expect(screen.getByText(overview)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Open review' }))
  expect(screen.getByText(review)).toBeVisible()
  expect(screen.getByText('Review action')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByText(overview)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Forward' }))
  expect(screen.getByText(review)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Replace with overview' }))
  expect(screen.getByText(overview)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByText(overview)).toBeVisible()
})

it.each(['panel=', 'panel=gap', 'panel=review&panel=review'])('does not present an invalid or duplicate panel: %s', (search) => {
  setupPhone()
  const path = `/resume?${search}`
  render(<MemoryRouter initialEntries={[path]}><Workspace /></MemoryRouter>)
  expect(screen.getByText('Phone: overview')).toBeVisible()
  expect(screen.getByText(path)).toBeVisible()
})
