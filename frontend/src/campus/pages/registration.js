import { CampusApiError } from '../api'

export const MIN_PASSWORD_LENGTH = 8

export function splitFullName(value) {
  const name = value.trim().replace(/\s+/gu, ' ')
  if (/^\p{Script=Han}/u.test(name)) {
    const [firstName, ...rest] = Array.from(name)
    return { firstName, lastName: rest.join('').trim() }
  }
  const [firstName = '', ...rest] = name.split(' ')
  return { firstName, lastName: rest.join(' ') }
}

export function registrationName(signUp) {
  const first = signUp?.firstName || ''
  const last = signUp?.lastName || ''
  return [first, last].filter(Boolean).join(/^\p{Script=Han}/u.test(first) ? '' : ' ')
}

export function registrationStage(signUp) {
  if (signUp?.status === 'complete') return 'complete'
  if (!signUp?.id || signUp.status === 'abandoned') return 'details'
  if (signUp.missingFields?.length) return 'details'
  if (signUp.unverifiedFields?.includes('email_address')) return 'verify'
  return 'details'
}

export function missingRequirementMessage(signUp) {
  const missing = signUp?.missingFields || []
  const unsupported = missing.some((field) => !['first_name', 'last_name', 'email_address', 'password'].includes(field))
  const otherVerification = signUp?.unverifiedFields?.some((field) => field !== 'email_address')
  if (unsupported || otherVerification) return '账号服务还要求额外的注册或安全验证步骤。当前邮箱注册页无法完成这些步骤，请联系维护者检查注册配置；账号尚未完成注册。'
  if (missing.includes('last_name')) return '账号服务要求非空的姓名后半部分。若你的全名只有一个字或一个词，请联系维护者将姓氏设为可选；不要填写虚构姓名。'
  if (missing.length) return '还需补全以下注册资料，请检查姓名、邮箱和密码后继续。'
  return ''
}

const errorMessages = {
  form_identifier_exists: '这个邮箱已关联账号，请使用下方登录入口；忘记密码可在登录页找回。',
  form_identifier_exists__email_address: '这个邮箱已关联账号，请使用下方登录入口；忘记密码可在登录页找回。',
  form_code_incorrect: '验证码不正确，请核对最新邮件中的验证码。',
  verification_expired: '验证码已过期，请重新发送验证码。',
  verification_failed: '邮箱验证未完成，请重新发送验证码后再试。',
  verification_max_attempts: '验证码尝试次数过多，请稍后重新发送验证码。',
  form_password_length_too_short: '密码未达到账号服务当前的最低长度要求，请使用更长的密码后重试。至少 8 个字符只是本页的最低限制，不代表账号服务一定接受。',
  form_password_pwned: '这个密码出现在已知泄露记录中，请换一个未在其他网站使用的密码。',
  form_password_not_strong_enough: '密码强度不足，请使用更长、更难猜的密码。',
  form_password_validation_failed: '密码未通过账号服务的安全规则，请使用更长、更难猜且未泄露的密码。',
  form_password_size_in_bytes_exceeded: '密码超过账号服务允许的大小，请缩短后重试。',
  form_param_format_invalid: '输入格式不正确，请检查邮箱和姓名。',
  form_param_format_invalid__email_address: '邮箱格式不正确，请检查后重试。',
  form_param_nil: '注册资料尚未完整，请检查必填项。',
  form_param_value_invalid: '注册资料不符合账号服务要求，请检查后重试。',
  form_param_max_length_exceeded: '输入内容过长，请缩短后重试。',
  form_email_address_blocked: '账号服务不允许使用这个邮箱，请更换邮箱或联系维护者。',
  captcha_invalid: '安全验证未通过，请完成下方的人机验证后重试。',
  captcha_unavailable: '人机验证暂时无法加载，请检查网络和浏览器拦截设置后重试。',
  too_many_requests: '操作太频繁，请稍后再试；不要反复提交。',
  too_many_requests_email: '验证码发送过于频繁，请稍后再试。',
  not_allowed_access: '当前账号服务不允许此注册方式，请联系维护者。',
  signup_not_allowed: '当前账号服务未开放注册，请联系维护者。',
  session_exists: '已有登录会话，请返回登录入口确认账号状态，不要重复注册。',
  resource_not_found: '本次注册已失效，请返回注册入口重新开始。',
}

export function registrationError(error, fallback = '操作未完成，请检查网络后重试。若仍失败，请联系维护者。') {
  if (error instanceof CampusApiError) return error
  const providerCode = Array.isArray(error?.errors) ? error.errors.find((item) => Object.hasOwn(errorMessages, item?.code))?.code : null
  return new CampusApiError(providerCode ? errorMessages[providerCode] : fallback, 0, { code: 'REGISTRATION_FAILED' })
}
