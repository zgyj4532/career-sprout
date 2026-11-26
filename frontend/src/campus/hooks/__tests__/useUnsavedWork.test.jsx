import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import useUnsavedWork from '../useUnsavedWork'
import { createMemoryRouter, Link, RouterProvider, useLocation, useNavigate } from 'react-router-dom'
import UnsavedWorkProvider from '../../components/UnsavedWorkProvider'

function Draft({ dirty, leave }) {
  useUnsavedWork(dirty)
  return <a href="/profile" onClick={(event) => { event.preventDefault(); leave() }}>Leave</a>
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('blocks a route link when discarding an unsaved draft is declined', () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  const leave = vi.fn()
  render(<Draft dirty leave={leave} />)
  fireEvent.click(screen.getByRole('link'))
  expect(leave).not.toHaveBeenCalled()
})

it('releases the navigation guard once the draft is saved', () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const leave = vi.fn()
  const view = render(<Draft dirty leave={leave} />)
  view.rerender(<Draft dirty={false} leave={leave} />)
  fireEvent.click(screen.getByRole('link'))
  expect(leave).toHaveBeenCalledOnce()
  expect(confirm).not.toHaveBeenCalled()
})

function RouterDraft() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const allowLeave = useUnsavedWork(pathname === '/draft')
  return <><p>{pathname}</p><button type="button" onClick={() => { allowLeave(); navigate('/saved') }}>Acknowledge and continue</button></>
}

it.each([-1, 1])('blocks dirty POP navigation in direction %s and permits an explicit discard', async (delta) => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const router = createMemoryRouter([{ path: '*', element: <UnsavedWorkProvider><RouterDraft /></UnsavedWorkProvider> }], { initialEntries: ['/before', '/draft', '/after'], initialIndex: 1 })
  const view = render(<RouterProvider router={router} />)
  try {
    await act(async () => { await router.navigate(delta) })
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    expect(router.state.location.pathname).toBe('/draft')
    expect(screen.getByText('/draft')).toBeInTheDocument()
    confirm.mockReturnValue(true)
    await act(async () => { await router.navigate(delta) })
    await waitFor(() => expect(router.state.location.pathname).toBe(delta === -1 ? '/before' : '/after'))
  } finally { view.unmount(); router.dispose() }
})

it('allows acknowledged continuation synchronously without discarding another draft', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const router = createMemoryRouter([{ path: '*', element: <UnsavedWorkProvider><RouterDraft /></UnsavedWorkProvider> }], { initialEntries: ['/draft'] })
  const view = render(<RouterProvider router={router} />)
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge and continue' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/saved'))
    expect(confirm).not.toHaveBeenCalled()
  } finally { view.unmount(); router.dispose() }
})

const profileDefault = '/profile?source=resume&source=upload#draft'
const profileMaterials = '/profile?source=resume&source=upload&view=materials#draft'
const profileExperiences = '/profile?source=resume&source=upload&view=experiences#draft'
const profileSkills = '/profile?source=resume&source=upload&view=skills#draft'

function ProfileDraft() {
  const { pathname, search, hash } = useLocation()
  useUnsavedWork(true)
  return <>
    <p>{pathname}{search}{hash}</p>
    <Link to={profileDefault}>Profile</Link>
    <Link to={profileExperiences}>Experiences</Link>
    <Link to={profileSkills}>Skills</Link>
    <Link to={profileMaterials}>Materials</Link>
  </>
}

function mountProfileDraft(initialEntries, basename = '/') {
  const router = createMemoryRouter([
    { path: '*', element: <UnsavedWorkProvider><ProfileDraft /></UnsavedWorkProvider> },
  ], { basename, initialEntries })
  const view = render(<RouterProvider router={router} />)
  return { router, dispose() { view.unmount(); router.dispose() } }
}

it('switches dirty profile views by link and Back/Forward without releasing unload protection', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const { router, dispose } = mountProfileDraft([`/career-sprout${profileDefault}`], '/career-sprout/')
  try {
    fireEvent.click(screen.getByRole('link', { name: 'Materials' }))
    expect(await screen.findByText(profileMaterials)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Experiences' }))
    expect(await screen.findByText(profileExperiences)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Skills' }))
    expect(await screen.findByText(profileSkills)).toBeInTheDocument()
    await act(async () => { await router.navigate(-1) })
    expect(screen.getByText(profileExperiences)).toBeInTheDocument()
    await act(async () => { await router.navigate(1) })
    expect(screen.getByText(profileSkills)).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()

    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
  } finally { dispose() }
})

it.each([
  ['a different route', '/resume?source=resume&source=upload#draft'],
  ['another entry for the same view', profileMaterials],
  ['an unrelated query change', '/profile?source=resume&view=materials#draft'],
  ['a view switch with a changed query', '/profile?source=resume#draft'],
  ['a view switch with a changed hash', '/profile?source=resume&source=upload#other'],
  ['an unknown view value', '/profile?source=resume&source=upload&view=other#draft'],
  ['an explicit default view value', '/profile?source=resume&source=upload&view=personal#draft'],
  ['an empty view value', '/profile?source=resume&source=upload&view=#draft'],
  ['duplicate view values', `${profileMaterials.replace('#draft', '')}&view=materials#draft`],
])('guards dirty profile history for %s', async (_reason, destination) => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const { router, dispose } = mountProfileDraft([destination, profileMaterials])
  const currentKey = router.state.location.key
  try {
    await act(async () => { await router.navigate(-1) })
    expect(confirm).toHaveBeenCalledOnce()
    expect(router.state.location.key).toBe(currentKey)
  } finally { dispose() }
})

