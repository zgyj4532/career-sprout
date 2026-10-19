import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeCoverage, matchStudent } from '../matching.js';
import { studentSchema, availabilitySchema, requirementsSchema } from '../schemas.js';
import { sanitizeResumeHtml, assertPdfLayout } from '../../services/pdfGenerator.js';
import { safeMetadata } from '../../utils/diagnostics.js';
import { requireTeacher } from '../../middleware/auth.js';

test('time coverage requires the complete interval and days, absence remains unknown', () => {
  const required = { startDate: '2026-10-01', endDate: '2026-12-31', daysPerWeek: 3 };
  assert.equal(timeCoverage(required, required), 'covered');
  assert.equal(timeCoverage({ ...required, startDate: '2026-10-02' }, required), 'conflict');
  assert.equal(timeCoverage({ ...required, endDate: '2026-12-30' }, required), 'conflict');
  assert.equal(timeCoverage({ ...required, daysPerWeek: 2 }, required), 'conflict');
  assert.equal(timeCoverage({ ...required, daysPerWeek: null }, required), 'unknown');
  assert.equal(timeCoverage({}, {}), 'unknown');
});
test('unknown skill is distinct from an explicit zero and normalization is shared', () => {
  const result = matchStudent({ skillAssessments: [{ name: ' SQL ', level: 0, evidence: '' }] }, { requirements: [{ name: 'sql', level: 1, required: true }, { name: 'Python', level: 1, required: true }] });
  assert.equal(result.missingSkills[0].currentLevel, 0);
  assert.equal(result.unknownSkills[0].currentLevel, null);
  assert.equal(result.coverage, 0);
});
test('private material rejects forged identity, duplicate skills and invalid calendar dates', () => {
  assert.equal(studentSchema.safeParse({ uid: 'other-user' }).success, false);
  assert.equal(availabilitySchema.safeParse({ startDate: '2026-02-30' }).success, false);
  assert.equal(availabilitySchema.safeParse({ startDate: '2026-12-01', endDate: '2026-10-01' }).success, false);
  assert.equal(requirementsSchema.safeParse([{ name: 'SQL', level: 1, required: true }, { name: ' sql ', level: 2, required: false }]).success, false);
});
test('PDF sanitizer removes executable and remote content while retaining Chinese text', () => {
  const html = sanitizeResumeHtml('<h1 onclick="steal()">学生</h1><script>secret()</script><img src="https://bad.invalid"><a href="file:///secret">经历</a><div style="background:url(https://bad.invalid)">课程</div>');
  assert.match(html, /学生/); assert.match(html, /经历/); assert.match(html, /课程/);
  assert.doesNotMatch(html, /onclick|script|img|href|style|secret|bad.invalid/);
});
test('actual PDF text beyond half of second page and third page are rejected', () => {
  assert.doesNotThrow(() => assertPdfLayout([[{ text: '一', bottom: 100 }], [{ text: '二', bottom: 500 }]]));
  assert.throws(() => assertPdfLayout([[], [{ text: '二', bottom: 400 }]]), { code: 'RESUME_TOO_LONG' });
  assert.throws(() => assertPdfLayout([[], [], []]), { code: 'RESUME_TOO_LONG' });
});
test('diagnostic metadata excludes source, credentials, errors and newline injection', () => {
  const metadata = safeMetadata({ requestId: 'safe-id-123', bytes: 12, body: 'PRIVATE', authorization: 'SECRET', error: { message: 'SECRET' }, route: '/api/jobs?token=SECRET', state: 'bad\nline' });
  assert.deepEqual(metadata, { requestId: 'safe-id-123', bytes: 12 });
});
test('teacher allowlist never elevates unverified or local identities', () => {
  const previous = process.env.CAMPUS_TEACHER_UIDS;
  process.env.CAMPUS_TEACHER_UIDS = 'user_teacher';
  try {
    for (const req of [{ user: { uid: 'user_teacher', isTeacher: true, emailVerified: false } }, { user: { uid: 'user_teacher', isTeacher: true, emailVerified: true }, localBypass: { allow: true } }, { user: { uid: 'user_other', isTeacher: true, emailVerified: true } }]) {
      let error; requireTeacher(req, {}, (value) => { error = value; }); assert.equal(error.statusCode, 403);
    }
  } finally { if (previous === undefined) delete process.env.CAMPUS_TEACHER_UIDS; else process.env.CAMPUS_TEACHER_UIDS = previous; }
});
