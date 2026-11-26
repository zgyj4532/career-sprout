import { matchPath } from 'react-router-dom'
import { parseProfileView } from './profileViews'

const workspacePanels = {
  '/jd': ['requirements', 'gap'],
  '/resume': ['materials', 'review'],
  '/interview': ['direction', 'materials', 'settings'],
}

const profilePanels = {
  personal: ['basics', 'education', 'availability'],
  skills: ['tags', 'assessment', 'other'],
  materials: ['import', 'class', 'sharing'],
}

function isExperiencePanel(panel) {
  if (!panel.startsWith('experience:')) return false
  const id = panel.slice('experience:'.length)
  return id.length > 0 && id.length <= 80 && id === id.trim()
}

// Absence is a valid overview; null means an invalid or ambiguous URL.
export function parseMobileWorkspaceView(pathname, params) {
  const values = params.getAll('panel')
  if (!values.length) return ''
  if (values.length !== 1) return null
  const [panel] = values
  if (matchPath('/profile', pathname)) {
    const view = parseProfileView(params)
    return (view === 'experiences' ? isExperiencePanel(panel) : profilePanels[view]?.includes(panel)) ? panel : null
  }
  return Object.entries(workspacePanels).some(([path, panels]) => matchPath(path, pathname) && panels.includes(panel)) ? panel : null
}

export function mobileWorkspaceViewDestination({ pathname, search, hash }, panel) {
  const params = new URLSearchParams(search)
  if (panel === '') params.delete('panel')
  else params.set('panel', panel)
  return { pathname, search: params.toString(), hash }
}

export function isWorkspaceViewSwitch(current, next) {
  if (current.pathname !== next.pathname || current.hash !== next.hash) return false

  const currentParams = new URLSearchParams(current.search)
  const nextParams = new URLSearchParams(next.search)
  const currentPanel = parseMobileWorkspaceView(current.pathname, currentParams)
  const nextPanel = parseMobileWorkspaceView(next.pathname, nextParams)
  if (currentPanel === null || nextPanel === null) return false

  let changed = currentPanel !== nextPanel
  if (matchPath('/profile', current.pathname)) {
    const currentView = parseProfileView(currentParams)
    const nextView = parseProfileView(nextParams)
    if (currentView === null || nextView === null) return false
    changed ||= currentView !== nextView
    currentParams.delete('view')
    nextParams.delete('view')
  }
  currentParams.delete('panel')
  nextParams.delete('panel')
  return changed && currentParams.toString() === nextParams.toString()
}

const resumeTabs = new Set([undefined, 'edit', 'import', 'versions'])

export function isResumeTabReplace(current, next, action) {
  if (action !== 'REPLACE' || !matchPath('/resume', current.pathname) || current.pathname !== next.pathname ||
    current.search !== next.search || current.hash !== next.hash || new URLSearchParams(current.search).has('panel')) return false

  const currentState = current.state ?? {}
  const nextState = next.state ?? {}
  if (Object.getPrototypeOf(currentState) !== Object.prototype || Object.getPrototypeOf(nextState) !== Object.prototype) return false

  const { resumeTab: currentTab, ...currentContext } = currentState
  const { resumeTab: nextTab, ...nextContext } = nextState
  if (currentTab === nextTab || !resumeTabs.has(currentTab) || !resumeTabs.has(nextTab)) return false

  const keys = Object.keys(currentContext)
  return keys.length === Object.keys(nextContext).length && keys.every((key) => Object.hasOwn(nextContext, key) && Object.is(currentContext[key], nextContext[key]))
}
