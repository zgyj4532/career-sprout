import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { Link, useLocation } from 'react-router-dom'
import { campusData } from './api'

const SessionContext = createContext(null)
export function safeReturnTo(value) {
  if (typeof value !== 'string' || !/^\/(?!\/)/.test(value) || Array.from(value).some((character) => character.charCodeAt(0) <= 32 || character === '\\' || character === '%')) return '/'
  return /^\/(?:login|register|verify-email)(?:[/?#]|$)/.test(value) ? '/' : value
}
export function useCampusSession() { return useContext(SessionContext) }

function SessionState({ children, clerkLoaded = true, sessionId = null, signOut }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const sequence = useRef(0)
  const pending = useRef(null)
  const refresh = useCallback(async () => {
    const version = ++sequence.current
    pending.current?.abort()
    if (!clerkLoaded) return
    const controller = new AbortController()
    pending.current = controller
    setError(null)
    try {
      const data = await campusData('/auth/status', { signal: controller.signal })
      if (version === sequence.current) setStatus(data)
    } catch (err) {
      if (version === sequence.current && !controller.signal.aborted) setError(err)
    } finally {
      if (pending.current === controller) pending.current = null
    }
  }, [clerkLoaded])
  useEffect(() => {
    setStatus(null)
    refresh()
    return () => { sequence.current += 1; pending.current?.abort() }
  }, [clerkLoaded, sessionId, refresh])
  async function logout() {
    sequence.current += 1
    pending.current?.abort()
    setStatus(null)
    setError(null)
    try { await signOut?.() } catch (err) { setError(err) }
  }
  return <SessionContext.Provider value={{ status, error, refresh, signOut: logout }}>{children}</SessionContext.Provider>
}
function ClerkSession({ children }) {
  const { isLoaded, sessionId } = useAuth()
  const clerk = useClerk()
  return <SessionState clerkLoaded={isLoaded} sessionId={sessionId} signOut={() => clerk.signOut({ redirectUrl: '/login' })}>{children}</SessionState>
}
export function CampusSessionProvider({ children }) {
  return import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? <ClerkSession>{children}</ClerkSession> : <SessionState>{children}</SessionState>
}
export function SessionNavigation() {
  const { status, signOut } = useCampusSession()
  const { pathname } = useLocation()
  if (!status) return <Link to="/login">账号状态</Link>
  return <div className="campus-session-nav">
    {status.mode === 'local' ? <><span className="campus-dev-note">本机体验身份 · 非正式账号</span><Link to={`/login?returnTo=${encodeURIComponent(pathname)}`}>注册 / 登录正式账号</Link></> : status.authenticated ? <><span>已登录{status.user?.emailVerified ? '' : ' · 邮箱待验证'}</span><button type="button" onClick={signOut}>退出登录</button></> : <Link to={`/login?returnTo=${encodeURIComponent(pathname)}`}>登录 / 注册</Link>}
    {status.user?.isTeacher && <Link to="/teacher">教师荐才</Link>}
  </div>
}
