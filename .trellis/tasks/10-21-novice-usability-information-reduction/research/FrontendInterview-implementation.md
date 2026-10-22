# Frontend interview implementation

## Change boundary

The current interview has two answer editors, separate final save/report actions, and no discovery/profile-confirmation surface. This implementation owns the interview preparation/session/history pages, capture/review components, feedback, and focused regressions. It preserves canonical answer reconciliation and account-owned preparation, adds the approved discovery API consumers, and consumes canonical score provenance rather than recomputing missing dimensions. Shared routes/styles/material/API are integrated by FrontendPages; backend persistence contracts are owned by BackendWorkflow. No framework, global store, provider, historical score migration, or deployment changes are introduced.

## Verification

NOT_RUN: per parent instruction, no tests, lint, build, formatter, or runtime checks are run by this agent. Parent owns integrated validation. Physical-device and student acceptance remain external gates.

## Implemented behavior

- One interview answer editor; capture-only VoiceInput appends late-safe, deduplicated ASR into parent text without submitting. Cancellation invalidates response generations and retains admission until the request settles. VoiceReview preserves explicit resume adoption; FrontendPages migrated its caller/test.
- Explicit save-next and final save-report use canonical reads before submission and after acknowledgement/uncertain outcomes. Accepted answers are never reposted to retry next-turn or completion generation. Pending durable generation has an explicit recovery action; expired lease permits a deliberate retry.
- `/discovery` creates a real owned session without material. The existing room renders adaptive next turns, zero-answer early end, unscored summary, and grounded editable confirmation. Partial confirmation uses server-frozen candidates, fresh expected targets, explicit conflict choices and completed-target steps. Skip performs no profile write; uncertain saves reconcile before retry; cache-pending is not described as unsaved.
- Preparation reuses the last explicit choice, otherwise a recent nonempty resume, checks acknowledged resume/job revisions, fetches explicitly selected resumes outside the initial list, preserves preparation through screenshot detours, and exposes optional mode/count settings. Invalid sources cannot silently start.
- Campus history has distinct loading/error/empty states, direct continuation, deletion confirmation, discovery purpose labels, legacy labels and canonical score coverage. Feedback puts actionable recommendations before scores and per-question details.
- Dormant legacy score consumers were migrated too: History compares one compatible group, Analytics excludes discovery/missing dimensions, Replay/ShareCard/caption preserve null and legacy semantics, and Prep consumes canonical dimensions. Its old fabricated expression metrics and dead accumulator were removed so new available-dimension scoring cannot treat them as observations.

## Files

Campus product: `pages/InterviewPage.jsx`, `pages/InterviewSessionPage.jsx`, `pages/HistoryPage.jsx`, new `pages/DiscoveryPage.jsx`, `components/VoiceInput.jsx`, new `components/VoiceReview.jsx`, `components/InterviewFeedback.jsx`, new `components/DiscoveryReport.jsx`.

Legacy product: `pages/InterviewHistory.jsx`, `pages/InterviewReplay.jsx`, `pages/InterviewPrep.jsx`, `pages/Analytics.jsx`, `components/ShareCard.jsx`, `utils/shareCard.js`, `utils/interviewAnalyzer.js`, new `utils/interviewScores.js` (all under frontend/src).

Tests: updated campus `pages/__tests__/InterviewPage.test.jsx`, `pages/__tests__/InterviewSessionPage.test.jsx`, `components/__tests__/VoiceInput.test.jsx`; new `components/__tests__/DiscoveryReport.test.jsx`, `components/__tests__/InterviewFeedback.test.jsx`, `pages/__tests__/HistoryPage.test.jsx`.

Documentation: `.trellis/spec/frontend/component-guidelines.md` and this report. Shared integration (CampusApp, CSS, material/API, useUnsavedWork, ResumePage) remains owned by FrontendPages.

## Parent validation targets

Run the approved serial campus frontend suite, scoped lint including the changed dormant legacy files, and campus build. Additional actual browser/API proof must exercise canonical response loss, pending/expired generation, partial profile conflicts, zero-answer discovery, invalid source revisions, recording cancellation and 390px keyboard focus. Tests use controlled synthetic callbacks and do not establish provider quality or human/device acceptance.

Contracts were coordinated with BackendWorkflow and checked against its actual discoveryConfirmation, interviewWorkflow, interviewScoring and interview routes. No unconfirmed payload shape remains. Discovery start response loss intentionally directs users to owned history before starting again; the creation endpoint currently has no operation-id contract. No runtime validation or passing-check claim is made.

## Frontend plan review fixes

Addressed assigned findings 2, 3, 4, 6 and 7 without running checks:

