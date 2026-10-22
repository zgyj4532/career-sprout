import { useCallback, useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { UnsavedWorkContext } from './unsavedWorkContext'

export default function useUnsavedWork(dirty) {
  const context = useContext(UnsavedWorkContext)
  const id = useRef(Symbol('unsaved-work'))
  const active = useRef(dirty)
  useLayoutEffect(() => {
    active.current = dirty
    context?.register(id.current, dirty)
    const key = id.current
    return () => context?.register(key, false)
  }, [context, dirty])
  // Only call after server acknowledgement or an explicit discard decision.
  const allowLeave = useCallback(() => {
    active.current = false
    context?.register(id.current, false)
  }, [context])
  useEffect(() => {
    const beforeUnload = (event) => { if (active.current) { event.preventDefault(); event.returnValue = '' } }
    const followLink = (event) => {
      if (!active.current) return
      const link = event.target.closest?.('a[href]')
      if (!link || link.target === '_blank' || link.hasAttribute('download') || event.defaultPrevented || event.campusLeaveConfirmed) return
      const destination = new URL(link.href, window.location.href)
      if (destination.href === window.location.href) return
      // React Router owns internal link, imperative and POP transitions together.
      if (context && destination.origin === window.location.origin) return
      if (!window.confirm('此页还有未保存的内容。离开会放弃这些编辑，是否继续？')) {
        event.preventDefault(); event.stopPropagation()
      } else event.campusLeaveConfirmed = true
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', followLink, true)
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', followLink, true) }
  }, [context])
  return allowLeave
}
