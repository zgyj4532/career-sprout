import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegistrationForm from '../RegistrationForm'
import AuthPage from '../AuthPage'
import { splitFullName } from '../registration'

const sdk = vi.hoisted(() => ({ isLoaded: true, signUp: null, setActive: vi.fn() }))
vi.mock('@clerk/clerk-react', () => ({
  useSignUp: () => sdk,
  useAuth: vi.fn(),
  useClerk: vi.fn(),
  useSession: vi.fn(),
  SignIn: () => <div role="region" aria-label="Clerk sign-in form" />,
  UserProfile: vi.fn(),
}))
vi.mock('../../auth', async (importOriginal) => ({
  ...(await importOriginal()),
  useCampusSession: () => ({ status: { mode: 'clerk', authenticated: false }, error: null, loadingStage: null }),
}))

function resource(overrides = {}) {
  const result = {
    id: null, status: null, firstName: null, lastName: null, emailAddress: null,
    hasPassword: false, missingFields: [], unverifiedFields: [], createdSessionId: null,
    verifications: { emailAddress: { supportedStrategies: ['email_code'] } },
    ...overrides,
  }
  result.create = vi.fn(async (params) => {
    Object.assign(result, params, { id: 'signup-test', status: 'missing_requirements', hasPassword: true, unverifiedFields: ['email_address'] })
    return result
  })
  result.update = vi.fn(async (params) => { Object.assign(result, params); return result })
  result.prepareEmailAddressVerification = vi.fn(async () => result)
  result.attemptEmailAddressVerification = vi.fn(async () => {
    Object.assign(result, { status: 'complete', unverifiedFields: [], createdSessionId: 'session-test' })
    return result
  })
  return result
}

function Location() {
  const location = useLocation()
  return <output aria-label="当前位置">{location.pathname}{location.search}{location.hash}</output>
}
function renderForm(returnTo = '/resume', basename = '/') {
  return render(<MemoryRouter basename={basename} initialEntries={[`${basename === '/' ? '' : basename}/register`]}>
    <RegistrationForm returnTo={returnTo} /><Location />
  </MemoryRouter>)
}
function fillDetails(name = '王小明', password = 'unbreached-long-passphrase') {
  fireEvent.change(screen.getByLabelText('全名'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'student@example.test' } })
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: password } })
}
async function beginVerification() {
  fillDetails()
  fireEvent.click(screen.getByRole('button', { name: '注册并继续' }))
  await screen.findByRole('button', { name: '验证并继续' })
}
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  sdk.isLoaded = true
  sdk.signUp = resource()
  sdk.setActive.mockReset().mockImplementation(async ({ navigate }) => navigate({ session: { status: 'active' } }))
})
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('full-name registration mapping', () => {
  it.each([
    ['王小明', { firstName: '王', lastName: '小明' }],
    ['𠮷小明', { firstName: '𠮷', lastName: '小明' }],
    ['欧阳娜娜', { firstName: '欧', lastName: '阳娜娜' }],
    ['  Ada   Lovelace Byron  ', { firstName: 'Ada', lastName: 'Lovelace Byron' }],
    ['单', { firstName: '单', lastName: '' }],
    ['Prince', { firstName: 'Prince', lastName: '' }],
    ['   ', { firstName: '', lastName: '' }],
  ])('maps %s without inventing a last name', (input, expected) => {
    expect(splitFullName(input)).toEqual(expected)
  })

  it.each(['王', 'Prince'])('omits the optional last name for one-part name %s', async (name) => {
    renderForm()
    fillDetails(name)
    fireEvent.click(screen.getByRole('button', { name: '注册并继续' }))
    await screen.findByLabelText('邮箱验证码')
    expect(sdk.signUp.create).toHaveBeenCalledWith(expect.objectContaining({ firstName: name }))
    expect(sdk.signUp.create.mock.calls[0][0]).not.toHaveProperty('lastName')
  })
})

