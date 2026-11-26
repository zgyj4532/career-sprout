import { useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { mobileWorkspaceViewDestination, parseMobileWorkspaceView } from '../mobileWorkspaceViews'

const MOBILE_WORKSPACE_QUERY = '(max-width: 767px)'

function workspaceMedia() {
  return globalThis.window?.matchMedia?.(MOBILE_WORKSPACE_QUERY)
}

function subscribe(onChange) {
  const media = workspaceMedia()
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}

function getSnapshot() {
  return workspaceMedia()?.matches ?? false
}

export function useMobileWorkspace() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export default function useMobileWorkspaceView() {
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useMobileWorkspace()
  const panel = parseMobileWorkspaceView(location.pathname, new URLSearchParams(location.search))

  function openMobileView(nextView, options) {
    const destination = mobileWorkspaceViewDestination(location, nextView)
    const nextPanel = parseMobileWorkspaceView(destination.pathname, new URLSearchParams(destination.search))
    if (nextPanel !== null && nextPanel !== panel) return navigate(destination, options)
  }

  return { isMobile, mobileView: panel ?? '', openMobileView }
}
