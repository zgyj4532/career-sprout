import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { Link, useLocation } from 'react-router-dom'
import { CampusApiError, campusData } from './api'

const SessionContext = createContext(null)
const CLERK_LOAD_TIMEOUT_MS = 20000
const SESSION_STATUS_TIMEOUT_MS = 15000

function clerkLoadError(failed) {
  return new CampusApiError(`${failed ? '登录组件加载失败' : '登录组件加载超时'}。请检查网络及浏览器是否拦截 Clerk；重试会刷新当前页面，未保存的内容可能丢失，请先保存。`, 0, { code: failed ? 'CLERK_LOAD_FAILED' : 'CLERK_LOAD_TIMEOUT' })
}

export function safeReturnTo(value) {
  if (typeof value !== 'string' || !/^\/(?!\/)/.test(value) || Array.from(value).some((character) => character.charCodeAt(0) <= 32 || character === '\\' || character === '%')) return '/'
  return /^\/(?:login|register|verify-email)(?:[/?#]|$)/.test(value) ? '/' : value
}
export function useCampusSession() { return useContext(SessionContext) }

function SessionState({ children, clerkLoaded = true, clerkFailed = false, sessionId = null, signOut }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [loadingStage, setLoadingStage] = useState(clerkLoaded ? 'session' : 'clerk')
  const sequence = useRef(0)
  const pending = useRef(null)
  const loadStatus = useCallback(async () => {
    const version = ++sequence.current
    pending.current?.()
    const controller = new AbortController()
    let timer
    // Abort alone cannot settle a Clerk getToken() promise that never returns.
    const deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new CampusApiError('确认账号状态超时。请检查网络连接后重试；若仍失败，请联系管理员检查账号服务。', 0, { code: 'SESSION_STATUS_TIMEOUT' }))
        controller.abort()
      }, SESSION_STATUS_TIMEOUT_MS)
      pending.current = () => { clearTimeout(timer); controller.abort(); resolve(null) }
    })
    setStatus(null)
    setError(null)
    setLoadingStage('session')
    try {
      const data = await Promise.race([campusData('/auth/status', { signal: controller.signal }), deadline])
      if (version !== sequence.current) return
      if (!data) throw new CampusApiError('未能读取账号状态，请重试或联系管理员检查账号服务。', 0, { code: 'INVALID_RESPONSE' })
      setStatus(data)
    } catch (err) {
      if (version === sequence.current) setError(err instanceof CampusApiError ? err : new CampusApiError('未能确认账号状态，请检查连接后重试。', 0, { code: 'SESSION_STATUS_FAILED' }))
    } finally {
      clearTimeout(timer)
      if (version === sequence.current) { pending.current = null; setLoadingStage(null) }
    }
  }, [])
  const refresh = useCallback(async () => {
    if (!clerkLoaded || clerkFailed) {
      // A failed SDK script/client is not restarted by rereading account status.
      // Keep the current URL and native unsaved-work unload protection.
      window.location.reload()
      return
    }
    await loadStatus()
  }, [clerkLoaded, clerkFailed, loadStatus])
  useEffect(() => {
    const version = ++sequence.current
    pending.current?.()
    pending.current = null
    setStatus(null)
    setError(null)
    let timer
    if (clerkFailed) {
      setLoadingStage(null)
      setError(clerkLoadError(true))
    } else if (!clerkLoaded) {
      setLoadingStage('clerk')
      timer = setTimeout(() => {
        if (version !== sequence.current) return
        setLoadingStage(null)
        setError(clerkLoadError(false))
      }, CLERK_LOAD_TIMEOUT_MS)
    } else {
      void loadStatus()
    }
    return () => { clearTimeout(timer); sequence.current += 1; pending.current?.(); pending.current = null }
  }, [clerkLoaded, clerkFailed, sessionId, loadStatus])
  async function logout() {
    const version = ++sequence.current
    pending.current?.()
    let timer
    const deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new CampusApiError('等待退出登录超时，退出结果尚未确认。请重试确认账号状态后再次退出。', 0, { code: 'SIGN_OUT_TIMEOUT' })), SESSION_STATUS_TIMEOUT_MS)
      pending.current = () => { clearTimeout(timer); resolve() }
    })
    setStatus(null)
    setError(null)
    setLoadingStage('session')
    try {
      await Promise.race([signOut?.(), deadline])
      clearTimeout(timer)
      if (version === sequence.current) { pending.current = null; await loadStatus() }
    } catch (err) {
      if (version === sequence.current) {
        setLoadingStage(null)
        setError(err instanceof CampusApiError ? err : new CampusApiError('退出登录未完成，请重试确认账号状态后再次退出。', 0, { code: 'SIGN_OUT_FAILED' }))
      }
    } finally {
      clearTimeout(timer)
      if (version === sequence.current) pending.current = null
    }
  }
  return <SessionContext.Provider value={{ status, error, loadingStage, refresh, signOut: logout }}>{children}</SessionContext.Provider>
}
function ClerkSession({ children }) {
  const { isLoaded, sessionId } = useAuth()
  const clerk = useClerk()
  return <SessionState clerkLoaded={isLoaded} clerkFailed={clerk.status === 'error'} sessionId={sessionId} signOut={() => clerk.signOut({ redirectUrl: '/login' })}>{children}</SessionState>
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
