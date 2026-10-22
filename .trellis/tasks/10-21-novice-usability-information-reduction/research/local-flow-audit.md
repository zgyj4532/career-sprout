# Local workflow audit — 2026-10-21

Read-only source investigation, not novice-user acceptance. Runtime limits are in `runtime-baseline.md`. Anchors describe the dirty working tree inspected today.

## Ranked reduction candidates

| Area | Evidence | Proposed reduction | Must preserve |
| --- | --- | --- | --- |
| Home | `frontend/src/campus/pages/HomePage.jsx:22-43` | Replace competing next-action card + five-step path + four large portals with one primary next action and compact capability navigation. Profile appears twice in the five-step path. | Keep direct entry for existing resume holders and all capability routes; steps are not mandatory gates. |
| Resume | `frontend/src/campus/pages/ResumePage.jsx:122-134` | Center current document and saving; move inactive import/voice/targeting/list management to secondary entries. | Dirty state, saved-version export semantics, import locks, stale AI rejection. |
| Profile | `frontend/src/campus/pages/ProfilePage.jsx:67-75` | One active representation of an experience; original/concise alternatives on demand; optional fields with summaries. | Full text/date precision/concise selection survive ordinary saves; adopted-but-unsaved and partial-save notices stay visible. |
| Interview prep | `frontend/src/campus/pages/InterviewPage.jsx:86-94` | One selected-job summary instead of select + readonly role + saved-job sentence; settings reveal with current mode/count summary. | Material source, private screenshot return, preparation persistence/fallback; no auto-start. |
| Import | `frontend/src/campus/components/ImportPanel.jsx:100-109`, `ImportConfirm.jsx:24-27,42-64` | Inactive importer becomes an entry; result summaries avoid full repeated destination forms. | Unresolved issues, duplicate decisions, save target and explicit skip remain visible; same confirmation ledger and restore conflict checks. |
| Jobs | `frontend/src/campus/pages/JobsPage.jsx:64-90,98-119` | Interview-origin flow emphasizes return; secondary browsing/edit/match/target actions contextual. | Save-and-return differs from retry-return of already saved job; public/private scope visible; dirty vs saved source explicit. |
| Screenshot | `frontend/src/campus/components/JobImageImport.jsx:67-87` | Contextual controls for pre-upload composition vs post-upload review/recovery. | Close is not discard; source order immutable after upload; keep conflicting cities/batches/deadlines and original previews accessible. |
| Answer | `frontend/src/campus/components/VoiceInput.jsx:43-54`, `pages/InterviewSessionPage.jsx:99-100` | Two editors/adoption+submission are a high-friction candidate for intentional workflow redesign. | ASR must not silently submit, overwrite typed answer or be lost on disclosure/unmount. Decision required. |
| Report | `frontend/src/campus/components/InterviewFeedback.jsx:8-39,108-115` | Surface available actionable takeaway, keep question transcripts/details secondary. | Do not fabricate advice or hide unknowns; score policy is not cosmetic. |
| History | `frontend/src/campus/pages/HistoryPage.jsx:65-73,114-131,174-197` | View/continue first; row management secondary; align report hierarchy. | Loading must not display a false empty state; explicit deletion confirmation and unfinished-session continuation. |
| Sharing/target export | `frontend/src/campus/components/SharingControls.jsx:27-32`, `TargetResumes.jsx:19-25,44-47` | Inactive editing disclosed; concise permission/version summary retained. | Teacher identity, revocation, downloaded-copy limits, source/job staleness and separate approval. |

## Behavioral risks requiring explicit planning

### Answer and completion reconciliation

`InterviewSessionPage.jsx:54-75` reads canonical answers before POST and reconciles after errors. Text clears only on confirmed question acceptance. Preserve this in any single-button progression.

`InterviewSessionPage.jsx:77-87` complete POST then GET has no catch reconciliation; backend `backend/src/routes/interview.js:509-535` rejects completed sessions. [INFERENCE] Successful completion with a lost response can strand inline retry on INTERVIEW_CLOSED. Not runtime-reproduced in this planning turn. Plan a precise response-loss scenario before any fix; do not just remove duplicate retry buttons (`:103-104`).

### Score provenance

`backend/src/services/interviewService.js:451-466` defaults missing analysis/expression to0, and `:516-519` weights expression20% for non-coding. Campus submission `InterviewSessionPage.jsx:64-66` does not send expression metrics. `backend/src/models/Interview.model.js:12-15,99` also defaults scores to0; `InterviewFeedback.jsx:77-85` aggregates missing dimensions as0.

[INFERENCE] A campus answer with perfect text dimensions but absent expression data can cap the formula at80. Missing historical observations may be indistinguishable from genuine zero. Must decide future scoring policy explicitly; never silently reclassify/recompute history or call UI placeholders a full fix.

### State preservation

`VoiceInput.jsx:13` reports capture/ASR busy, not pending review; hiding by unmount can lose pending text. Keep ownership stable. Native disclosure is already available; no new global store required. Profile insertion appends in ResumePage but replaces prep text in InterviewPage; unified labels must not hide these distinct consequences.

## Open scope decisions

Highest-value first: presentation-only reduction versus coherent novice workflow including recording/editor merging, final-answer-to-report and scoring contract work. Follow-up decisions depend on that answer: first-visit primary source (file vs one experience), optional material requirement, saved-versus-dirty downstream navigation, and score compatibility. Do not decide these from repository patterns alone.
