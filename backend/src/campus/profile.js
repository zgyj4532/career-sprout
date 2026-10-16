export const CAMPUS_MOUNTS = [
  '/api/resumes',
  '/api/interview',
  '/api/enhance',
  '/api/user-profiles',
];

export const DISABLED_PREFIXES = [
  '/api/payments',
  '/api/community',
  '/api/fellowship',
  '/api/portfolio',
  '/api/outreach',
  '/api/job-alerts',
  '/api/fetchjobs',
  '/api/email-tracking',
  '/api/admin',
  '/api/cover-letter',
  '/api/salary',
  '/api/recruiter',
  '/api/bugs',
  '/api/analyzer',
  '/api/readme-generator',
  '/api/project-visualizer',
  '/api/collaboration',
  '/api/roast',
  '/api/webhooks',
  '/api/search',
  '/api/gdpr',
  '/api/job-tracker',
  '/api/auth/2fa',
];

const BLOCKED_ENHANCE = new Set([
  '/api/enhance/generate-email',
  '/api/enhance/optimize-linkedin',
  '/api/enhance/career-trajectory',
]);

export function campusDisabledReason(urlPath) {
  const path = String(urlPath || '').split('?')[0];
  if (DISABLED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return '此功能在校园本地版未开放';
  }
  if (/^\/api\/interview\/[^/]+\/run-code$/.test(path)) {
    return '编程题在校园本地版未开放';
  }
  if (path.startsWith('/api/resumes/import/')) {
    return '外部档案导入在校园本地版未开放';
  }
  if (BLOCKED_ENHANCE.has(path)) {
    return '此功能在校园本地版未开放';
  }
  return null;
}
