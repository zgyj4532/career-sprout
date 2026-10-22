# Proposed acceptance matrix — pending scope approval

These are design constraints, not executed tests. Final PRD/design/implementation plan follows user scope decisions.

| Scenario | Observable outcome required | Evidence method |
| --- | --- | --- |
| First visit, no material | Understand the next action and access import or manual experience without reading a guide; optional jobs not presented as prerequisite. | Real browser empty-account baseline and final surface; human comprehension deferred. |
| Returning with resume | Existing material is reusable without retyping; direct practice remains available. | Synthetic account with saved resume; no automatic mutation/start. |
| Import processing/review | Distinguish uploaded, processing, needs review, saving, saved; unresolved issues and save destination visible even when details collapse. | Real file/API flow plus browser; test uncertain/partial outcomes with isolated synthetic data. |
| Dirty editing with secondary tools | Open/close optional sections or manage another resume without losing edits or pending AI/ASR result. | Interact with actual editor; check canonical persistence separately. |
| Screenshot from interview | Chosen job and practice preparation survive cancel/back/refresh; save succeeds before return; retry-return does not create another job. | Existing synthetic multi-image fixture/API plus browser; no personal screenshots in evidence. |
| Loading, empty, failure | Each has distinct representation and a concrete action; network failure never displays an empty collection. | Read-only controlled response branches, explicitly distinguished from actual backend proof. |
| Saved versus dirty source | Export/bring-to-interview indicates which version will be used; never silently overwrite or claim dirty text saved. | Browser + API readback. |
| Recording, if workflow scope approved | One understandable answer path; ASR review never silently submits or overwrites typed content; cancel/late response/permission failure retains recoverable work. | Controlled audio/browser; user-confirmed prior human sound quality not redundantly rerun. |
| Answer/summary response lost, if behavior scope approved | Recover canonical saved progress before retry; no duplicated answer/model completion; input cleared only after acknowledged persistence. | Fault scenario before fix and actual isolated API/browser proof after. |
| Scores, if contract scope approved | Unknown differs from real0; unavailable expression not silently a failure; old score provenance and history remain explicit. | Deterministic cross-layer behavior cases and new/legacy API records; policy must be approved first. |
| Privacy/sharing | Private screenshots remain private; teacher grant/revoke and target-version approval remain separate from save. | Existing ownership/authorization contracts plus relevant UI operation. |
| Desktop/narrow/keyboard | Main action readable; 390px and desktop no unintended horizontal scroll; keyboard focus not obscured by nav/save bars; no nested disclosure maze. | Actual screenshots and keyboard traversal. No physical-mobile claim. |
| Student/physical-device acceptance | BLOCKED_EXTERNAL: new-server ICP filing and accessible deployment. | Resume only after dependency is available; no fabricated student timings or success rates. |

## Release discipline

Preserve all prior dirty work. Scope commits/PRs after verification; do not automatically bundle .omp configuration or personal sample materials. Do not auto-archive a task merely because local checks pass. Final planning approval is separate from task-creation consent. No tests/builds are required for this documentation-only planning turn; context manifests are validated.
