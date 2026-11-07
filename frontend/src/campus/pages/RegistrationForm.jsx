import { useEffect, useRef, useState } from 'react'
import { useSignUp } from '@clerk/clerk-react'
import { Link, useNavigate } from 'react-router-dom'
import { safeReturnTo } from '../auth'
import { CampusApiError } from '../api'
import RequestError from '../components/RequestError'
import { MIN_PASSWORD_LENGTH, missingRequirementMessage, registrationError, registrationName, registrationStage, splitFullName } from './registration'

export default function RegistrationForm({ returnTo }) {
  const { isLoaded, signUp, setActive } = useSignUp()
  const navigate = useNavigate()
  const destination = safeReturnTo(returnTo)
  const [attempt, setAttempt] = useState(signUp)
  const [stage, setStage] = useState(() => registrationStage(signUp))
  const [fullName, setFullName] = useState(() => registrationName(signUp))
  const [nameEdited, setNameEdited] = useState(false)
  const [email, setEmail] = useState(signUp?.emailAddress || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const owner = useRef({ mounted: false, busy: false })
  const heading = useRef(null)

  useEffect(() => {
    const current = owner.current
    current.mounted = true
    return () => { current.mounted = false }
  }, [])
  useEffect(() => {
    if (!isLoaded || !signUp || attempt) return
    setAttempt(signUp)
    setStage(registrationStage(signUp))
    setFullName((value) => value || registrationName(signUp))
    setEmail((value) => value || signUp.emailAddress || '')
  }, [isLoaded, signUp, attempt])
  useEffect(() => { heading.current?.focus() }, [stage])

  async function run(action) {
    if (!isLoaded || !signUp || owner.current.busy) return
    owner.current.busy = true
    setBusy(true)
    setError(null)
    setNotice('')
    try {
      await action()
    } catch (err) {
      if (owner.current.mounted) setError(registrationError(err))
    } finally {
      owner.current.busy = false
      if (owner.current.mounted) setBusy(false)
    }
  }

  async function activate(result) {
    if (!result.createdSessionId) {
      throw new CampusApiError('账号资料已提交，但账号服务没有返回可用会话。请前往登录页确认账号，不要重复注册。', 0, { code: 'REGISTRATION_SESSION_MISSING' })
    }
    await setActive({
      session: result.createdSessionId,
      // Core 2 supplies session here; Core 3's decorateUrl is not available.
      navigate: ({ session }) => {
        if (!owner.current.mounted) return
        if (session?.currentTask || session?.status === 'pending') {
          navigate(`/login?returnTo=${encodeURIComponent(destination)}`, { replace: true })
        } else if (session?.status === 'active') {
          navigate(destination, { replace: true })
        } else {
          throw new CampusApiError('登录会话尚未激活，请重试继续登录，或前往登录页确认账号。', 0, { code: 'REGISTRATION_SESSION_INACTIVE' })
        }
      },
    })
  }

  async function advance(result, sendCode = false) {
    if (!owner.current.mounted) return
    setAttempt(result)
    const nextStage = registrationStage(result)
    setStage(nextStage)
    if (result.status === 'complete') {
      await activate(result)
      return
    }
    const missing = missingRequirementMessage(result)
    if (missing) {
      setNotice(missing)
      return
    }
    if (nextStage === 'verify') {
      if (sendCode) await sendVerification(result)
      return
    }
    setNotice('账号服务尚未完成注册，请检查资料后继续；若一直停留在这里，请联系维护者。')
  }

  async function sendVerification(resource = attempt) {
    const verification = resource?.verifications?.emailAddress
    if (verification?.supportedStrategies?.length && !verification.supportedStrategies.includes('email_code')) {
      throw new CampusApiError('账号服务当前未启用邮箱验证码验证，请联系维护者检查邮箱验证方式。', 0, { code: 'EMAIL_CODE_UNAVAILABLE' })
    }
    const result = await resource.prepareEmailAddressVerification({ strategy: 'email_code' })
    if (!owner.current.mounted) return
    setAttempt(result)
    setCode('')
    setNotice('验证码已发送，请查收最新邮件；也可以检查垃圾邮件文件夹。')
  }

  function submitDetails(event) {
    event.preventDefault()
    void run(async () => {
      const name = splitFullName(fullName)
      if (!name.firstName) throw new CampusApiError('请填写你的全名。', 0, { code: 'REGISTRATION_NAME_REQUIRED' })
      const creating = !attempt?.id || attempt.status === 'abandoned'
      const needsPassword = creating || !attempt.hasPassword || attempt.missingFields?.includes('password')
      if ((needsPassword || password) && Array.from(password).length < MIN_PASSWORD_LENGTH) {
        throw new CampusApiError('密码至少需要 8 个字符，不限制为恰好 8 个；请使用更长且未泄露的密码。', 0, { code: 'REGISTRATION_PASSWORD_TOO_SHORT' })
      }
      const params = { emailAddress: email.trim() }
      // Updating an unfinished attempt is not a migration of existing users' names.
      // Untouched provider names are preserved exactly, including their original split.
      if (creating || nameEdited || (!attempt.firstName && !attempt.lastName)) {
        params.firstName = name.firstName
        if (name.lastName || !creating) params.lastName = name.lastName
      }
      if (password) params.password = password
      const result = creating ? await signUp.create(params) : await attempt.update(params)
      if (!owner.current.mounted) return
      setPassword('')
      await advance(result, true)
    })
  }

  function verifyEmail(event) {
    event.preventDefault()
    void run(async () => {
      const result = await attempt.attemptEmailAddressVerification({ code: code.trim() })
      if (!owner.current.mounted) return
      setCode('')
      await advance(result)
    })
  }

  function changeEmail(event) {
    event.preventDefault()
    void run(async () => {
      const result = await attempt.update({ emailAddress: email.trim() })
      if (!owner.current.mounted) return
      setCode('')
      await advance(result, true)
    })
  }

  const passwordRequired = !attempt?.id || attempt.status === 'abandoned' || !attempt.hasPassword || attempt.missingFields?.includes('password')
  const requirement = notice || missingRequirementMessage(attempt)

  return <div className="campus-auth-card campus-form" aria-busy={busy}>
    <header className="campus-auth-heading">
      <h1 ref={heading} tabIndex={-1}>{stage === 'verify' ? '验证邮箱' : stage === 'change-email' ? '更换注册邮箱' : stage === 'complete' ? '继续登录' : '注册职芽'}</h1>
      <p>{stage === 'verify' ? '完成邮箱验证后，才能继续注册与登录。' : '保存练习与成长记录，随时继续。'}</p>
    </header>
    <RequestError error={error} />
    {requirement && <p className="campus-note" role="status">{requirement}</p>}
    {!isLoaded && <p role="status">正在连接安全注册服务…</p>}
    {stage === 'details' && <form className="campus-form" onSubmit={submitDetails}>
      <label htmlFor="registration-name">全名</label>
      <input id="registration-name" name="name" autoComplete="name" required value={fullName} disabled={busy} onChange={(event) => { setFullName(event.target.value); setNameEdited(true) }} />
      <label htmlFor="registration-email">邮箱地址</label>
      <input id="registration-email" name="email" type="email" autoComplete="email" required value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} />
      <label htmlFor="registration-password">{passwordRequired ? '密码' : '新密码（不修改可留空）'}</label>
      <input id="registration-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required={passwordRequired} aria-describedby="registration-password-help" value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} />
      <button type="button" aria-pressed={showPassword} aria-controls="registration-password" onClick={() => setShowPassword((value) => !value)}>{showPassword ? '隐藏密码' : '显示密码'}</button>
      <p id="registration-password-help">至少 8 个字符，可以更长。账号服务可能要求更长的密码，最终还需通过长度、强度和泄露密码检查。</p>
      <button type="submit" className="primary" disabled={!isLoaded || busy}>{busy ? '正在提交…' : '注册并继续'}</button>
    </form>}
    {stage === 'verify' && <>
      <p>注册邮箱：<strong style={{ overflowWrap: 'anywhere' }}>{attempt?.emailAddress}</strong></p>
      <form className="campus-form" onSubmit={verifyEmail}>
        <label htmlFor="registration-code">邮箱验证码</label>
        <input id="registration-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" required value={code} disabled={busy} onChange={(event) => setCode(event.target.value)} />
        <button type="submit" className="primary" disabled={!isLoaded || busy}>{busy ? '正在确认…' : '验证并继续'}</button>
      </form>
      <div className="campus-actions">
        <button type="button" disabled={busy} onClick={() => void run(() => sendVerification())}>重新发送验证码</button>
        <button type="button" disabled={busy} onClick={() => { setEmail(attempt?.emailAddress || ''); setError(null); setNotice(''); setCode(''); setStage('change-email') }}>更换邮箱</button>
      </div>
    </>}
    {stage === 'change-email' && <form className="campus-form" onSubmit={changeEmail}>
      <label htmlFor="registration-new-email">新的邮箱地址</label>
      <input id="registration-new-email" name="email" type="email" autoComplete="email" required value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} />
      <button type="submit" className="primary" disabled={busy}>{busy ? '正在更新…' : '更新邮箱并发送验证码'}</button>
      <button type="button" disabled={busy} onClick={() => { setEmail(attempt?.emailAddress || ''); setError(null); setStage('verify') }}>返回验证码验证</button>
    </form>}
    {stage === 'complete' && <>
      <p>注册步骤已完成，仍需由账号服务激活登录会话。</p>
      <button type="button" className="primary" disabled={busy} onClick={() => void run(() => activate(attempt))}>{busy ? '正在激活登录…' : '重试继续登录'}</button>
    </>}
    {/* Keep the challenge mount present before create(), including asynchronous retries. */}
    <div id="clerk-captcha" data-cl-language="zh-CN" data-cl-theme="light" data-cl-size="flexible" />
    {busy && <p role="status">正在等待账号服务，请勿重复提交。若长时间没有响应，可返回登录入口确认账号状态。</p>}
    {stage === 'details' && <p>也可以使用 Google 等已启用的第三方账号创建职芽账号，无需先完成邮箱注册。<Link to={`/login?returnTo=${encodeURIComponent(destination)}`}>使用第三方账号注册或登录</Link></p>}
    <p>已有账号？<Link to={`/login?returnTo=${encodeURIComponent(destination)}`}>前往登录</Link></p>
  </div>
}
