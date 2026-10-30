import { safeValidationDetails } from './validation'

const events = []
const MAX_EVENTS = 200
const safeCode = (value) => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(value) ? value : undefined
const routes = /^\/api\/(?:campus(?:\/(?:auth|me|jobs|teachers|teacher|resumes|imports))?|resumes|interview|user-profiles)(?:\/|$)/

function routeTemplate(path) {
  const pathname = path.split('?')[0]
  if (!routes.test(pathname)) return '/api/other'
  const literals = new Set(['api', 'campus', 'auth', 'status', 'register', 'login', 'verify-email', 'resend-verification', 'me', 'jobs', 'teachers', 'teacher', 'resumes', 'imports', 'interview', 'user-profiles', 'analyze', 'gap', 'polish', 'target', 'targets', 'approve', 'sharing', 'candidates', 'export', 'download', 'start', 'answer', 'complete', 'transcribe', 'history', 'continue', 'confirm', 'cache'])
  return pathname.split('/').map((part) => !part || literals.has(part) ? part : ':id').join('/')
}

export function logClientEvent(event, metadata = {}) {
  if (!safeCode(event)) return
  const row = { timestamp: new Date().toISOString(), event }
  for (const key of ['requestId', 'code', 'state', 'method']) {
    const value = safeCode(metadata[key])
    if (value) row[key] = value
  }
  for (const key of ['status', 'durationMs', 'bytes', 'attempt']) {
    if (Number.isFinite(metadata[key])) row[key] = Math.max(0, Math.round(metadata[key]))
  }
  // Only the HTTP boundary supplies a route; never accept arbitrary personal metadata.
  if (typeof metadata.route === 'string' && routes.test(metadata.route)) row.route = routeTemplate(metadata.route)
  events.push(row)
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = Array.from(filename, (character) => character.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(character) ? '_' : character).join('')
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadDiagnostics() {
  downloadBlob(new Blob([JSON.stringify({ product: 'CareerSprout', events }, null, 2)], { type: 'application/json' }), 'careersprout-diagnostics.json')
}

export class CampusApiError extends Error {
  constructor(message, status = 0, details = {}) {
    super(message)
    this.name = 'CampusApiError'
    this.status = status
    this.code = safeCode(details.code) || 'REQUEST_FAILED'
    this.requestId = safeCode(details.requestId)
    this.method = details.method
    this.path = details.path
    this.requireApiKey = Boolean(details.requireApiKey)
    this.details = this.code === 'VALIDATION_FAILED' ? safeValidationDetails(details.details) : []
  }
}

const RECOVERY_MESSAGES = {
  VALIDATION_FAILED: '有些填写内容需要调整，请按下面的提示修改；输入仍保留。',
  DISCOVERY_LIMIT: '交流回答最多 4000 字，请缩短后再保存；现有文字仍保留，不会自动截断。',
  PROFILE_CHANGED: '个人资料已在其他页面更新。当前编辑仍保留，请核对最新资料后再保存。',
  PROFILE_CONFLICT: '个人资料有新的修改，请核对冲突并明确选择；当前内容仍保留。',
  PROFILE_CONFIRMATION_PENDING: '资料确认仍在处理中，请先检查保存进度，不要重复添加。',
  GENERATION_PENDING: '内容正在生成，请检查当前进度，不必重复提交已保存回答。',
  GENERATION_FAILED: '本次生成未完成，已保存回答仍保留，可以重试生成。',
  JOB_CHANGED: '岗位已在其他页面更新，当前编辑仍保留；请核对最新版本后再保存。',
  OPERATION_PENDING: '保存仍在处理中，请检查保存结果，不要重复创建。',
  SAVE_PENDING: '保存仍在处理中，请检查保存结果，不要重复创建。',
  SAVE_UNKNOWN: '保存结果尚未确认，编辑仍保留；请先检查这次保存结果。',
  MATERIAL_DELETED: '这次保存的材料后来已被删除，不会通过重试重新创建；当前编辑仍保留。',
  CONFIRMATION_PENDING: '资料确认正在处理中，请检查保存进度，不要重复添加。',
  CONFIRMATION_FROZEN: '这次确认已开始保存，请先恢复原确认结果，不能替换正在保存的内容。',
  PROFILE_CAPACITY: '个人资料已达到容量上限；当前确认内容仍保留，请先整理已有资料。',
  OPERATION_CONFLICT: '这次保存操作与已记录的内容不一致。当前编辑仍保留，请先检查保存结果。',
  SAVE_NOT_FOUND: '尚未找到这次保存的确认结果。',
  ASR_SILENCE: '没有检测到足够的语音，请靠近麦克风重新录音，或改用文字。',
  ASR_EMPTY_AUDIO: '录音为空，请重新录音，或改用文字。',
  ASR_EMPTY: '转写服务未识别到文字，请重新录音，或手动输入回答。',
  ASR_TOO_LONG: '录音超过三分钟或解码上限，请缩短后重新录音，或改用文字。',
  ASR_TOO_LARGE: '录音文件过大，请缩短后重新录音，或改用文字。',
  ASR_INVALID_AUDIO: '录音格式无效，请重新录音，或改用文字。',
  ASR_CONVERT: '录音格式转换未完成，请重新录音，或改用文字。',
  ASR_BUSY: '语音服务正在处理另一段录音，请稍后重试转写；你的录音与文字仍保留。',
  ASR_UPSTREAM: '语音服务暂未返回可用结果，请稍后重试转写，或改用文字。',
  PDF_BUSY: '已有 PDF 正在生成，请稍后重试下载；已保存的简历不会丢失。',
  REVISION_CONFLICT: '简历已在其他页面更新。正文没有写回标题，请刷新后再保存。',
  RESUME_DELETING: '这份简历正在删除，不能新建关联内容。',
  RESUME_TOO_LONG: '简历超过一页半 A4 的可打印篇幅，请精简后保存并重新导出；内容未被截断。',
  PDF_COMPRESSION_UNAVAILABLE: 'AI 压缩暂时不可用或结果无法核实，原文未更改；请重试或手动精简。',
  PDF_COMPRESSION_UNGROUNDED: '压缩结果无法可靠核实，原文未更改；请手动精简后重试。',
  PDF_COMPRESSION_TIMEOUT: 'AI 压缩超时，原文未更改；请稍后重试。',
  PDF_COMPRESSION_UNSPLITTABLE: '无法安全按完整段落压缩，原文未更改；请手动分段精简。',
  EXPORT_BUSY: '已有批量导出正在进行，请稍后重试下载。',
}

export async function campusFetch(path, options = {}) {
  const requestId = crypto.randomUUID()
  const method = options.method || 'GET'
  const route = routeTemplate(path)
  const started = performance.now()
  const headers = new Headers(options.headers || {})
  headers.set('X-Request-ID', requestId)
  if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  logClientEvent('request.started', { requestId, method, route })
  let responseId = requestId
  let status = 0
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  if (options.signal?.aborted) controller.abort()
  else options.signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, /\/(?:export|download)$/.test(path) ? 300000 : 120000)
  try {
    if (window.Clerk?.session) {
      const token = await window.Clerk.session.getToken()
      if (token) headers.set('Authorization', `Bearer ${token}`)
    }
    const response = await fetch(path, { ...options, signal: controller.signal, headers })
    status = response.status
    responseId = safeCode(response.headers.get('X-Request-ID')) || requestId
    const contentType = response.headers.get('content-type') || ''
    if (response.ok && (options.responseType === 'blob' || /application\/(pdf|zip|x-zip-compressed|octet-stream|vnd\.openxmlformats-officedocument)/i.test(contentType) || /^image\//i.test(contentType))) {
      const blob = await response.blob()
      if (options.includeExportManifest) {
        let manifest
        try { manifest = JSON.parse(atob(response.headers.get('X-Export-Manifest') || '')) } catch { manifest = null }
        return { blob, manifest }
      }
      return blob
    }
    if (response.status === 204) return null
    let payload
    try { payload = await response.json() } catch (cause) {
      if (controller.signal.aborted) throw cause
      throw new CampusApiError('服务器返回了无法读取的结果，请重试。', status, { code: 'INVALID_RESPONSE' })
    }
    if (!response.ok || payload?.success === false) {
      // Provider text can contain private inputs; only campus routes own the safe Chinese envelope.
      const knownMessage = Object.hasOwn(RECOVERY_MESSAGES, payload?.code) ? RECOVERY_MESSAGES[payload.code] : null
      const safeMessage = knownMessage || (path.startsWith('/api/campus/') && typeof payload?.message === 'string' && payload.message.length <= 240
        ? payload.message : status === 401 ? '请先登录，再继续操作。' : status === 403 ? '当前账号没有这项操作的权限。' : status === 422 ? '内容暂时无法处理，请检查输入后重试；原有内容仍保留。' : '操作未完成，输入仍保留，请稍后重试。')
      throw new CampusApiError(safeMessage, status, { code: payload?.code, requireApiKey: payload?.requireApiKey, details: payload?.details })
    }
    if (!payload || typeof payload !== 'object') throw new CampusApiError('服务器返回格式不正确，请重试。', status, { code: 'INVALID_RESPONSE' })
    return payload
  } catch (cause) {
    const error = cause instanceof CampusApiError ? cause : new CampusApiError(timedOut ? '等待服务器超时，输入已保留。请检查已保存进度后重试。' : cause?.name === 'AbortError' ? '操作已取消。' : '未能取得服务器结果，请检查连接后重试。', status, { code: timedOut ? 'REQUEST_TIMEOUT' : cause?.name === 'AbortError' ? 'ABORTED' : 'NETWORK_ERROR' })
    Object.assign(error, { requestId: responseId, method, path: route })
    logClientEvent('request.failed', { requestId: responseId, method, route, status, code: error.code })
    throw error
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
    logClientEvent('request.completed', { requestId: responseId, method, route, status, durationMs: performance.now() - started })
  }
}

export function errorText(error) {
  if (error?.requireApiKey) return 'AI 服务尚不可用，本次未生成结果。你的输入仍然保留。'
  return error instanceof CampusApiError ? error.message : '操作未完成，请重试；你的输入不会被清空。'
}

export async function campusData(path, options) {
  return (await campusFetch(`/api/campus${path}`, options))?.data
}

export function resumeRows(payload) {
  const rows = payload.data?.data || payload.data
  return Array.isArray(rows) ? rows : []
}