it.each([
  ['/profile?view=experiences&panel=experience%3Aabc-123&source=draft#form', '/profile?view=skills&source=draft#form', '/profile?view=materials&panel=sharing&source=draft#form'],
  ['/jd?jobId=42&from=interview#draft', '/jd?jobId=42&panel=requirements&from=interview#draft', '/jd?jobId=42&panel=gap&from=interview#draft'],
  ['/resume?resumeId=42#draft', '/resume?resumeId=42&panel=materials#draft', '/resume?resumeId=42&panel=review#draft'],
  ['/interview?mode=manual#prep', '/interview?mode=manual&panel=direction#prep', '/interview?mode=manual&panel=settings#prep'],
])('keeps dirty work protected across workspace panel navigation from %s', async (overview, first, second) => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const { router, dispose } = mountProfileDraft([overview])
  try {
    await act(async () => { await router.navigate(first) })
    expect(screen.getByText(first)).toBeVisible()
    await act(async () => { await router.navigate(second) })
    expect(screen.getByText(second)).toBeVisible()
    await act(async () => { await router.navigate(-1) })
    expect(screen.getByText(first)).toBeVisible()
    await act(async () => { await router.navigate(1) })
    expect(screen.getByText(second)).toBeVisible()
    expect(confirm).not.toHaveBeenCalled()

    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
  } finally { dispose() }
})

it.each([
  ['/jd?jobId=42&panel=gap#draft', '/jd?jobId=43&panel=requirements#draft'],
  ['/jd?jobId=42&panel=gap#draft', '/jd?jobId=42&panel=requirements#other'],
  ['/jd?jobId=42&panel=gap', '/jd?jobId=42&panel=review'],
  ['/jd?jobId=42&panel=gap', '/jd?jobId=42&panel=gap&panel=gap'],
  ['/jd?jobId=42&panel=gap', '/jd?jobId=42&panel=gap'],
  ['/jd?jobId=42&panel=', '/jd?jobId=42&panel=gap'],
  ['/resume?importId=draft&panel=review', '/resume?panel=materials'],
  ['/interview?panel=settings', '/interview/session/abc?panel=direction'],
  ['/history', '/history?panel=settings'],
  ['/profile?panel=basics', '/workspace-menu'],
  ['/profile?view=skills&panel=tags', '/profile?view=materials&panel=tags'],
  ['/profile?view=skills&panel=tags', '/profile?view=experiences&panel=experience%3A'],
  ['/profile?view=skills&panel=tags', '/profile?view=materials&view=materials&panel=import'],
])('does not exempt dirty navigation from %s to %s', async (origin, destination) => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const { router, dispose } = mountProfileDraft([destination, origin])
  const currentKey = router.state.location.key
  try {
    await act(async () => { await router.navigate(-1) })
    expect(confirm).toHaveBeenCalledOnce()
    expect(router.state.location.key).toBe(currentKey)
  } finally { dispose() }
})

const resumeOverview = '/resume?resumeId=42#draft'

function setMobileViewport(matches) {
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches }))
}

it('replaces phone Resume tab metadata without releasing the dirty guard', async () => {
  setMobileViewport(true)
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const { router, dispose } = mountProfileDraft([
    '/history', { pathname: '/resume', search: '?resumeId=42', hash: '#draft', state: { source: 'history' } },
  ])
  try {
    await act(async () => { await router.navigate(resumeOverview, { replace: true, state: { source: 'history', resumeTab: 'versions' } }) })
    expect(router.state.historyAction).toBe('REPLACE')
    expect(router.state.location.state).toEqual({ source: 'history', resumeTab: 'versions' })
    expect(confirm).not.toHaveBeenCalled()

    await act(async () => { await router.navigate(-1) })
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.getByText(resumeOverview)).toBeVisible()
  } finally { dispose() }
})

it.each([
  ['desktop', resumeOverview, resumeOverview, { resumeTab: 'versions', source: 'history' }, true, false],
  ['push', resumeOverview, resumeOverview, { resumeTab: 'versions', source: 'history' }, false, true],
  ['same tab', resumeOverview, resumeOverview, { resumeTab: 'edit', source: 'history' }, true, true],
  ['unknown tab', resumeOverview, resumeOverview, { resumeTab: 'new', source: 'history' }, true, true],
  ['changed history state', resumeOverview, resumeOverview, { resumeTab: 'versions', source: 'profile' }, true, true],
  ['changed record', resumeOverview, '/resume?resumeId=43#draft', { resumeTab: 'versions', source: 'history' }, true, true],
  ['panel URL', '/resume?panel=review', '/resume?panel=review', { resumeTab: 'versions', source: 'history' }, true, true],
])('still protects a dirty Resume tab change for %s', async (_reason, origin, destination, state, replace, mobile) => {
  setMobileViewport(mobile)
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const initial = new URL(origin, 'https://example.invalid')
  const { router, dispose } = mountProfileDraft([
    { pathname: initial.pathname, search: initial.search, hash: initial.hash, state: { resumeTab: 'edit', source: 'history' } },
  ])
  const currentKey = router.state.location.key
  try {
    await act(async () => { await router.navigate(destination, { replace, state }) })
    expect(confirm).toHaveBeenCalledOnce()
    expect(router.state.location.key).toBe(currentKey)
  } finally { dispose() }
})
