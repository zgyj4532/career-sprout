import { lazy, useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createMemoryRouter, Link, Route, RouterProvider, Routes, useNavigate } from 'react-router-dom'
import RouteLoadingBoundary from '../RouteLoadingBoundary'
import UnsavedWorkProvider from '../UnsavedWorkProvider'
import useUnsavedWork from '../../hooks/useUnsavedWork'

const routers = []
afterEach(() => {
  cleanup()
  routers.forEach(router => router.dispose())
  routers.length = 0
  vi.restoreAllMocks()
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function Draft() {
  const [text, setText] = useState('')
  const allowLeave = useUnsavedWork(Boolean(text))
  const navigate = useNavigate()
  return <>
    <label>Draft<input value={text} onChange={event => setText(event.target.value)} /></label>
    <button type="button" onClick={() => { allowLeave(); navigate('/pending') }}>Acknowledge save and continue</button>
  </>
}

function mountRoutes(Page, initialEntry = '/') {
  function Shell() {
    const [revision, setRevision] = useState(0)
    return <>
      <nav aria-label="Test navigation"><Link to="/">Home</Link><Link to="/pending">Pending page</Link><Link to="/draft">Draft page</Link></nav>
      <button type="button" onClick={() => setRevision(value => value + 1)}>Rerender {revision}</button>
      <main><RouteLoadingBoundary><Routes>
        <Route path="/" element={<h1>Home content</h1>} />
        <Route path="/pending" element={<Page />} />
        <Route path="/draft" element={<Draft />} />
      </Routes></RouteLoadingBoundary></main>
    </>
  }
  const router = createMemoryRouter([{ path: '*', element: <UnsavedWorkProvider><Shell /></UnsavedWorkProvider> }], { initialEntries: [initialEntry] })
  routers.push(router)
  render(<RouterProvider router={router} />)
  return router
}

it('shows pending content on navigation without hiding navigation or moving focus, then removes it on resolution', async () => {
  const chunk = deferred()
  const load = vi.fn(() => chunk.promise)
  mountRoutes(lazy(load))
  expect(load).not.toHaveBeenCalled()
  const link = screen.getByRole('link', { name: 'Pending page' })
  link.focus()
  fireEvent.click(link)
  expect(await screen.findByRole('status')).toHaveTextContent('第一次打开需要时间，请耐心等待')
  expect(screen.getByRole('navigation')).toBeVisible()
  expect(link).toHaveFocus()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await act(async () => { chunk.resolve({ default: () => <h1>Loaded page</h1> }) })
  expect(await screen.findByRole('heading', { name: 'Loaded page' })).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(link).toHaveFocus()
  fireEvent.click(screen.getByRole('link', { name: 'Home' }))
  await screen.findByRole('heading', { name: 'Home content' })
  fireEvent.click(link)
  expect(await screen.findByRole('heading', { name: 'Loaded page' })).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(load).toHaveBeenCalledOnce()
})

it('allows leaving a pending route and ignores its late completion', async () => {
  const chunk = deferred()
  mountRoutes(lazy(() => chunk.promise), '/pending')
  await screen.findByRole('status')
  fireEvent.click(screen.getByRole('link', { name: 'Home' }))
  expect(await screen.findByRole('heading', { name: 'Home content' })).toBeVisible()
  await act(async () => { chunk.resolve({ default: () => <h1>Late page</h1> }) })
  expect(screen.queryByRole('heading', { name: 'Late page' })).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('replaces rejected loading with home navigation and explicit refresh warning, never a cached-promise retry', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const chunk = deferred()
  const load = vi.fn(() => chunk.promise)
  mountRoutes(lazy(load), '/pending')
  await screen.findByRole('status')
  await act(async () => { chunk.reject(new Error('private chunk URL')) })
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '刷新页面' })).toHaveAccessibleDescription('刷新会丢失未保存的内容，请先确认其他编辑已保存。')
  expect(screen.queryByRole('button', { name: /重试/ })).not.toBeInTheDocument()
  expect(screen.queryByText('private chunk URL')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Rerender 0' }))
  expect(screen.getByRole('alert')).toBeVisible()
  fireEvent.click(screen.getByRole('link', { name: '返回首页' }))
  expect(await screen.findByRole('heading', { name: 'Home content' })).toBeVisible()
  fireEvent.click(screen.getByRole('link', { name: 'Pending page' }))
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(load).toHaveBeenCalledOnce()
})

it('does not reset a render failure on unrelated rerenders but does reset on navigation', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  let failed = true
  const renderPage = vi.fn()
  function Page() {
    renderPage()
    if (failed) throw new Error('page failure')
    return <h1>Recovered page</h1>
  }
  const router = mountRoutes(Page, '/pending')
  await screen.findByRole('alert')
  const attempts = renderPage.mock.calls.length
  failed = false
  fireEvent.click(screen.getByRole('button', { name: 'Rerender 0' }))
  expect(screen.getByRole('alert')).toBeVisible()
  expect(renderPage).toHaveBeenCalledTimes(attempts)
  await act(async () => { await router.navigate('/pending?view=next') })
  expect(await screen.findByRole('heading', { name: 'Recovered page' })).toBeVisible()
})

it('keeps a dirty editor through rerenders, cancelled navigation and same-path query changes, then allows acknowledged continuation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const chunk = deferred()
  const load = vi.fn(() => chunk.promise)
  const router = mountRoutes(lazy(load), '/draft')
  const input = screen.getByRole('textbox', { name: 'Draft' })
  fireEvent.change(input, { target: { value: 'Keep this draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Rerender 0' }))
  expect(screen.getByRole('textbox')).toBe(input)
  fireEvent.click(screen.getByRole('link', { name: 'Pending page' }))
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
  expect(router.state.location.pathname).toBe('/draft')
  expect(input).toHaveValue('Keep this draft')
  expect(load).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  await act(async () => { await router.navigate('/draft?view=details') })
  expect(screen.getByRole('textbox')).toBe(input)
  expect(input).toHaveValue('Keep this draft')
  confirm.mockClear().mockReturnValue(false)
  fireEvent.click(screen.getByRole('button', { name: 'Acknowledge save and continue' }))
  await screen.findByRole('status')
  expect(router.state.location.pathname).toBe('/pending')
  expect(confirm).not.toHaveBeenCalled()
  await act(async () => { chunk.resolve({ default: () => <h1>Saved destination</h1> }) })
  expect(await screen.findByRole('heading', { name: 'Saved destination' })).toBeVisible()
})

it('preserves a dirty editor when Back is cancelled and shows pending UI only after discard', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const chunk = deferred()
  const router = mountRoutes(lazy(() => chunk.promise), '/pending')
  await screen.findByRole('status')
  await act(async () => { await router.navigate('/draft') })
  const input = screen.getByRole('textbox', { name: 'Draft' })
  fireEvent.change(input, { target: { value: 'Keep on Back' } })
  await act(async () => { await router.navigate(-1) })
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
  expect(router.state.location.pathname).toBe('/draft')
  expect(input).toHaveValue('Keep on Back')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  confirm.mockReturnValue(true)
  await act(async () => { await router.navigate(-1) })
  expect(await screen.findByRole('status')).toBeVisible()
  expect(router.state.location.pathname).toBe('/pending')
  await act(async () => { chunk.resolve({ default: () => <h1>Back destination</h1> }) })
  expect(await screen.findByRole('heading', { name: 'Back destination' })).toBeVisible()
})
