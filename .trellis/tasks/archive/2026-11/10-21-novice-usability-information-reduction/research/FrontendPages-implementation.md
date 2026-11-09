# Frontend pages implementation

## Boundary

Reduce repeated default content in Home/Profile/Resume/Jobs and supporting import/sharing/target tools while keeping active editors mounted and risks visible. Home prioritizes actual unfinished work or resume import, with the exact approved discovery alternative. Resume/job downstream navigation must use the acknowledged save and recover uncertain outcomes by operation ID. Profile/material projections retain provenance and distinguish ideas from accomplishments. Shared ownership: this agent owns CampusApp/nav/campus.css/api/material; FrontendInterview owns interview/history/voice; BackendWorkflow owns persistence contracts. No global store, new design system, provider, publication side effect, or unrelated cleanup.

## Verification

No tests, lint, build, formatter, or browser validation run by this agent; parent owns the integrated pass. Implementation details and required smoke scenarios are recorded below after edits.

## Implemented boundaries

- Home removes the repeated five-step path and large portal cards. The primary route resumes unfinished interview/discovery, then unfinished import, then a saved resume; a true empty account offers import. Progress failures remain failures. The approved interest entry routes to `/discovery`.
- CampusApp integrates the purpose-aware discovery entry without changing the configuration-time app boundary. Existing four core navigation routes remain intact; `nav.js` needs no change.
- Profile keeps one original experience representation rather than simultaneously rendering full text plus duplicated context/action/result. Concise variants, self-assessment and availability remain mounted optional controls. State/source conversation/question IDs/date precision survive saves; ideas are not achievements. Both profile/student writes carry comparison tokens and partial-save warnings remain visible.
- Resume centers the editor and save/continue, with import, voice review, targeting and per-record management secondary. `VoiceReview` preserves explicit adoption. Saved resource identity/revision, unknown-save recovery and export limitations remain visible. The latest acknowledged version—not a second speculative GET—feeds continuation.
- Jobs saves dirty edits before continuation, sends expectedUpdatedAt, retains the frozen save operation across unknown outcomes, and reuses saved identity after return failure. Screenshot-derived jobs remain private. Browse and optional requirements disclose without discarding active state; publication scope remains outside disclosure.
- Import tools keep file/review components mounted, preserve confirmation/uncertainty/destination/source controls, and support direct unfinished-import restoration. Education source text no longer repeats by default. Target editor dirty/stale/permission state and teacher revocation remain visible while optional editing/grant creation disclose.
- `saveOperation.js` implements operation-ID recovery for resumes/jobs. `useUnsavedWork` guards document unload and link navigation; it is shared with interview routes. `materialText` excludes ideas by default and accepts explicit labelled idea inclusion for practice context.
- Added behavior regressions for first/returning/error Home, profile provenance/token roundtrip, material idea projection, unknown-save reconciliation/conflicts, resume/job acknowledged continuation and saved-but-navigation-failed reuse, and non-destructive import disclosure. Updated VoiceReview mock and management-disclosure interaction in existing tests.

## Required integrated smoke scenarios

1. Fresh account: import primary; exact interest entry starts discovery without uploaded material. Existing unfinished session/import resumes actual identity. Failed progress read does not display first-visit success.
2. Discovery confirms an idea, explicit unknown university state and major; reload Profile, edit another field, save and reload. Preserve source IDs/date text/state; no idea appears as resume achievement. Formal practice may include explicitly labelled ideas.
3. Edit/create resume and job, save-and-continue; destination receives acknowledged version. Induce validation/CAS failure (text retained), lost save response (owned operation read), failed recovery read (no blind write), explicit SAVE_NOT_FOUND (same operation replay), and navigation/preparation failure after successful save (no duplicate create).
4. Open/close voice/import/target tools with unsaved edits and pending review. Inputs remain mounted and unchanged; errors, unknown-save controls, source uncertainty, private/public scope, grants/revoke and target approval remain visible. Cancel route-exit prompt retains page.
5. Desktop/390px keyboard traversal and screenshots: one dominant current action, no repeated five-step/portal dashboard, no obscured focus/save controls, no reduced font-size substitute. Test real imported source confirmation and screenshot detour/return.

## Verification status

NOT_RUN by this agent: tests, lint, build, browser/model/API smoke. Parent must execute the approved integrated commands and scenarios after backend/interview contracts land. No student, physical-device, deployed-host or real-model acceptance is claimed. ICP/deployment remains a separate external gate.

### Contract alignment notes

