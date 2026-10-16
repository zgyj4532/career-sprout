const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isLoopbackHostname(hostname) {
  if (!hostname) return false;
  const host = String(hostname).trim().toLowerCase().replace(/^\[|\]$/g, '');
  return LOOPBACK_HOSTS.has(host);
}

export function bindHost(env = process.env) {
  return env.HOST || '127.0.0.1';
}

export function isProductionLike(env = process.env) {
  return env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
}

export function assertCampusStartup(env = process.env) {
  const errors = [];
  if (env.APP_PROFILE !== 'campus-local') {
    errors.push('APP_PROFILE must be campus-local');
  }
  if (isProductionLike(env)) {
    errors.push(`campus-local cannot start when NODE_ENV=${env.NODE_ENV}`);
  }
  if (!isLoopbackHostname(bindHost(env))) {
    errors.push(`HOST must be a loopback address, got ${bindHost(env)}`);
  }
  if (env.DEV_BYPASS_AUTH === 'true' && env.NODE_ENV !== 'development') {
    errors.push('DEV_BYPASS_AUTH is refused outside NODE_ENV=development');
  }
  if (env.DEV_BYPASS_AUTH === 'true' && !isLoopbackHostname(bindHost(env))) {
    errors.push('DEV_BYPASS_AUTH is refused unless HOST is loopback');
  }
  if (errors.length) {
    const error = new Error(errors.join('; '));
    error.code = 'CAMPUS_STARTUP_REFUSED';
    throw error;
  }
}

export function requestHostname(req) {
  const hostHeader = req?.headers?.host || '';
  return String(hostHeader).split(':')[0].trim().toLowerCase().replace(/^\[|\]$/g, '');
}

export function allowedFrontendOrigins(env = process.env) {
  const origins = new Set([
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ]);
  if (env.FRONTEND_URL) {
    try {
      const url = new URL(env.FRONTEND_URL);
      if (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        isLoopbackHostname(url.hostname)
      ) {
        origins.add(url.origin);
      }
    } catch {
      // Ignore a malformed FRONTEND_URL; startup still binds loopback.
    }
  }
  return origins;
}

export function localDevUser(env = process.env) {
  return {
    uid: env.DEV_USER_UID || 'campus-local-dev',
    email: env.DEV_USER_EMAIL || 'campus-dev@localhost',
    name: '本地开发身份',
    picture: null,
    emailVerified: false,
    isAdmin: false,
  };
}

export function evaluateLocalBypass(env = process.env, req = {}) {
  if (env.APP_PROFILE !== 'campus-local') {
    return { mode: 'legacy', allow: false };
  }
  if (env.CLERK_SECRET_KEY) {
    return { mode: 'campus', allow: false, reason: 'clerk-configured' };
  }
  if (env.NODE_ENV !== 'development' || env.DEV_BYPASS_AUTH !== 'true') {
    return { mode: 'campus', allow: false, reason: 'switch-off' };
  }
  if (!isLoopbackHostname(bindHost(env))) {
    return { mode: 'campus', allow: false, reason: 'bind-host' };
  }
  if (!isLoopbackHostname(requestHostname(req))) {
    return { mode: 'campus', allow: false, reason: 'request-host' };
  }
  const method = String(req.method || 'GET').toUpperCase();
  if (!SAFE_METHODS.has(method)) {
    const origin = req.headers?.origin || '';
    if (!allowedFrontendOrigins(env).has(origin)) {
      return { mode: 'campus', allow: false, reason: 'origin' };
    }
  }
  return { mode: 'campus', allow: true, user: localDevUser(env) };
}
