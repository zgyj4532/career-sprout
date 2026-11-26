import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { useMobileWorkspace } from '../hooks/useMobileWorkspaceView'
import { UnsavedWorkContext } from '../hooks/unsavedWorkContext'
import { isResumeTabReplace, isWorkspaceViewSwitch } from '../mobileWorkspaceViews'

export default function UnsavedWorkProvider({ children }) {
  const isMobile = useMobileWorkspace()
  const guards = useRef(new Set())
  const register = useCallback((id, dirty) => {
    if (dirty) guards.current.add(id)
    else guards.current.delete(id)
  }, [])
  const shouldBlock = useCallback(({ currentLocation, nextLocation, historyAction }) => guards.current.size > 0 && (
    currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search || currentLocation.hash !== nextLocation.hash || currentLocation.key !== nextLocation.key
  ) && !isWorkspaceViewSwitch(currentLocation, nextLocation) && !(isMobile && isResumeTabReplace(currentLocation, nextLocation, historyAction)), [isMobile])
  const blocker = useBlocker(shouldBlock)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('此页还有未保存的内容。离开会放弃这些编辑，是否继续？')) blocker.proceed()
    else blocker.reset()
  }, [blocker])
  const value = useMemo(() => ({ register }), [register])
  return <UnsavedWorkContext.Provider value={value}>{children}</UnsavedWorkContext.Provider>
}
