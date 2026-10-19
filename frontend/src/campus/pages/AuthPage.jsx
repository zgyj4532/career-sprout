import { useState } from 'react'
import { SignIn, SignUp, UserProfile } from '@clerk/clerk-react'
import { Link, useLocation } from 'react-router-dom'
import { safeReturnTo, useCampusSession } from '../auth'
import RequestError from '../components/RequestError'

export default function AuthPage() {
  const { pathname, search } = useLocation()
  const { status, error, refresh } = useCampusSession()
  const returnTo = safeReturnTo(new URLSearchParams(search).get('returnTo'))
  const register = pathname.startsWith('/register')
  const verify = pathname.startsWith('/verify-email')
  const [email, setEmail] = useState('')
  const configured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
  return <section className="campus-form campus-auth">
    <h1>{verify ? '验证邮箱' : register ? '注册职芽' : '登录职芽'}</h1>
    <p>从现在开始，让每一次练习长成未来。</p>
    <RequestError error={error} onRetry={refresh} />
    {!status && !error && <p role="status">正在确认账号服务状态…</p>}
    {status?.mode === 'local' && <div className="campus-note">当前使用本机体验身份，不是正式注册或登录；不会发送验证邮件，也不能取得教师权限。<Link to={returnTo}>继续本机体验</Link></div>}
    {status && <p className="campus-note">Resend 邮箱注册与验证暂未启用。此入口不会收集密码、发送邮件或创建会话。{configured && '下方正式账号由 Clerk 管理，与 Resend 预留入口分开。'}</p>}
    {status?.mode === 'clerk' && configured && (status.authenticated ? <>
      <p>你已登录。{status.user?.emailVerified ? '主邮箱已验证。' : '请在账号设置中验证主邮箱。'}</p>
      {verify && <UserProfile routing="hash" />}
      <Link className="button primary" to={returnTo}>继续使用职芽</Link>
    </> : register ? <SignUp routing="hash" signInUrl={`/login?returnTo=${encodeURIComponent(returnTo)}`} forceRedirectUrl={returnTo} /> : <SignIn routing="hash" signUpUrl={`/register?returnTo=${encodeURIComponent(returnTo)}`} forceRedirectUrl={returnTo} />)}
    {status?.mode === 'unavailable' && <p>正式账号服务尚不可用。请联系维护者配置 Clerk；不要在其他表单中输入密码。</p>}
    {status && status.mode !== 'clerk' && <form className="campus-panel" onSubmit={(event) => event.preventDefault()} aria-describedby="email-unavailable">
      <label>邮箱地址<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="用于未来正式账号，不会发送或保存" /></label>
      <button type="submit" disabled>{verify ? '发送验证邮件（尚未启用）' : register ? '注册并验证邮箱（尚未启用）' : '邮箱登录（尚未启用）'}</button>
      <p id="email-unavailable">邮箱认证尚未启用，因此操作按钮不可用。当前不会收集密码，也不会提交此邮箱或显示已发信。请使用已配置的正式 Clerk 入口，或继续明确标注的本机体验。</p>
    </form>}
    <nav className="campus-actions" aria-label="账号入口">
      <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>登录</Link>
      <Link to={`/register?returnTo=${encodeURIComponent(returnTo)}`}>注册</Link>
      <Link to="/verify-email">邮箱验证说明</Link>
    </nav>
  </section>
}
