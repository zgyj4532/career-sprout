import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeValidationDetails } from '../middleware/validate.js';

const context = new AsyncLocalStorage();
const defaultDirectory = fileURLToPath(new URL('../../../logs/', import.meta.url));
const textFields = new Set(['requestId', 'method', 'route', 'code', 'provider', 'state', 'stage']);
const numberFields = new Set(['status', 'durationMs', 'bytes', 'count', 'attempt', 'revision']);
export function safeMetadata(metadata = {}) {
  const result = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (numberFields.has(key) && Number.isFinite(value)) result[key] = value;
    if (textFields.has(key) && typeof value === 'string' && /^[a-zA-Z0-9_./:* -]{1,120}$/.test(value)) result[key] = value;
  }
  return result;
}

export function safeErrorMetadata(error) {
  const names = new Set(['Error', 'TypeError', 'SyntaxError', 'ValidationError', 'TimeoutError', 'ProtocolError', 'TargetCloseError', 'AbortError', 'MongoServerError', 'MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError', 'APIConnectionError', 'APIConnectionTimeoutError']);
  const codes = new Set(['EADDRINUSE', 'EACCES', 'ENOENT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'CAMPUS_STARTUP_REFUSED']);
  const cause = error?.cause;
  const code = codes.has(error?.code) ? error.code : codes.has(cause?.code) ? cause.code : error?.code === 18 ? 'DATABASE_AUTH_FAILED' : error?.code === 13 ? 'DATABASE_FORBIDDEN' : 'INTERNAL';
  return { state: names.has(error?.name) ? error.name : 'Error', code };
}

export function withDiagnosticContext(requestId, callback) {
  return context.run({ requestId }, callback);
}

// Synchronous, small writes avoid an unbounded pending-write queue during outages.
export function logEvent(event, metadata = {}) {
  const safeEvent = /^[a-z][a-z0-9_.]{0,79}$/.test(event) ? event : 'diagnostic.invalid_event';
  const line = JSON.stringify({ at: new Date().toISOString(), event: safeEvent, ...safeMetadata({ requestId: context.getStore()?.requestId, ...metadata }) });
  console.log(line);
  if (process.env.NODE_ENV === 'test') return;
  try {
    const directory = process.env.CAMPUS_LOG_DIR || defaultDirectory;
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const file = path.join(directory, process.env.CAMPUS_LOG_FILE === 'runtime' ? 'runtime.jsonl' : 'backend.jsonl');
    if (existsSync(file) && (statSync(file).size + Buffer.byteLength(line) > 2 * 1024 * 1024 || new Date(statSync(file).mtimeMs).toDateString() !== new Date().toDateString())) {
      if (existsSync(`${file}.3`)) unlinkSync(`${file}.3`);
      for (let index = 2; index >= 1; index--) if (existsSync(`${file}.${index}`)) renameSync(`${file}.${index}`, `${file}.${index + 1}`);
      renameSync(file, `${file}.1`);
    }
    appendFileSync(file, `${line}\n`, { mode: 0o600 });
  } catch {
    console.error('diagnostic.storage_unavailable');
  }
}

export function diagnosticMount(mount) {
  return (req, _res, next) => { req.diagnosticMount = mount; next(); };
}

export function diagnosticRoute(req) {
  if (req.diagnosticRoute) return req.diagnosticRoute;
  const mount = req.diagnosticMount || '';
  const template = typeof req.route?.path === 'string' ? req.route.path.replace(/(:[A-Za-z_][A-Za-z0-9_]*)\([^)]*\)/g, '$1') : '/:unmatched';
  return mount && template.startsWith(`${mount}/`) ? template : `${mount}${template}`;
}

export function requestDiagnostics(req, res, next) {
  req.campusRequest = true;
  const incoming = req.headers['x-request-id'];
  req.requestId = typeof incoming === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  const started = Date.now();
  // Normalize legacy direct error responses at the campus composition boundary.
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400) {
      const code = typeof body?.code === 'string' && /^[A-Z_0-9]{1,60}$/.test(body.code) ? body.code : 'REQUEST_FAILED';
      const message = body?.safeMessage || ({ 400: '请检查填写内容后重试。', 401: '请先登录后重试。', 403: '没有权限执行此操作。', 404: '内容不存在或不可访问。', 409: '内容已更新，请刷新后重试。', 413: '上传内容过大，请缩短后重试。', 429: '操作较频繁，请稍后重试。' }[res.statusCode] || '服务暂时不可用，请稍后重试。');
      return json({ success: false, error: message, message, code, requestId: req.requestId, ...(code === 'VALIDATION_FAILED' ? { details: safeValidationDetails(body?.details) } : {}) });
    }
    return json(body);
  };
  context.run({ requestId: req.requestId }, () => {
    logEvent('request.started', { method: req.method });
    res.once('finish', () => logEvent('request.completed', { requestId: req.requestId, method: req.method, route: diagnosticRoute(req), status: res.statusCode, durationMs: Date.now() - started }));
    next();
  });
}
