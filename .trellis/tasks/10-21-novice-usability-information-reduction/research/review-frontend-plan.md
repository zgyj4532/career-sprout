## Frontend plan review

**Overall correctness: incorrect.** Seven actionable issues remain. Review was static and read-only; no tests, builds, formatters, runtime checks, or browser validation were run.

**Artifact limitation:** I did not create `research/review-frontend-plan.md` because the reviewer’s higher-priority instructions prohibit file writes. The report below is ready for the parent to save there.

### 1. [P1] Preserve structured experience text when `fullText` is empty
**Severity:** bug · **Status:** open · **Confidence:** 0.99  
**Location:** `frontend/src/campus/pages/ProfilePage.jsx:80`

The new `row.fullText !== undefined` branch hides `context`, `actions`, and `result` even when `fullText` is an empty string. Ordinary manually entered experiences are persisted with `fullText: ''` by `backend/src/campus/models.js:5-7`, and `/me` returns these stored experiences unchanged (`backend/src/campus/growth.js:29-34`). Consequently, adding an experience through the three structured fields and saving it replaces those visible fields with an empty “完整经历” editor; the original facts remain stored but become inaccessible for normal editing. Choose the representation based on meaningful content or explicitly normalize the structured facts into the single editor without losing them. This violates R2/R4’s requirement not to remove essential content during r…

### 2. [P2] Select recent resumes using the actual modification timestamp
**Severity:** bug · **Status:** open · **Confidence:** 1.00  
**Location:** `frontend/src/campus/pages/InterviewPage.jsx:90`

The automatic “最近保存的简历” selection sorts by `updatedAt || createdAt`, while the resume model names its modification timestamp `lastModified` (`backend/src/models/Resume.model.js:97-100`). The two list requests also sort by nonexistent `updatedAt` (`InterviewPage.jsx:51,59`). With no previous preparation, an older resume edited most recently loses to a newer-created resume; with pagination, the correct resume may not even enter the candidate set. Use `lastModified` consistently in the server query and client selection. The existing regression fixture uses `updatedAt` rather than the real response shape (`pages/__tests__/InterviewPage.test.jsx:64-68`), so it does not cover this R7 failure.

### 3. [P2] Consume incoming preparation selections instead of replaying them on refresh
**Severity:** bug · **Status:** open · **Confidence:** 0.98  
**Location:** `frontend/src/campus/pages/InterviewPage.jsx:85-88`

After arriving through save-and-continue with `?resumeId=A&resumeRevision=…`, explicitly choosing resume B—or choosing the text-only option—updates local/server preparation but leaves the query parameters unchanged. Refresh then gives query resume A precedence over the newer saved choice, silently restoring A. The same precedence applies to `jobId` at line 73. Consume or replace the incoming selection parameters once accepted, so subsequent refreshes restore the user’s latest explicit selection and its applicable version guard. This breaks R7’s latest-choice priority and preparation continuity.

### 4. [P2] Match discovery answer validation to its server limit
**Severity:** bug · **Status:** open · **Confidence:** 1.00  
**Location:** `frontend/src/campus/pages/InterviewSessionPage.jsx:151`

Discovery uses the formal interview’s 20,000-character editor and submission threshold, but the actual discovery answer handler rejects any answer above 4,000 characters (`backend/src/routes/interview.js:300-303`). Pasting 4,001 characters therefore leaves “保存并继续聊” enabled, produces a rejected save, and exposes only the generic 422 message because `DISCOVERY_LIMIT` has no recovery mapping in `campus/api.js`. Apply the purpose-specific limit to the editor and save guard, and show an actionable shortening message while preserving typed/ASR text. This is an actual current frontend/backend contract mismatch, not a hypothetical backend integration defect.

### 5. [P2] Protect dirty work during browser-history navigation
**Severity:** bug · **Status:** open · **Confidence:** 0.99  
**Location:** `frontend/src/campus/hooks/useUnsavedWork.js:17-19`

