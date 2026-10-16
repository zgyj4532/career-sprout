import { randomUUID } from 'node:crypto';

function requestId(req) {
  const header = req?.headers?.['x-request-id'];
  return typeof header === 'string' && header.trim() ? header.trim().slice(0, 80) : randomUUID();
}

function safePath(req) {
  return String(req?.originalUrl || req?.url || req?.path || '').slice(0, 300);
}

export const globalErrorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const statusCode = err?.statusCode || 500;
  const message = err?.message || 'Something went wrong';
  const code = err?.code || err?.details?.code || (statusCode >= 500 ? 'INTERNAL' : 'REQUEST_FAILED');
  const id = requestId(req);
  const method = req?.method || '';
  const path = safePath(req);
  const log = {
    at: new Date().toISOString(),
    requestId: id,
    method,
    path,
    statusCode,
    code,
    name: err?.name || 'Error',
    message,
  };
  if (statusCode >= 500 && err?.stack) log.stack = err.stack;
  console.error(`[api-error] ${JSON.stringify(log)}`);

  res.status(statusCode).json({
    success: false,
    message,
    error: message,
    code,
    requestId: id,
    method,
    path,
    ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 && err?.stack
      ? { stack: err.stack }
      : {}),
  });
};

export const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
