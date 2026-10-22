# Novice workflow verification — 2026-10-21

Status: implemented and reviewed; local test/model/API/browser evidence below. Final scoped lint and production build passed. Human novice trials and physical-mobile acceptance remain BLOCKED_EXTERNAL on new-server ICP filing/deployment. Existing user-confirmed microphone/speaker validation is retained in its original scope. No commit/push/archive performed.

## Engineering execution

| Check | Observed result |
| --- | --- |
| Initial integrated backend campus |103/103 tests,6 suites PASS;462.40s test duration. Before later review fixes; not claimed as final full rerun. |
| Post-review backend + shared schemas/coding/isolation |173 tests:172 PASS,1 FAIL in legacy privacy-transition confirmation. Actual legacy BSON CAS false conflict, not a flaky-test claim. |
| Corrected noviceSafety/noviceWorkflow/noviceRecovery |26/26 PASS;90.92s. Includes unchanged failed legacy transition and new concurrent legacy education guard. Other shared suites passed in preceding run. |
| Initial frontend campus |25 files/134 tests PASS;639.00s. ImportPanel act warnings assigned and fixed rather than suppressed; later profile edits required targeted rerun. |
| Final ProfilePage/profileSave/ImportPanel |3 files/30 tests PASS;76.01s; Profile15 cases, no act warnings. |
| Final InterviewPage/InterviewSessionPage/DiscoveryReport |3 files/21 tests PASS;91.60s after React ref lifecycle correction. |
| Final report/import/history/legacy analytics refinement |4 files/23 tests PASS;99.23s after actual long-report density refinement. |
| Scoped frontend lint |Initial8 refs-rule errors fixed without suppression; corrected scoped lint PASS. Last display-only refinement scope checked with final build below. |
| Scoped backend lint |Exit0,0 errors,18 warnings (unused destructure redactions/parameters and existing fields). Warnings not suppressed. |
| Final campus production build,384MiB heap |546 modules PASS,23.30s; JS625.14kB/gzip197.39kB, retained >500kB warning. Final changed-surface lint also exit0. |

Mongoose deprecated `new` warnings remain visible. No claim of all dormant upstream backend lint passing. No TypeScript gate introduced.

## Static review

Frontend plan/simplicity, frontend correctness, backend correctness and backend security reviews found and fixed concrete data-loss, privacy, grounding, null-score and lifecycle defects. Final reviewer reports have zero open findings within inspected scope. Native BSON CAS mutation received an additional focused security re-review after the actual test failure. See `review-*-final.md`, `review-frontend-plan-round3.md` and `review-backend-native-cas.md`. Static review does not substitute for execution or certify security. Deployment concurrency remains one writer process.

## Actual configured-model/API/browser proof

Isolated database `career_sprout_novice_20261021`, synthetic UID `novice-smoke-20261021`; original local data/volumes untouched. Evidence: `smoke-novice-result.json` and `browser-model-smoke.json`.

- Actual configured provider generated a follow-up from an accepted answer, then grounded unscored summary/candidates for explicit nonstudent status, major, interest and an unstarted idea. One complete source flow, not repeated model calls to improve acceptance rate.
- Confirmation GET left profile unchanged. Edited interest saved; repeated confirmation preserved single interest/experience. Repeated completion returned existing result. Ordinary browser profile edit/save/reload retained explicit false-known attendance, major, idea state and source IDs.
- Browser zero-material start and zero-answer end showed no fabricated summary/score.
- Actual browser edited saved resume -> save-and-continue -> preparation selected acknowledged resume. Actual formal interview generated questions and feedback, saved two typed answers through one editor, final save transitioned to report. Score75, versionavailable-v1; expression null,0/2 observations,effectiveWeight0. Repeated complete200 left scoring unchanged.
- Actual browser created private job -> save-and-continue -> original preparation with same resume and2 questions; readback statusdraft. Resume create/operation recovery/replay returned the same identity/revision.
- Actual narrow390 and desktop1440 surfaces inspected. Long real-model report initially showed all advice and was too dense; after refinement same report default document height2726→1020, scrollWidth390, one complete next-action recommendation, visible scoring scope, optional flat details. Expanded advice remained accessible. This compares two in-session renderings, not a pristine preimplementation baseline.
- Keyboard focus on disclosed report control observed top627.72/bottom671.72 within844 viewport. Empty import history now closed by default. No reduced text-size substitute.
- Declined browser back retained dirty profile text. Native-dialog automation acceptance was inconclusive; explicit save then navigation worked. Router POP decline/accept/acknowledged transitions are covered by deterministic browser-router regressions, not claimed as complete human dialog acceptance.

Safe synthetic screenshots in `research/evidence/`; report screenshots precede final raw mode-label localization but reflect the verified density/layout. No personal user records or credentials included.

## Runtime caveats and cleanup

Two supervised launch failures coincided with WSL uptime resetting to0min; cause not established. Git Bash initially translated Linux executable paths; MSYS_NO_PATHCONV resolved that separate issue. A retained host subprocess ran the final isolated runtime stably through model/API/browser checks. Source edits on Windows did not always invalidate WSL Vite cache; owned runtime restarted before final surface inspection. See implementation-runtime.md. Owned browser/runtime stopped; synthetic database and temporary harness cleanup recorded after final checks.

## External and unexecuted acceptance

- 3–5 novice students: BLOCKED_EXTERNAL, filing/deployment.
- Physical mobile: BLOCKED_EXTERNAL, same dependency; desktop390 emulation is not device proof.
- Formal account/authentication integration: not part of this implementation; Evren/Resend remains the chosen future deployment direction.
- No new human microphone/speaker quality claim; prior user confirmation retained. Media cancellation/late ASR/admission behavior covered by controlled regression tests, not real-device audio in this turn.
- Full original before/after screenshot baseline unavailable. No percentage-based novice-success claim.
- No new screenshot-model import corpus run; previous implementation evidence retained, current integration regressions and manual private-job return exercised.

## Cleanup completed

Owned browser and retained runtime stopped. Exact isolated database dropped after collection counts:3 interviews,1 profile/student/discovery confirmation/resume/version/job/preparation,3 save operations; original database and volumes untouched. Owned temporary import/log directories removed. Throwaway runtime/model-smoke/cleanup scripts removed; only safe synthetic evidence retained.
