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
  const production = env.NODE_ENV === 'production';
  if (env.APP_PROFILE !== 'campus-local') {
    errors.push('APP_PROFILE must be campus-local');
  }
  if (production) {
    if (env.DEPLOYMENT_MODE !== 'container') {
      errors.push('DEPLOYMENT_MODE must be container in production');
    }
    if (env.HOST !== '0.0.0.0') {
      errors.push('production HOST must be 0.0.0.0 inside the private container network');
    }
    if (env.DEV_BYPASS_AUTH !== 'false') {
      errors.push('DEV_BYPASS_AUTH must be explicitly false in production');
    }
    if (!/^sk_live_[A-Za-z0-9_-]{8,}$/.test(env.CLERK_SECRET_KEY || '')) {
      errors.push('production requires a live CLERK_SECRET_KEY');
    }
    if (!/^pk_live_[A-Za-z0-9_-]{8,}$/.test(env.CLERK_PUBLISHABLE_KEY || '')) {
      errors.push('production requires a live CLERK_PUBLISHABLE_KEY');
    }
    try {
      const url = new URL(env.FRONTEND_URL);
      if (
        url.protocol !== 'https:' ||
        url.origin !== 'https://crayzamb.cloud' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !/^\/career-sprout\/?$/.test(url.pathname) ||
        env.FRONTEND_URL !== `${url.origin}${url.pathname}`
      ) {
        errors.push('production FRONTEND_URL must be the exact HTTPS https://crayzamb.cloud/career-sprout URL');
      }
    } catch {
      errors.push('production FRONTEND_URL must be a valid HTTPS /career-sprout URL');
    }
    if (!isDedicatedServiceUrl(env.MONGODB_URI, ['mongodb:'], ['mongo'], true, '/career_sprout')) {
      errors.push('production MONGODB_URI must target the authenticated dedicated career_sprout database');
    }
    if (!isDedicatedServiceUrl(env.REDIS_URL, ['redis:'], ['redis'], true, '/')) {
      errors.push('production REDIS_URL must target the authenticated dedicated redis service');
    }
  } else {
    if (isProductionLike(env)) {
      errors.push(`campus-local cannot start when NODE_ENV=${env.NODE_ENV}`);
    }
    if (!isLoopbackHostname(bindHost(env))) {
      errors.push(`HOST must be a loopback address, got ${bindHost(env)}`);
    }
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

function isDedicatedServiceUrl(value, protocols, serviceHosts, requireCredentials = false, requiredPath = null) {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol)
      && serviceHosts.includes(url.hostname)
      && (requiredPath === null || url.pathname === requiredPath)
      && (!requireCredentials || (Boolean(url.username) && Boolean(url.password)))
      && (!requireCredentials || (
        url.searchParams.size === 0
        || (url.protocol === 'mongodb:' && url.searchParams.size === 1 && url.searchParams.get('authSource') === 'career_sprout')
      ))
      && !url.hash;
  } catch {
    return false;
  }
}

export function requestHostname(req) {
  const hostHeader = req?.headers?.host || '';
  return String(hostHeader).split(':')[0].trim().toLowerCase().replace(/^\[|\]$/g, '');
}

export function allowedFrontendOrigins(env = process.env) {
  const origins = new Set(env.NODE_ENV === 'production' ? [] : [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ]);
  if (env.FRONTEND_URL) {
    try {
      const url = new URL(env.FRONTEND_URL);
      if (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        (isLoopbackHostname(url.hostname) || env.NODE_ENV === 'production')
      ) {
        origins.add(url.origin);
      }
    } catch {
      // Startup validation rejects malformed production origins.
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
  // Development loopback is the test runtime. A Clerk key saved for production
  // must not turn this runtime into the Clerk login form.
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
