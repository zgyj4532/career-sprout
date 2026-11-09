# Execution plan — approved for implementation

1. After final user approval activate this task. Read frontend/project specs and current branch/diff; preserve all earlier work. Establish code-reference map for script helpers and actual AI/ASR variables. Do not import phase1-kit again.
2. Implement doctor and consistent-runtime verifier in scripts/local/{doctor,verify-phase1,lib}. Keep helper extraction limited to real shared use. Add deterministic boundary tests for argv/runtime selection, failed/signal child outcomes, report preservation, lock mismatch and foreign-port classification.
3. Refactor smoke-phase1/check-persist into an isolated run-owned API/restart/persistence scenario. Test cleanup on failure/interruption and prevent default developer DB use. No model calls, no developer process stops. Run only after integration.
4. Parallel independent docs slice: shorten README referencing pinned upstream structure; update LOCAL_WSL, PHASE1_REPORT, PHASE1_1_REPORT, PRUNING_LOG, MANUAL_ACCEPTANCE, DEPLOYMENT_ASSESSMENT, SERVER_CONFIG and current relevant task notes to Clerk. Preserve history and all disabled sources. Do not execute configure-server upload.
5. Run one serial integrated verifier, capture exact report. Exercise tool error paths in isolated fixtures; fix causes, rerun affected checks. Upstream full suite optional and reported separately; known old failures not rerun merely to reconfirm.
6. Open actual browser360/768 current home/resume/interview/feedback, capture synthetic evidence and compare viewport vs scroll width/focus/control reachability. No fake account/real-device pass. Do not widen UI work except concrete newly observed acceptance regressions; material product changes return to planning.
7. Final check command/doc consistency, safe logs, valid task JSON/context, internal links and reports. Remove own temporary harness/resources; leave old task blockers intact. Record final current vs historical status and minimally required Clerk user actions without requesting secret values.

## Acceptance evidence
R1 verifier real invocation with child Node identity and per-step exit/status; R2 doctor actual read-only output plus controlled missing/conflict cases; R3 actual360/768 browser; R4 no conflicting current migration instructions and existing Clerk safety preserved; R5 dated historical/current reports; R6 shorter accurate README with working links; R7 no dormant deletion/dependency removal.

## Release boundaries
No auto commit/push/archive/public deploy in this task approval. Four-week horizon does not convert external blockers into pass. Formal Clerk accounts and new-host configuration remain user-controlled prerequisites; finish all available local engineering work and state precise remaining steps.
