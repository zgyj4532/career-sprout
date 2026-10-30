import { useState } from 'react'
import { SignIn, SignUp, UserProfile } from '@clerk/clerk-react'
import { Link, useLocation } from 'react-router-dom'
import { safeReturnTo, useCampusSession } from '../auth'
import RequestError from '../components/RequestError'

const clerkAppearance = {
  variables: {
    colorPrimary: '#0f6e56',
    colorPrimaryForeground: '#f4fff9',
    colorBackground: '#fffaf3',
    colorForeground: '#1c1915',
    colorMutedForeground: '#5f584e',
    colorBorder: '#d9d0c3',
    colorDanger: '#b42318',
    fontFamily: 'inherit',
    fontSize: '0.9375rem',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'campus-auth-clerk',
    cardBox: 'campus-auth-clerk-box',
    card: 'campus-auth-clerk-card',
    headerTitle: 'campus-auth-clerk-title',
    headerSubtitle: 'campus-auth-clerk-subtitle',
    formButtonPrimary: 'campus-auth-clerk-primary',
    socialButtonsBlockButton: 'campus-auth-clerk-social',
    formFieldInput: 'campus-auth-clerk-input',
    footer: 'campus-auth-clerk-footer',
    footerActionLink: 'campus-auth-clerk-link',
  },
}

export default function AuthPage() {
  const { pathname, search } = useLocation()
  const { status, error, loadingStage, refresh } = useCampusSession()
  const returnTo = safeReturnTo(new URLSearchParams(search).get('returnTo'))
  const register = pathname.startsWith('/register')
  const verify = pathname.startsWith('/verify-email')
  const [email, setEmail] = useState('')
  const configured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
  const ready = status && !error && !loadingStage
  const showClerkForm = ready && status.mode === 'clerk' && configured && !status.authenticated
  const showProfile = ready && status.mode === 'clerk' && configured && status.authenticated && verify
  const returnQuery = `?returnTo=${encodeURIComponent(returnTo)}`

  return <section className={`campus-auth${showProfile ? ' campus-auth-profile' : ''}`} aria-label={verify ? '邮箱验证' : register ? '账号注册' : '账号登录'}>
    <svg className="campus-auth-leaves" viewBox="0 0 280 320" fill="none" aria-hidden="true" focusable="false">
      <path d="M264 312C189 242 160 165 139 54M240 287C178 251 115 228 47 225" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <g fill="currentColor" fillOpacity="0.16">
        <path d="M147 99C107 90 93 49 107 16C143 34 158 61 147 99Z" />
        <path d="M156 137C157 92 192 66 226 69C222 110 195 135 156 137Z" />
        <path d="M172 181C123 179 90 149 93 113C135 117 162 141 172 181Z" />
        <path d="M190 219C189 173 220 145 258 142C257 182 233 211 190 219Z" />
        <path d="M120 244C89 257 49 248 24 215C65 199 102 213 120 244Z" />
        <path d="M179 266C149 225 151 191 172 167C202 198 204 235 179 266Z" />
      </g>
    </svg>
    <div className="campus-auth-content">
      {showClerkForm ? register
        ? <SignUp appearance={clerkAppearance} routing="hash" signInUrl={`/login${returnQuery}`} forceRedirectUrl={returnTo} />
        : <SignIn appearance={clerkAppearance} routing="hash" signUpUrl={`/register${returnQuery}`} forceRedirectUrl={returnTo} />
        : <div className="campus-auth-card campus-form">
          <header className="campus-auth-heading">
            <h1>{verify ? '验证邮箱' : register ? '注册职芽' : '登录职芽'}</h1>
            <p>{verify ? '登录后，在账号设置中验证你的主邮箱。' : '保存练习与成长记录，随时继续。'}</p>
          </header>
          <RequestError error={error} onRetry={refresh} />
          {!error && loadingStage && <p className="campus-auth-status" role="status">{loadingStage === 'clerk' ? '正在连接安全登录服务…' : '正在确认账号服务状态…'}</p>}
          {ready && status.mode === 'local' && <div className="campus-note">当前使用本机体验身份，不是正式注册或登录；不会发送验证邮件，也不能取得教师权限。<Link to={returnTo}>继续本机体验</Link></div>}
          {ready && status.mode === 'clerk' && configured && status.authenticated && <>
            <p>你已登录。{status.user?.emailVerified ? '主邮箱已验证。' : '请在账号设置中验证主邮箱。'}</p>
            {showProfile && <UserProfile appearance={clerkAppearance} routing="hash" />}
            <Link className="button primary campus-auth-continue" to={returnTo}>继续使用职芽</Link>
          </>}
          {ready && (status.mode === 'unavailable' || (status.mode === 'clerk' && !configured)) && <p className="campus-note">正式账号服务尚不可用。请联系维护者配置 Clerk；不要在其他表单中输入密码。</p>}
          {ready && status.mode !== 'clerk' && <form className="campus-form" onSubmit={(event) => event.preventDefault()} aria-describedby="email-unavailable">
            <label>邮箱地址<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="用于未来正式账号，不会发送或保存" /></label>
            <button type="submit" disabled>{verify ? '发送验证邮件（尚未启用）' : register ? '注册并验证邮箱（尚未启用）' : '邮箱登录（尚未启用）'}</button>
            <p id="email-unavailable">邮箱认证尚未启用，因此操作按钮不可用。当前不会收集密码，也不会提交此邮箱或显示已发信。请联系维护者配置正式账号服务，或继续明确标注的本机体验。</p>
          </form>}
        </div>}
      <nav className="campus-auth-links" aria-label="账号入口">
        {!showClerkForm && <>
          <Link to={`/login${returnQuery}`}>登录</Link>
          <Link to={`/register${returnQuery}`}>注册</Link>
        </>}
        {!verify && <Link to={`/verify-email${returnQuery}`}>邮箱验证说明</Link>}
        <Link to="/">返回首页</Link>
      </nav>
    </div>
  </section>
}
