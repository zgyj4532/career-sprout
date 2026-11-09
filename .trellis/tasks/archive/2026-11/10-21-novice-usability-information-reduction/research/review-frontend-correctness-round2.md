## Re-review verdict: incorrect

**Original findings: 7 fixed; finding 1 remains partially open.** Its stale-token retry loop is addressed, but the replacement profile reconciliation introduces **2 evidence-backed P2 defects** below. **No new issues found in fixes 2–8.**

No tests, builds, lint, formatters, runtime checks, or file edits were performed.

### New finding A — [P2] Reconcile each target against its actual persisted education

**Severity:** bug · **Status:** open · **Confidence:** 0.99  
**Patch anchor:** `frontend/src/campus/pages/ProfilePage.jsx:52-54`  
**Related:** `frontend/src/campus/profileSave.js:6-7`; `ProfilePage.jsx:85-87`

The student’s canonical projection substitutes `canonical.profile.education` for the actual `canonical.student.importedEducation`. These are independently persisted fields: the profile route writes `UserProfile.education`, while `/api/campus/me` writes `CampusStudent.importedEducation` (`backend/src/routes/userProfile.js:79-90`; `backend/src/campus/growth.js:51-56`). Consequently, reconciliation can incorrectly declare the student step complete or overwrite its concurrent changes.

**Exact reproducer:**
1. Load matching profile/student education containing an old institution name.
2. Edit that institution in Profile and save.
3. Allow the profile PUT to commit, but fail the subsequent student PUT **before it commits**.
4. Let the recovery GET succeed.
5. Click save again.

The recovery projection reports the student education as the already-updated profile education. It therefore says both targets are confirmed; the retry computes `plan.student.changed === false`, skips the unfinished student write, and reports complete success while `CampusStudent.importedEducation` still contains the old value.

A related overwrite path is also present: if another writer changes only `student.importedEducation`, a local unrelated growth-material edit replaces that newer array with profile education without detecting a conflict.

**Correction:** Use each target’s actual persisted fields for baseline/current/outcome comparisons. Apply the desired education mirroring only when constructing the intended student update.

### New finding B — [P2] Rebase acknowledged fields before accepting further local edits

**Severity:** bug · **Status:** open · **Confidence:** 0.99  
**Patch anchor:** `frontend/src/campus/pages/ProfilePage.jsx:81-87`  
**Related:** `frontend/src/campus/profileSave.js:24-28`

After a partially successful or lost-response save, recovery updates only timestamps; `baseline.current` remains the original page-load baseline. Once inputs are enabled again, deliberately reverting a committed field to its original value is indistinguishable from an untouched field. `reconcileProfileFields` then skips the local value and adopts the committed canonical value, silently discarding the new edit.

**Exact reproducer:**
1. Load biography **A**.
2. Change it to **B**, also edit an interest, and save.
3. Let the profile write commit **B**, but lose its response; allow recovery to read **B** successfully.
4. After the editor unlocks, intentionally change the biography back to **A**.
5. Save again.

Because local biography **A** equals the unchanged original baseline **A**, reconciliation retains canonical **B** instead of submitting **A**. The success path replaces the editor with **B** and reports saved. This requires no concurrent writer.

**Correction:** Track the confirmed baseline for acknowledged fields/targets while preserving outstanding local edits, so edits made after recovery—including reverting to the originally loaded value—remain intentional changes.

## Status of all eight original findings

| # | Status | Current evidence |
|---|---|---|
| **1 — Profile lost-response/conflict recovery** | **Partially fixed; open** | Fresh reads, timestamp guards, explicit conflict confirmation, and unchanged-target skipping address the original stale-token loop (`ProfilePage.jsx:48-69`). New target-projection and post-recovery-edit defects above prevent closure. |
| **2 — Explicit unknown attendance** | **Fixed in static review** | `profileSave.js:3-4` always projects attendance to boolean or explicit null. Profile PUT includes that projection, so unchanged `studyStage` cannot trigger the backend’s omitted-attendance fallback. Regression covers an unrelated biography edit with a nonempty year. |
| **3 — Acknowledged save downgraded by refresh failure** | **Fixed in static review** | `saveOperation.js:17,24-26,33` clears uncertainty on every successful acknowledgement. Resume-list and job-gap refresh failures have separate catches (`ResumePage.jsx:111`; `JobsPage.jsx:90`). Regressions cover recovered writes followed by failed refresh and resume continuation without another write. |
| **4 — Discovery confirmation acknowledgement discarded** | **Fixed in static review** | `DiscoveryReport.jsx:45-46` applies the POST’s canonical response directly through `applyConfirmation`; no redundant success-path GET. Completed/cache-pending acknowledgement regression added. |
| **5 — Transcription retry bypasses admission** | **Fixed in static review** | `VoiceInput.jsx:19` checks parent `disabled` at the shared transcription entry point; line 48 removes retry while disabled/busy. Regression checks retry suppression and restoration. |
| **6 — Adaptive progress mixes incompatible scores** | **Fixed in static review** | `interviewDifficulty.js:12-27,82` retains legacy progress separately and updates aggregates by comparison key. `InterviewPrep.jsx:996-1001` passes the complete result and derives promotion from its compatible group. Caller search found no remaining numeric-only invocation. |
| **7 — Unscored formal sessions disappear from Analytics** | **Fixed in static review** | `Analytics.jsx:74-99` separates all formal sessions from the scored comparable subset. Counts/recent sessions retain unscored records; averages, trends, and insights use comparable scores only. Regressions cover unscored-only and mixed records. |
| **8 — Per-answer cards fabricate zeros** | **Fixed in static review** | `QuestionAnalysisCard.jsx:9-11,14,21,28,50,63-71` handles observed dimensions, true zero, all-missing outcomes, and coverage. Both legacy consumers use this shared implementation. Three focused regressions cover the reported examples. |

Also traced the new `discovery.uncertainties` value from `backend/src/services/discoveryService.js:97-98` to the visible consumer at `DiscoveryReport.jsx:79`; it is not silently discarded.

### Evidence limits

The added profile tests cover lost responses with subsequent **unchanged** input and conflicts in `interests`; they do not cover a failed education mirror write or a user reverting a committed field after recovery. The parent’s currently running frontend suite is not evidence available to this review, and I launched no checks. Report-file persistence remains with Main under this reviewer’s read-only/tool restrictions.