- Backend `SAVE_PENDING` is an uncertain/admitted save, not a confirmed failure; retain the operation and recover. `OPERATION_CONFLICT` likewise cannot authorize a fresh create. A concurrent version conflict is a confirmed non-write and retains editable input.
- Job continuation carries acknowledged `updatedAt` as `jobRevision`; resume continuation carries acknowledged `revision`. Interview owner consumes both. Resume target selection rejects a mismatched incoming jobRevision and asks for reselection.
- Existing `SectionPolish` already keeps suggestion/error/adoption explicit and has no destructive disclosure, so it was intentionally unchanged. Core nav configuration is unchanged because compact Home uses its existing labels/paths. Import/source uncertainty and target permissions were not hidden to achieve density reduction.
- No runtime process was started/stopped, no git commit/push performed, and no build/test/lint/formatter executed. Parent-owned WSL/runtime failures are not reclassified as application proof.

### Parent review clarification

`backend/src/campus/imports.js` list and owned-read filters explicitly exclude `purpose:'job'`, while `jobImages.js` lists only job imports. Home resume-import recovery therefore uses the correct resource route. Resume list pagination defaults to creation order, so Home now explicitly requests `sort=-lastModified&limit=1` to resume the most recently saved record. Added a behavior regression for that request/selected identity; not run by this agent.

### Frontend simplicity review fixes

- Empty persisted `fullText` no longer hides meaningful context/actions/result. Added a manual-experience save/reload/editability regression using the actual empty-fullText model shape.
- CampusApp now uses the existing React Router data-router API and a single shared `useBlocker`. The provider aggregates multiple dirty editors, including interview answers and discovery confirmation, and guards Back/Forward plus ordinary internal transitions without custom history manipulation. Acknowledged resume/job saves synchronously release only their own guard before continuation. Standalone component tests keep the link/unload hook fallback.
- Added both POP directions with decline/accept coverage and acknowledged-navigation regression. Added actionable `DISCOVERY_LIMIT` correction copy. These regressions remain NOT_RUN pending parent integrated verification.

### Frontend correctness review fixes 1–3

- Profile saves now reconcile against a fresh uncached canonical read before each attempt, using loaded/local/canonical field comparisons. Already committed targets are skipped, unrelated concurrent updates are retained, and overlapping edits require explicit confirmation. After a lost response a canonical read updates comparison timestamps without replacing local input; unavailable recovery remains honestly unknown. Added separate lost-first-write/lost-second-write and concurrent-conflict regressions.
- Attendance is always submitted explicitly as boolean or null in profile payloads, preventing an unchanged studyStage from undoing an explicit unknown choice. Added the reported year-plus-biography regression.
- Material-save acknowledgement clears operation uncertainty on direct/recovery success. Resume list and job gap refresh errors have their own handling and cannot re-lock an acknowledged save or allocate another recovery operation. Added recovered-save-then-refresh-failure regressions and assertion that subsequent resume continuation performs no extra write.
- All new checks remain NOT_RUN by this agent. Parent owns integrated execution.

### Profile reconciliation re-review A/B

- Student baseline/canonical/outcome projections now use only CampusStudent.importedEducation, never substitute UserProfile.education. The education editor already updates both intended local targets; unrelated saves no longer invent a mirror write. Added profile-committed/student-not-committed education recovery and concurrent student-only education regressions.
- Every acknowledged write and successful lost-response reconciliation rebases confirmed fields whose canonical value equals the retained local intent. Outstanding/unconfirmed fields retain their original comparison baseline. A subsequent intentional B-to-original-A edit is therefore saved rather than misclassified as untouched. Added the exact lost-biography-response, recovery, revert-to-original and retry regression.
- No checks run by this agent.

### Unavailable profile recovery follow-up

Profile now retains the exact desired/plan snapshot when a write fails and canonical recovery is unavailable. Inputs/import/discard remain locked behind an explicit read-only recovery action; repeated recovery failures cannot unlock editing or submit another write. Successful recovery rebases confirmed fields before unlocking, preserving later intentional edits and unfinished growth changes. Added the exact lost write + failed immediate/repeated GET + later recovery + B-to-A edit regression. NOT_RUN by this agent.

### Observed mobile empty recovery refinement

Following parent's actual 390px observation, empty import history now starts closed instead of exposing an inactive refresh control. Nonempty history still opens when no draft is selected; active draft/recovery state is unchanged and stays mounted. Extended the settled-load disclosure regression to cover the empty default and explicit recovery access. No checks run by this agent.
