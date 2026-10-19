import express from 'express';
import { optionalAuth, getClerkClient, trustedTeacherIds } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { campusError } from './errors.js';

const router = express.Router();
router.get('/status', optionalAuth, (req, res) => {
  const mode = req.localBypass?.allow ? 'local' : getClerkClient() ? 'clerk' : 'unavailable';
  res.json({ success: true, data: {
    mode, authenticated: Boolean(req.user),
    user: req.user ? { uid: req.user.uid, displayName: req.user.name || '', emailVerified: Boolean(req.user.emailVerified), isTeacher: Boolean(req.user.isTeacher) } : null,
    emailVerification: { provider: 'resend', available: false }, registrationAvailable: mode === 'clerk',
  } });
});
for (const route of ['/register', '/login', '/verify-email', '/resend-verification']) {
  router.post(route, (req, _res, next) => {
    // Capture the trusted template before Express unwinds the router on error.
    req.diagnosticRoute = `/api/campus/auth${route}`;
    next(campusError(503, 'EMAIL_AUTH_NOT_CONFIGURED', '邮箱注册与验证尚未启用。请使用已配置的正式登录入口，或返回本地体验。'));
  });
}

export const listTeachers = asyncHandler(async (_req, res) => {
  const client = getClerkClient();
  const teachers = [];
  if (client) {
    // Sequential lookups keep provider and memory pressure bounded.
    for (const uid of trustedTeacherIds()) {
      try {
        const user = await client.users.getUser(uid);
        const email = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId);
        if (email?.verification?.status === 'verified') teachers.push({ uid, displayName: user.fullName || user.username || '教师' });
      } catch {
        throw campusError(503, 'TEACHER_DIRECTORY_UNAVAILABLE', '教师名单暂时无法读取，请稍后重试。');
      }
    }
  }
  res.json({ success: true, data: teachers });
});
export default router;
