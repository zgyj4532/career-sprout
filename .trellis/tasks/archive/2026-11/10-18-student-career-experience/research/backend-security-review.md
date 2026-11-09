# Backend security/data review — round1

Reviewer BackendSecurityReview, static only. Parent triage checked current callers and prior baseline; no runtime claims.

## Open actionable findings

1. **bug/P1 — Job revision must invalidate targeted draft**, `campus/targets.js:38-42`: target snapshots source resume revision but only job ID/title/company. Job can change during generation or before approval/export, yielding a stale tailoring claim. Persist jobRevision=updatedAt, recheck after generation, approve/list/candidate/export; no unsupported legacy target silently approved. Status: open.
2. **bug/P1 — Preserve non-campus operational error semantics**, `middleware/globalErrorHandler.js:12-16`: handler is also mounted in index.js; previous ordinary ApiError message was returned, now always generic unless safeMessage. Scope campus privacy envelope to actual campus composition; retain existing safe non-campus operational error contract without restoring raw unexpected500 payloads. Reviewer claimed dropped err.details too, but prior global handler never returned err.details: that part is NOT a new regression and is excluded. Status: open.
3. **bug/P2 — Distinguish Clerk outage from logged out**, `middleware/auth.js:89-93`: valid signed-in session directory error becomes null/401. Keep access denied but return safe503 AUTH_UNAVAILABLE for actual backend dependency failure; invalid credentials remain401. This behavior existed before but is now part of approved clear authentication diagnostics scope; fix scoped. Status: open.
4. **bug/P2 — Stale candidate approval metadata**, `campus/sharing.js:75-78`: final live-grant check does not refresh approval/source/job revisions read earlier; response can claim approved after student changed target/source. Refresh projected eligible target/source state before returning or document safe consistency with current API contract; export must remain authoritative. Status: open.

## Rejected overreach

Reviewer suggested DELETE nonexistent grant must error because revoked:true allegedly false success. HTTP DELETE may intentionally be idempotent: after successful response the grant is absent, which is the user outcome. No requirement to return404. Validating syntax consistently is reasonable at the entry seam, but do not add lookup/existence race or change success solely for the review wording. Owner may choose `{revoked:<deletedCount>}` only if UI contract is updated; not required.

## Verification gap

Current isolated tests cover authorization helper, grant/source change and atomic answers, but real ZIP endpoint generation/revocation still needs actual smoke when memory allows. Formal Clerk multiaccount remains externally unverified. Do not treat testing helper alone as exported-archive proof.
