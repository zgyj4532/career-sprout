import { clerkMiddleware, createClerkClient } from '@clerk/express';
import { ApiError } from './errorHandler.js';
import { evaluateLocalBypass, localDevUser } from '../config/localDevIdentity.js';

let clerkClient = null;
let clerkClientSecret = '';

function getClerkClient() {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return null;
  if (!clerkClient || clerkClientSecret !== secret) {
    clerkClient = createClerkClient({ secretKey: secret });
    clerkClientSecret = secret;
  }
  return clerkClient;
}

function legacyBypassEnabled() {
  return process.env.APP_PROFILE !== 'campus-local'
    && process.env.NODE_ENV === 'development'
    && process.env.DEV_BYPASS_AUTH === 'true';
}

function legacyDevUser() {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const devEmail = (process.env.DEV_USER_EMAIL || 'dev@example.com').toLowerCase();
  return {
    uid: process.env.DEV_USER_UID || 'dev-user-001',
    email: process.env.DEV_USER_EMAIL || 'dev@example.com',
    name: 'Local Dev User',
    picture: null,
    emailVerified: true,
    isAdmin: adminEmails.includes(devEmail),
  };
}

function clerkOrBypass(req, res, next) {
  if (process.env.APP_PROFILE === 'campus-local') {
    req.localBypass = evaluateLocalBypass(process.env, req);
    if (req.localBypass.allow || !process.env.CLERK_SECRET_KEY) return next();
    return clerkMiddleware()(req, res, next);
  }
  if (legacyBypassEnabled() || !process.env.CLERK_SECRET_KEY) return next();
  return clerkMiddleware()(req, res, next);
}

const attachUserToReq = async (req, res, next) => {
  try {
    if (process.env.APP_PROFILE === 'campus-local') {
      if (req.localBypass?.allow) {
        req.user = localDevUser(process.env);
        return next();
      }
    } else if (legacyBypassEnabled()) {
      req.user = legacyDevUser();
      return next();
    }

    const client = getClerkClient();
    if (!req.auth?.userId || !client) {
      req.user = null;
      return next();
    }

    const user = await client.users.getUser(req.auth.userId);
    const email = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId)?.emailAddress
      || user.emailAddresses[0]?.emailAddress;
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    req.user = {
      uid: user.id,
      email,
      name: user.fullName || user.username || email?.split('@')[0],
      picture: user.imageUrl,
      emailVerified: true,
      isAdmin: adminEmails.includes(email?.toLowerCase()),
    };
    next();
  } catch {
    req.user = null;
    next();
  }
};

const enforceAuth = (req, res, next) => {
  if (process.env.APP_PROFILE === 'campus-local') {
    if (req.localBypass?.allow) return next();
    if (!req.user) return next(new ApiError(401, 'Unauthorized'));
    return next();
  }
  if (legacyBypassEnabled()) return next();
  if (!req.user) return next(new ApiError(401, 'Unauthorized'));
  next();
};

export const verifyToken = [
  clerkOrBypass,
  attachUserToReq,
  enforceAuth,
];

export const optionalAuth = [
  clerkOrBypass,
  attachUserToReq,
];

export const adminOnly = (req, _res, next) => {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!req.user || !adminEmails.includes(req.user.email?.toLowerCase())) {
    return next(new ApiError(403, 'Admin access required'));
  }
  next();
};
