export class CampusApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'CampusApiError';
    this.status = status;
    this.body = body;
    this.requireApiKey = Boolean(body?.requireApiKey);
  }
}

export async function campusFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isForm && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (window.Clerk?.session) {
    const token = await window.Clerk.session.getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
    if (!response.ok) {
      throw new CampusApiError('PDF 导出失败', response.status, null);
    }
    return response.blob();
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new CampusApiError(
      data?.error || data?.message || `请求失败 (${response.status})`,
      response.status,
      data,
    );
    error.method = options.method || 'GET';
    error.path = data?.path || path;
    throw error;
  }
  return data || {};
}

export function errorText(error) {
  if (error?.requireApiKey) {
    return '没有可用的 AI 密钥。此功能未执行，也不会保存假结果。';
  }
  const where = [error?.method, error?.path].filter(Boolean).join(' ');
  const parts = [
    error?.message || '请求失败',
    error?.status ? `status=${error.status}` : '',
    error?.body?.code ? `code=${error.body.code}` : '',
    where ? `at=${where}` : '',
    error?.body?.requestId ? `requestId=${error.body.requestId}` : '',
  ].filter(Boolean);
  return parts.join(' | ');
}