The new guard observes document unload and anchor clicks only. Browser Back/Forward and keyboard history navigation within `BrowserRouter` trigger neither, so they unmount dirty resume/job/profile editors, unsaved interview answers, and edited discovery confirmation candidates without confirmation. In particular, the new discovery confirmation editor relies on this hook for its only navigation protection (`components/DiscoveryReport.jsx:20`). Integrate the warning with router transitions, not just DOM link clicks, while preserving acknowledged save-and-continue navigation. This leaves the R4 unsaved-work protection incomplete.

### 6. [P2] Flatten the nested per-answer feedback disclosure
**Severity:** bug · **Status:** open · **Confidence:** 1.00  
**Location:** `frontend/src/campus/components/InterviewFeedback.jsx:41`

`RoomReport` now encloses every answer and `FeedbackView` in a closed `<details>`, while `FeedbackView` contains another closed `<details>` at lines 21–26. Reading missing points or a reference answer therefore requires opening two nested disclosures. This is directly contrary to R2’s explicit “不嵌套折叠” requirement, rather than a cosmetic preference. Keep a single disclosure level for optional per-answer detail and preserve access to the concrete feedback within it.

### 7. [P2] Keep each history score’s basis visible beside the score
**Severity:** bug · **Status:** open · **Confidence:** 0.98  
**Location:** `frontend/src/campus/pages/HistoryPage.jsx:125`

History displays each numeric total immediately but hides its actual scoring basis and coverage inside a closed “本次评分范围” disclosure. Records with different available dimensions therefore appear together as directly comparable scores, with the same visible “有效维度规则” label; discovering the incompatible scopes requires expanding every record separately. The approved design specifically requires scoring basis to remain visible on result/history surfaces, and R10 requires scope-aware presentation. Keep a compact basis/coverage summary visible next to each score; detailed dimension rows may remain optional.

## Coverage and simplicity assessment

- **R1–R6:** Home genuinely removes the repeated five-step path and large portal cards. Optional tools generally remain mounted, and save uncertainty, publication scope, deletion confirmation, and teacher revocation remain reachable. Findings 1, 5, 6, and 7 are substantive protection/disclosure gaps.
- **R7–R9:** Preparation restoration, one parent-owned answer editor, append-only ASR adoption, canonical answer reconciliation, and separate generation recovery are implemented. Findings 2 and 3 affect preparation fidelity.
- **R10:** Campus reports consume canonical scoring rather than maintaining a second weighted formula. Legacy labels, genuine zero handling, discovery exclusion, and compatible-group selection are present. Finding 7 concerns visible interpretation.
- **R11–R13:** The exact alternative entry is present; discovery starts without uploaded or prefilled material, has explicit unscored-purpose copy, supports dynamic continuation and early ending. Finding 4 affects longer answers.
- **R14–R15:** Confirmation is editable, ordinary candidates do not require checkboxes, conflicts have explicit choices, skip performs no confirmation POST, frozen partial saves have a continuation path, and zero-answer reports do not request extraction/confirmation. Backend grounding and real-model quality are not established by this review.
- **R16:** Resume/job save operations retain operation IDs, reconcile uncertain outcomes, navigate with acknowledged resource versions, and reuse saved identities after continuation failure. Browser-history protection remains incomplete.
- **Simplicity:** No additional actionable generic-framework, duplicated weighted-scoring, or dead-alias finding. The capture/review separation and small save-operation helper serve concrete shared behavior. No cosmetic restyles or new abstractions are requested.

**Parent-owned evidence still required:** actual desktop/390px layout and keyboard focus, native disclosure/form-validation behavior, browser Back/Forward with dirty work, real MediaRecorder cancellation/late ASR, API persistence and conflict recovery, and real-model discovery grounding. Static review does not establish those acceptance results.

[Some lines truncated to 768 chars. Use agent://FrontendSimplicityPlan:raw:11-11 to read line 11 whole]