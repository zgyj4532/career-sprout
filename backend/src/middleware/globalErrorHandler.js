import { randomUUID } from 'node:crypto';
import { logEvent } from '../utils/diagnostics.js';

export const globalErrorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err?.name === 'CastError' || err?.name === 'ValidationError' ? 400
    : err?.code === 'LIMIT_FILE_SIZE' ? 413
      : Number.isInteger(err?.statusCode || err?.status) && (err.statusCode || err.status) >= 400 && (err.statusCode || err.status) <= 599 ? (err.statusCode || err.status) : 500;
  const candidate = err?.code || err?.details?.code;
  const code = typeof candidate === 'string' && /^[A-Z_0-9]{1,60}$/.test(candidate) ? candidate : status >= 500 ? 'INTERNAL' : 'REQUEST_FAILED';
  const requestId = req.requestId || randomUUID();
  const message = err?.safeMessage || (!req.campusRequest && err?.isOperational && status < 500 ? err.message : null) || ({ 400: '请检查填写内容后重试。', 401: '请先登录后重试。', 403: '没有权限执行此操作。', 404: '内容不存在或不可访问。', 409: '内容已更新，请刷新后重试。', 413: '上传内容过大，请缩短后重试。', 429: '操作较频繁，请稍后重试。' }[status] || '服务暂时不可用，请稍后重试。');
  logEvent('request.failed', { requestId, status, code });
  res.setHeader('X-Request-ID', requestId);
  res.status(status).json({ success: false, error: message, message, safeMessage: message, code, requestId });
};

export const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
