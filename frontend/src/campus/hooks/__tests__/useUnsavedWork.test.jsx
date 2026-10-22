import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import useUnsavedWork from '../useUnsavedWork'
import { createMemoryRouter, RouterProvider, useLocation, useNavigate } from 'react-router-dom'
import UnsavedWorkProvider from '../../components/UnsavedWorkProvider'

function Draft({ dirty, leave }) {
  useUnsavedWork(dirty)
  return <a href="/profile" onClick={(event) => { event.preventDefault(); leave() }}>Leave</a>
}
afterEach(() => { cleanup(); vi.restoreAllMocks() })

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
