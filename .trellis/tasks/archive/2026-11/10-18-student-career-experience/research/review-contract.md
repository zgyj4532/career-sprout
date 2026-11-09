# Final review contract

Review only after both implementation owners publish summaries and parent completes dependency setup. No additional agent while implementers active; memory limits favor at most two read-only reviewers and no concurrent tests/build/browser. Required review slices: general correctness/security across actual new APIs + frontend state; independent simplicity/plan-alignment across module seams and approved requirements. Both include concrete evidence and actionable findings, not style-only preferences or unsupported speculation.

## Primary risk scenarios

1. Private CampusStudent data never exposed by public UserProfile lookup. Teacher role requires verified trusted UID, not profile/registration/local bypass. Grants scope every candidate and export; revocation and source/target revision changes invalidate share eligibility.
2. Campus auth status and Resend-unavailable routes work without DB dependency, no fake sent/logged-in state. Response headers/body carry same validated requestId; browser diagnostics never contain transcripts, emails or tokens. Provider exceptions cannot leak their input.
3. Startup and shared error changes do not regress legacy route payloads/ownership; no duplicate error abstraction. Disabled upstream mounts/workers remain disabled.
4. MediaRecorder truth based on onstart; double start, late permission, unmount, stop/cancel, track ended and ASR failure cannot leave hidden capture. Stop does not send interview answer. No retry duplication after lost response, no stale AI overwrite, no TTS cancel deadlock.
5. PDF renderer prevents HTML/script/network injection while keeping Chinese selectable content. A4 measured length includes pagination constraints; no silent truncation. Global single-flight and bounded wait/byte admission apply across concurrent clients and ZIP export. Aborted requests release resources.
6. Every approved user-visible workflow actually mounted, correct request/response shapes, errors don't wipe edits. Existing pages.jsx removed only after all route imports cut over; no dummy or unnecessary duplicate paths.
7. Brand uses exact formal/alternate text. Native button focus/pressed state, whole-sentence accessibility, reduced motion and size-stable layout. No auto carousel.
8. Existing user changes are not replaced wholesale; source attribution persists. Reserved Resend variables documented as reserved, not functional switches. New dependencies narrowly scoped and lock consistent.

## Output

Reviewer produces each finding with severity bug/suggestion/nit (and P1/P2 where helpful), exact file:line, observable scenario, fix direction and status open. No findings => explicit `No findings.` Include unverified runtime limits, not claims that tests passed. Parent integrates evidence and sends fixes to owning implementer, then re-review same concerns. No commits or source modifications by read-only reviewers.