- Recent resume queries and ordering use the actual `lastModified` field; regression contrasts an older-created/recently-saved resume against a newer-created one.
- Accepted incoming resume/job identity and revision parameters are removed with router replacement only after preparation is retained locally or acknowledged by the server. Invalid selections keep their parameters until explicitly resolved. Regression remounts at the consumed URL and verifies later resume B/text-only and job B choices survive refresh.
- Discovery has a 4,000-character answer limit, formal interview retains 20,000. Save handler and button both enforce it; overlong ASR remains complete in the editor with actionable shortening guidance. Regression checks both purposes and direct submit bypass.
- Per-answer feedback has no inner disclosure; opening the single report disclosure exposes missing points and reference answers. Regression checks actual visible feedback after opening one disclosure.
- History renders canonical score basis and observation coverage beside the numeric score without requiring disclosure. Regression uses equal numeric totals with different scopes/coverage and verifies both are visible.

FrontendPages owns the separate fullText representation and browser Back/Forward guard findings, including the DISCOVERY_LIMIT safe API message. No new route/CSS changes are required by these fixes.

### Autosave completion lifecycle correction

The follow-up review identified a delayed autosave fulfillment that could call a stale router search setter after departure. Autosave success/error application now requires the originating effect to remain current, the preparation owner to remain mounted, and the current route key to match the request origin. Effect cleanup invalidates pending callbacks on newer preparation choices and unmount. Added deferred-save regressions for departure before resolution and newer text-only selection before resolution. Checks remain NOT_RUN; parent owns execution.

### Correctness review findings 4–8

- Confirmation now applies the canonical POST response directly through the same projection used for GET recovery. It no longer performs a redundant post-acknowledgement GET, so completed/cache-pending persistence cannot be downgraded to unknown by that refresh.
- Voice transcription checks parent `disabled` admission at its shared entry point; failed-capture retry is unavailable during persistence/playback and returns when admission permits it.
- `utils/interviewDifficulty.js` now stores versioned per-comparison-key aggregates/streaks. Existing unscoped progress is retained unchanged and shown separately, not assigned a guessed mode/basis. InterviewPrep migrates its single caller and derives display/promotion from the current compatible group. Null/discovery outcomes do not increment numeric progress.
- Analytics separates all formal sessions from its scored comparable subset. Counts/recent-session rows retain unscored interviews and show unavailable metrics, while averages/trends use only the selected compatible numeric scope.
- Shared `components/interview/QuestionAnalysisCard.jsx` averages only observed dimensions, labels observation coverage, preserves true zero, and displays unavailable dimensions/all-missing outcomes without fabricated zero or a negative judgement.

New regressions: `campus/__tests__/interviewDifficulty.test.js`, `campus/components/__tests__/LegacyQuestionAnalysis.test.jsx`, `campus/pages/__tests__/LegacyAnalytics.test.jsx`. Extended confirmation and voice suites cover successful POST without a second read and disabled-parent transcription retry. All checks remain NOT_RUN by this agent; parent owns integrated execution.

BackendWorkflow additionally introduced `discovery.uncertainties` for conservatively omitted ambiguous facts. DiscoveryReport displays those notes visibly as uncertainty guidance, not an error or inferred candidate; a focused regression covers that distinction.

### Parent-reported scoped lint corrections

Parent reported eight refs-rule errors in DiscoveryPage and InterviewPage. Discovery's acknowledged session ID now uses state for rendered recovery actions, retaining an event-only lock ref and local acknowledged navigation destination. Preparation updates/invalidates its committed route-key ref in a layout effect rather than render; stale autosave protection is retained. No lint suppression or agent-run checks were introduced; parent owns rerun evidence.

### Real-data report density correction

Parent's actual 390px real-model report showed excessive default height. RoomReport now shows the first complete actionable recommendation only, followed by the canonical score with compact visible basis/coverage. Exact duplicate recommendations are not repeated. The full summary, remaining recommendations, strengths and gaps are retained inside one flat optional disclosure; per-question feedback remains a separate single-level disclosure. Detailed dimension scores/weights remain independently accessible. Added a long-data visibility regression proving secondary content reveals without truncation and the primary advice is not duplicated. FrontendPages changed the shared room exit to neutral “退出练习”. Parent owns surface recheck; no agent tests or runtime checks run.

### Plain-language scoring labels

Replaced raw campus mode keys with 综合练习 / 专业与技术 / 经历与表达 / 编程. Legacy scope selectors now display readable mode and dimension names from their representative record instead of exposing comparison-key strings. Internal keys, scoring, grouping and persisted data are unchanged. Parent reported the reduced 390px report height as 1020 versus 2726 with content accessible; this is parent-observed evidence, not an agent-run check. No checks run for this display-only correction.