describe('legacy Clerk registration lifecycle', () => {
  it.each([
    ['/career-sprout/teacher', '/teacher'],
    ['//evil.example/path', '/'],
  ])('lets new third-party users reach prebuilt login with safe returnTo %s', (returnTo, expected) => {
    vi.stubEnv('BASE_URL', '/career-sprout/')
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'test-key-only-sdk-is-mocked')
    render(<MemoryRouter basename="/career-sprout" initialEntries={['/career-sprout/register']}>
      <Routes>
        <Route path="/register" element={<RegistrationForm returnTo={returnTo} />} />
        <Route path="/login" element={<AuthPage />} />
      </Routes>
      <Location />
    </MemoryRouter>)
    expect(screen.getByText(/无需先完成邮箱注册/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: '使用第三方账号注册或登录' }))
    expect(screen.getByRole('region', { name: 'Clerk sign-in form' })).toBeInTheDocument()
    expect(screen.getByLabelText('当前位置')).toHaveTextContent(`/login?returnTo=${encodeURIComponent(expected)}`)
    expect(sdk.signUp.create).not.toHaveBeenCalled()
    expect(sdk.signUp.update).not.toHaveBeenCalled()
    expect(sdk.setActive).not.toHaveBeenCalled()
  })

  it('creates real signup fields, verifies email, activates only a completed session and retains safe basename destination', async () => {
    vi.stubEnv('BASE_URL', '/career-sprout/')
    renderForm('/career-sprout/resume?import=1#draft', '/career-sprout')
    await beginVerification()
    expect(sdk.signUp.create).toHaveBeenCalledWith({ firstName: '王', lastName: '小明', emailAddress: 'student@example.test', password: 'unbreached-long-passphrase' })
    expect(sdk.signUp.prepareEmailAddressVerification).toHaveBeenCalledWith({ strategy: 'email_code' })
    expect(sdk.setActive).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '验证邮箱' })).toHaveFocus()
    fireEvent.change(screen.getByLabelText('邮箱验证码'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: '验证并继续' }))
    await waitFor(() => expect(screen.getByLabelText('当前位置')).toHaveTextContent('/resume?import=1#draft'))
    expect(sdk.signUp.attemptEmailAddressVerification).toHaveBeenCalledWith({ code: '123456' })
    expect(sdk.setActive).toHaveBeenCalledWith(expect.objectContaining({ session: 'session-test' }))
  })

  it.each(['1234567', '😀😀😀😀😀😀😀'])('rejects a seven-character password before calling Clerk', async (password) => {
    renderForm()
    fillDetails('王小明', password)
    fireEvent.click(screen.getByRole('button', { name: '注册并继续' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('至少需要 8 个字符')
    expect(sdk.signUp.create).not.toHaveBeenCalled()
  })

  it.each(['12345678', '😀😀😀😀😀😀😀😀', 'longer-than-eight-characters'])('submits %s for provider validation without claiming acceptance', async (password) => {
    sdk.signUp.create.mockRejectedValue({ errors: [{ code: 'form_password_length_too_short', longMessage: 'private provider payload' }] })
    renderForm()
    fillDetails('Ada Lovelace Byron', password)
    fireEvent.click(screen.getByRole('button', { name: '注册并继续' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('账号服务当前的最低长度要求')
    expect(sdk.signUp.create).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Ada', lastName: 'Lovelace Byron', password }))
    expect(screen.queryByText('private provider payload')).not.toBeInTheDocument()
    expect(sdk.setActive).not.toHaveBeenCalled()
  })

  it('provides a real captcha mount before create and blocks duplicate in-flight submissions', async () => {
    const pending = deferred()
    sdk.signUp.create.mockImplementation(() => {
      expect(document.getElementById('clerk-captcha')).toBeInTheDocument()
      return pending.promise
    })
    const view = renderForm()
    fillDetails()
    const form = screen.getByLabelText('全名').closest('form')
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(sdk.signUp.create).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '正在提交…' })).toBeDisabled()
    view.unmount()
    await act(async () => pending.resolve(resource({ id: 'late', status: 'complete', createdSessionId: 'late-session' })))
    expect(sdk.setActive).not.toHaveBeenCalled()
  })

  it('retains verification recovery when the initial email delivery fails', async () => {
    sdk.signUp.prepareEmailAddressVerification.mockRejectedValueOnce(new Error('private transport detail'))
    renderForm()
    fillDetails()
    fireEvent.click(screen.getByRole('button', { name: '注册并继续' }))
    await screen.findByRole('alert')
    expect(screen.queryByText(/验证码已发送/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新发送验证码' }))
    await screen.findByText(/验证码已发送/)
    expect(sdk.signUp.create).toHaveBeenCalledOnce()
    expect(sdk.signUp.prepareEmailAddressVerification).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['form_code_incorrect', '验证码不正确'],
    ['verification_expired', '验证码已过期'],
    ['too_many_requests', '操作太频繁'],
  ])('keeps the email-code step recoverable on %s', async (providerCode, message) => {
    sdk.signUp.attemptEmailAddressVerification.mockRejectedValueOnce({ errors: [{ code: providerCode }] })
    renderForm()
    await beginVerification()
    fireEvent.change(screen.getByLabelText('邮箱验证码'), { target: { value: '999999' } })
    fireEvent.click(screen.getByRole('button', { name: '验证并继续' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(sdk.setActive).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '重新发送验证码' })).toBeEnabled()
  })

  it('changes only the unfinished signup email and prepares verification for the updated address', async () => {
    renderForm()
    await beginVerification()
    fireEvent.click(screen.getByRole('button', { name: '更换邮箱' }))
    fireEvent.change(screen.getByLabelText('新的邮箱地址'), { target: { value: 'correct@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: '更新邮箱并发送验证码' }))
    await screen.findByText('correct@example.test')
    expect(sdk.signUp.update).toHaveBeenCalledWith({ emailAddress: 'correct@example.test' })
    expect(sdk.signUp.create).toHaveBeenCalledOnce()
    expect(sdk.signUp.prepareEmailAddressVerification).toHaveBeenCalledTimes(2)
    expect(sdk.setActive).not.toHaveBeenCalled()
  })

  it('returns missing name requirements to the one-name form without granting a session', async () => {
    sdk.signUp.attemptEmailAddressVerification.mockImplementation(async () => {
      Object.assign(sdk.signUp, { missingFields: ['first_name'], unverifiedFields: [], firstName: null, lastName: null })
      return sdk.signUp
    })
    renderForm()
    await beginVerification()
    fireEvent.change(screen.getByLabelText('邮箱验证码'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: '验证并继续' }))
    await screen.findByLabelText('全名')
    expect(screen.queryByLabelText('姓氏')).not.toBeInTheDocument()
    expect(sdk.setActive).not.toHaveBeenCalled()
    expect(screen.getByText(/还需补全/)).toBeInTheDocument()
  })

  it('preserves the original provider name split when resuming an unfinished attempt', async () => {
    sdk.signUp = resource({ id: 'existing-signup', status: 'missing_requirements', firstName: 'Mary Jane', lastName: 'van Doe', missingFields: ['password'], emailAddress: 'student@example.test' })
    renderForm()
    expect(screen.getByLabelText('全名')).toHaveValue('Mary Jane van Doe')
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'new-long-passphrase' } })
    fireEvent.click(screen.getByRole('button', { name: '注册并继续' }))
    await waitFor(() => expect(sdk.signUp.update).toHaveBeenCalled())
    expect(sdk.signUp.update.mock.calls[0][0]).not.toHaveProperty('firstName')
    expect(sdk.signUp.update.mock.calls[0][0]).not.toHaveProperty('lastName')
    expect(sdk.signUp.create).not.toHaveBeenCalled()
  })

  it.each(['legal_accepted', 'phone_number', 'protect_check'])('does not pretend unsupported requirement %s is completed', (field) => {
    sdk.signUp = resource({ id: 'existing-signup', status: 'missing_requirements', missingFields: [field] })
    renderForm()
    expect(screen.getByText(/当前邮箱注册页无法完成/)).toBeInTheDocument()
    expect(sdk.setActive).not.toHaveBeenCalled()
  })

  it('does not invent a surname when the provider makes last name required', () => {
    sdk.signUp = resource({ id: 'existing-signup', status: 'missing_requirements', firstName: '王', missingFields: ['last_name'] })
    renderForm()
    expect(screen.getByLabelText('全名')).toHaveValue('王')
    expect(screen.getByText(/不要填写虚构姓名/)).toBeInTheDocument()
  })

  it('allows activation to be retried without repeating signup or code verification', async () => {
    sdk.setActive.mockRejectedValueOnce(new Error('private activation failure'))
    renderForm()
    await beginVerification()
    fireEvent.change(screen.getByLabelText('邮箱验证码'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: '验证并继续' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: '重试继续登录' }))
    await waitFor(() => expect(screen.getByLabelText('当前位置')).toHaveTextContent('/resume'))
    expect(sdk.setActive).toHaveBeenCalledTimes(2)
    expect(sdk.signUp.create).toHaveBeenCalledOnce()
    expect(sdk.signUp.attemptEmailAddressVerification).toHaveBeenCalledOnce()
  })

  it('routes pending session tasks to prebuilt login instead of the protected destination', async () => {
    sdk.setActive.mockImplementation(async ({ navigate }) => navigate({ session: { status: 'pending', currentTask: { key: 'choose-organization' } } }))
    sdk.signUp = resource({ id: 'completed-signup', status: 'complete', createdSessionId: 'pending-session' })
    renderForm('/teacher')
    fireEvent.click(screen.getByRole('button', { name: '重试继续登录' }))
    await waitFor(() => expect(screen.getByLabelText('当前位置')).toHaveTextContent('/login?returnTo=%2Fteacher'))
  })

  it('never activates a complete response without a real created session', async () => {
    sdk.signUp = resource({ id: 'completed-signup', status: 'complete' })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: '重试继续登录' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('没有返回可用会话')
    expect(sdk.setActive).not.toHaveBeenCalled()
  })

  it('rejects external return destinations for activation and the login link', async () => {
    sdk.signUp = resource({ id: 'completed-signup', status: 'complete', createdSessionId: 'session-test' })
    renderForm('//evil.example/path')
    expect(screen.getByRole('link', { name: '前往登录' })).toHaveAttribute('href', '/login?returnTo=%2F')
    fireEvent.click(screen.getByRole('button', { name: '重试继续登录' }))
    await waitFor(() => expect(screen.getByLabelText('当前位置')).toHaveTextContent(/^\/$/))
  })

  it('shows unknown provider errors safely and keeps entered details for correction', async () => {
    sdk.signUp.create.mockRejectedValue({ errors: [{ code: 'unknown-internal', longMessage: 'secret-private-account-detail' }] })
    renderForm()
    fillDetails()
    fireEvent.click(screen.getByRole('button', { name: '注册并继续' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('操作未完成')
    expect(screen.queryByText(/secret-private-account-detail/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('全名')).toHaveValue('王小明')
    expect(screen.getByLabelText('邮箱地址')).toHaveValue('student@example.test')
  })
})
