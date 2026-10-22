import * as React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let Slogan
let media
let animation
let loadAnimation
let renderAnimation

function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function display(button) {
  return button.querySelector('.campus-slogan-display')
}

async function advance(milliseconds) {
  await act(async () => { vi.advanceTimersByTime(milliseconds) })
}

function changeReducedMotion(matches) {
  act(() => {
    media.matches = matches
    media.dispatchEvent(Object.assign(new Event('change'), { matches }))
  })
}

async function finishAnimationLoad() {
  await act(async () => { animation.resolve({ default: renderAnimation }) })
}

beforeEach(async () => {
  vi.resetModules()
  // Keep the renderer and freshly imported component on the same React instance.
  vi.doMock('react', () => React)
  animation = deferred()
  loadAnimation = vi.fn()
  renderAnimation = vi.fn(({ text }) => <span data-testid="slogan-animation">{text}</span>)
  vi.doMock('../../bits/BlurText', () => {
    loadAnimation()
    return animation.promise
  })
  media = new EventTarget()
  media.matches = false
  vi.spyOn(media, 'addEventListener')
  vi.spyOn(media, 'removeEventListener')
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  Slogan = (await import('../Slogan')).default
  vi.useFakeTimers()
})

afterEach(async () => {
  cleanup()
  await finishAnimationLoad()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.doUnmock('../../bits/BlurText')
  vi.doUnmock('react')
})

describe('optional slogan animation', () => {
  it('shows the initial phrase without requesting animation, even after waiting', async () => {
    render(<Slogan />)
    const button = screen.getByRole('button')
    expect(display(button)).toBeVisible()
    expect(display(button).textContent).toBe(button.getAttribute('aria-label'))
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await advance(2000)
    expect(loadAnimation).not.toHaveBeenCalled()
    expect(screen.queryByTestId('slogan-animation')).not.toBeInTheDocument()
  })

  it('keeps the phrase visible while loading and preserves fade and click-lock timing', async () => {
    render(<Slogan />)
    const button = screen.getByRole('button')
    const original = button.getAttribute('aria-label')
    fireEvent.click(button)
    fireEvent.click(button)
    expect(button).toHaveClass('is-fading')
    await advance(99)
    expect(button).toHaveAttribute('aria-label', original)
    expect(loadAnimation).not.toHaveBeenCalled()
    await advance(1)
    const alternate = button.getAttribute('aria-label')
    expect(alternate).not.toBe(original)
    expect(button).not.toHaveClass('is-fading')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(display(button)).toBeVisible()
    expect(display(button).textContent).toBe(alternate)
    expect(loadAnimation).toHaveBeenCalledTimes(1)
    fireEvent.click(button)
    await advance(549)
    fireEvent.click(button)
    expect(button).not.toHaveClass('is-fading')
    expect(button).toHaveAttribute('aria-label', alternate)
    await advance(1)
    fireEvent.click(button)
    expect(button).toHaveClass('is-fading')
    await advance(100)
    expect(button).toHaveAttribute('aria-label', original)
    expect(display(button).textContent).toBe(original)
    await finishAnimationLoad()
    expect(screen.getByTestId('slogan-animation')).toHaveTextContent(original)
    await advance(550)
    fireEvent.click(button)
    await advance(100)
    expect(screen.getByTestId('slogan-animation')).toHaveTextContent(alternate)
    expect(loadAnimation).toHaveBeenCalledTimes(1)
  })

  it('toggles immediately with reduced motion and follows preference changes', async () => {
    media.matches = true
    const view = render(<React.StrictMode><Slogan /></React.StrictMode>)
    const button = screen.getByRole('button')
    const original = button.getAttribute('aria-label')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(display(button).textContent).toBe(button.getAttribute('aria-label'))
    expect(button).not.toHaveClass('is-fading')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-label', original)
    expect(loadAnimation).not.toHaveBeenCalled()
    changeReducedMotion(false)
    expect(loadAnimation).not.toHaveBeenCalled()
    fireEvent.click(button)
    await advance(100)
    expect(loadAnimation).toHaveBeenCalledTimes(1)
    changeReducedMotion(true)
    await finishAnimationLoad()
    expect(screen.queryByTestId('slogan-animation')).not.toBeInTheDocument()
    expect(display(button)).toBeVisible()
    expect(display(button).textContent).toBe(button.getAttribute('aria-label'))
    view.unmount()
    expect(media.removeEventListener.mock.calls).toEqual(media.addEventListener.mock.calls)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps both phrases usable after the animation import rejects without retrying', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Slogan />)
    const button = screen.getByRole('button')
    const original = button.getAttribute('aria-label')
    fireEvent.click(button)
    await advance(100)
    const alternate = button.getAttribute('aria-label')
    await act(async () => { animation.reject(new Error('animation chunk unavailable')) })
    expect(display(button)).toBeVisible()
    expect(display(button).textContent).toBe(alternate)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await advance(550)
    fireEvent.click(button)
    await advance(100)
    expect(button).toHaveAttribute('aria-label', original)
    expect(display(button).textContent).toBe(original)
    await advance(550)
    fireEvent.click(button)
    await advance(100)
    expect(display(button).textContent).toBe(alternate)
    expect(loadAnimation).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('slogan-animation')).not.toBeInTheDocument()
  })

  it('cancels a pending phrase change on departure without requesting animation', async () => {
    const view = render(<Slogan />)
    fireEvent.click(screen.getByRole('button'))
    await advance(99)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
    await advance(1000)
    expect(loadAnimation).not.toHaveBeenCalled()
    expect(media.removeEventListener.mock.calls).toEqual(media.addEventListener.mock.calls)
  })

  it('does not start animation when its import finishes after departure', async () => {
    const view = render(<Slogan />)
    fireEvent.click(screen.getByRole('button'))
    await advance(100)
    expect(loadAnimation).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
    await finishAnimationLoad()
    await advance(1000)
    expect(renderAnimation).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
