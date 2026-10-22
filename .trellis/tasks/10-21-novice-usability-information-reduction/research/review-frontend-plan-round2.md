## Re-review result

**Overall correctness: incorrect — one new P2 regression remains.** All seven original findings are addressed in the inspected code, but finding 3’s fix introduces a late-response navigation race. No tests, builds, runtime checks, browser actions, or file edits were performed.

### New finding: [P2] Prevent settled preparation saves from navigating after departure

**Severity:** bug · **Status:** open · **Confidence:** 0.99  
**Location:** `frontend/src/campus/pages/InterviewPage.jsx:114`

The autosave fulfillment callback now calls `consumeSelections()` without checking whether this preparation page is still active. Reproduction from the code: enter through `/interview?resumeId=A&resumeRevision=…`, let the 500 ms autosave request begin, navigate to another page while it is pending, then let that request succeed. Cleanup clears only the timer and sets `active.current = false`; it does not invalidate the already-running request’s fulfillment callback. That callback retains the original search parameters and calls `setSearch`, which navigates back to the preparation route, unexpectedly interrupting the user’s destination. The installed React Router implementation confirms `setSearchParams` closes over its render’s search parameters and navigatio…

## Original findings: fixed/open evidence

| # | Status | Evidence |
|---|---|---|
| **1 — Empty `fullText` hides structured experiences** | **Fixed in static review** | `ProfilePage.jsx:80` now falls back to editable context/actions/result when `fullText` has no meaningful text and structured facts exist. `ProfilePage.test.jsx:115-133` adds save/reload coverage using the actual `fullText: ''` shape. |
| **2 — Wrong recent-resume timestamp** | **Fixed in static review** | `InterviewPage.jsx:61,69,100` consistently uses `lastModified` for list ordering and recent selection. The revised fixture contrasts older-created/recently-saved against newer-created resumes (`InterviewPage.test.jsx:64-70`). |
| **3 — Incoming query selection overrides later choices on refresh** | **Original scenario fixed; new race above remains open** | `InterviewPage.jsx:47-56,113` consumes accepted identity/version parameters with replacement after local retention; invalid selections remain until resolved. Regression covers resume B/text-only and job B after remount. The asynchronous second consumption at line 114 needs lifecycle protection. |
| **4 — Discovery editor accepts answers the server rejects** | **Fixed in static review** | `InterviewSessionPage.jsx:36,99,152` applies 4,000 for discovery and 20,000 for formal interview to editor, handler, and button. Oversized ASR remains in state with shortening guidance. `api.js:62` adds actionable `DISCOVERY_LIMIT` copy. |
| **5 — Browser Back/Forward bypasses dirty-work guard** | **Fixed in static review** | `CampusApp.jsx:141-143` supplies a data router; `UnsavedWorkProvider.jsx:6-19` aggregates dirty owners into one `useBlocker`; `useUnsavedWork.js:8-18` registers and releases only the caller’s guard. Resume/job release follows acknowledged saving (`ResumePage.jsx:103-110`; `JobsPage.jsx:81-89`). POP acceptance/decline regressions were added, not executed. |
| **6 — Nested per-answer disclosure** | **Fixed in static review** | `InterviewFeedback.jsx:15-25` no longer contains the inner disclosure. The report’s single outer disclosure remains at line 39; missing points and reference answers are inside that one level. |
| **7 — History hides score basis and coverage** | **Fixed in static review** | `HistoryPage.jsx:125` renders `ScoreBasis` directly beside the score. Backend history includes canonical `scoring`, purpose, and version (`backend/src/routes/interview.js:510-531`), so the consumer receives the required fields. |

## Router migration integration

- Confirmed `react-router-dom` **7.18.1** provides the selected data-router/provider API and re-exports `useBlocker`.
- `main.jsx` does not wrap the campus application in another router; Clerk remains outside the application as before.
- Campus session context and the single blocker provider wrap all campus shells, including interview rooms and discovery reports.
- Registration is per editor, so acknowledging the main resume/job save does not clear a dirty target editor’s guard.
- No additional actionable router-import or dispatcher integration defect found.

**Verification boundary:** these are source-review conclusions, not passing execution results. Parent browser proof should retain Back/Forward decline/accept, multiple simultaneous dirty editors, save-and-continue without an erroneous discard prompt, and the newly identified pending-autosave/departure race.

[Some lines truncated to 768 chars. Use agent://FrontendSimplicityPlan:raw:10-10 to read line 10 whole]