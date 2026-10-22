import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { UnsavedWorkContext } from '../hooks/unsavedWorkContext'

export default function UnsavedWorkProvider({ children }) {
  const guards = useRef(new Set())
  const register = useCallback((id, dirty) => {
    if (dirty) guards.current.add(id)
    else guards.current.delete(id)
  }, [])
  const shouldBlock = useCallback(({ currentLocation, nextLocation }) => guards.current.size > 0 && (
    currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search || currentLocation.key !== nextLocation.key
  ), [])
  const blocker = useBlocker(shouldBlock)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('此页还有未保存的内容。离开会放弃这些编辑，是否继续？')) blocker.proceed()
    else blocker.reset()
  }, [blocker])
  const value = useMemo(() => ({ register }), [register])
  return <UnsavedWorkContext.Provider value={value}>{children}</UnsavedWorkContext.Provider>
}
