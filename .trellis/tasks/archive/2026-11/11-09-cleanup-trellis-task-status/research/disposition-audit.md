# Active task disposition audit

Audit date: 2026-11-09

## Classification rules

- **Completed**: the task's scoped implementation or documentation is evidenced as delivered, or a named successor supplies the missing acceptance evidence. Remaining `NOT_RUN` boundaries stay recorded and are not promoted to passes.
- **Abandoned**: the original scope is stale, superseded, or has no execution evidence and should not remain actionable. Before archival, `task.json.meta.disposition` records `abandoned`, with date and reason; `notes` retains the same human-readable outcome.
- Trellis `task.py archive` always writes top-level `status=completed`. Therefore abandonment is represented by durable disposition metadata plus notes, then archived through the supported command. Top-level `completed` means lifecycle closed, not product scope delivered.

## Proposed disposition

| Task | Disposition | Evidence / reason |
| --- | --- | --- |
| `00-bootstrap-guidelines` | completed | Notes state six frontend guideline files and index are complete; only review/archive remained. |
| `10-15-campus-phase1-wsl` | abandoned | Broad initial phase remained partially blocked and was superseded by focused implementation, engineering closeout, authentication, deployment, and release tasks. |
| `10-15-phase1-1-stabilize-real-flow` | abandoned | No completion record; its stabilization/auth/verification goals were superseded by later closeout and auth tasks. |
| `10-18-student-career-experience` | abandoned | Monolithic parent remained 0/5 and required complete external acceptance; later focused tasks replaced its delivery path. |
| `10-18-identity-diagnostics` | abandoned | Original Resend reservation/identity scope was replaced by retained Clerk integration and the completed login UX task. |
| `10-18-guided-growth` | abandoned | Original child lacks completion evidence; subsequent resume/novice workflow tasks became the maintained implementation path. |
| `10-18-voice-resume` | abandoned | Original child lacks final integration evidence; later resume/novice tasks retain the exercised flows and explicit audio boundaries. |
| `10-18-teacher-matching` | abandoned | Original child lacks final acceptance evidence; later teacher portal plan superseded it but also remained unexecuted. |
| `10-18-career-sprout-brand` | completed | Metadata records verified startup from the renamed path; later release inventory and production URL use CareerSprout. |
| `10-19-effortless-career-experience` | completed | Scoped light changes have commit/PR evidence; substantial follow-up was explicitly transferred to the 10-20 task. Excluded Issue #1 items remain excluded. |
| `10-20-resume-import-polish-jobs` | completed | Verification records implementation, passing focused/full scoped checks, model/API/browser/PDF evidence, and explicit human/mobile limits. Later deployment/auth removed obsolete infrastructure blockers; novice trials remain NOT_RUN. |
| `10-21-novice-usability-information-reduction` | completed | Implemented, reviewed, linted, built, and exercised through model/API/browser evidence; human novice and physical-phone trials remain NOT_RUN. |
| `10-21-novice-discovery-profile` | completed | Child implementation and integration evidence are owned by the verified parent task. |
| `10-21-novice-interview-scoring` | completed | Child implementation and integration evidence are owned by the verified parent task. |
| `10-21-novice-pages-save-continue` | completed | Child implementation and integration evidence are owned by the verified parent task. |
| `10-22-engineering-acceptance-closeout` | completed | Final `verify:phase1` run passed all nine engineering gates; full human acceptance remains explicitly false. |
| `10-26-clerk-auth-integration` | completed | Original managed-browser verification was partial, but archived `11-06-login-ux` records real production session confirmation and deployment, satisfying the later auth outcome. Teacher authorization remains outside that successor's accepted scope. |
| `10-29-teacher-portal-acceptance` | abandoned | Artifacts contain a plan but no execution or completion evidence. Production deployment does not prove teacher portal acceptance. |
| `11-04-career-sprout-docker-deploy-followup` | completed | Its local regression/build/security preparation fed the archived production release; remaining production work was intentionally transferred to that release task. |
| `11-04-docker-deploy-career-sprout` | completed | Its sole release child is archived completed and production route/health evidence is recorded there. |
| `11-06-career-sprout-docker-image-build` | completed | Diagnosis records successful frontend, backend, and Redis builds, frontend HTTP smoke, root causes, and applied remediation; production deployment was handled by the archived release task. |

## Expected result

- 13 historical tasks archived as completed.
- 8 historical tasks recorded as abandoned and archived.
- The cleanup task remains the only active task until its own verification and archive step.
- No task's historical `NOT_RUN`, blocked, or excluded acceptance claim is rewritten as passed.
